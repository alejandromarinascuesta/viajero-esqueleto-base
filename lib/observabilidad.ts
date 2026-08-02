/**
 * Observabilidad del gasto en IA.
 *
 * Contar tokens no es observar: un token no le dice nada a quien firma el
 * presupuesto. Aqui cada llamada se convierte a euros, se le pone una traza
 * para poder reconstruirla, y se acumula por caso de uso, de modo que la
 * pregunta "cuanto cuesta atender a un cliente" tiene respuesta y no
 * estimacion.
 *
 * En serverless cada peticion puede caer en una instancia distinta, asi que la
 * memoria del proceso NO sirve para acumular: lo que registra una llamada no lo
 * ve la siguiente. Por eso el registro se guarda en base de datos y el resumen
 * se lee de ahi. La memoria queda solo como respaldo si no hay base de datos.
 */

export type TipoLlamada = "perfil" | "argumento" | "guion" | "voz";

export type Consumo = {
  traza: string;
  tipo: TipoLlamada;
  modelo: string;
  ok: boolean;
  ms: number;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  caracteres: number | null;
  coste: number;
  error: string | null;
  momento: string;
};

/**
 * Precio por millon de tokens, en euros. Son tarifas publicas y cambian, por
 * eso se pueden sobreescribir por entorno sin tocar codigo.
 */
const TARIFAS: Record<string, { entrada: number; salida: number }> = {
  "claude-sonnet-4-5": { entrada: 2.8, salida: 14.0 },
  "claude-haiku-4-5": { entrada: 0.75, salida: 3.7 },
  "gpt-5-mini": { entrada: 0.23, salida: 1.85 },
  "gpt-4o-mini": { entrada: 0.14, salida: 0.55 },
};

/** El texto a voz se factura por caracteres, no por tokens. */
const TARIFA_VOZ_POR_MILLON = 14.0;

const POR_DEFECTO = { entrada: 2.8, salida: 14.0 };

function tarifa(modelo: string) {
  const propia = process.env.TARIFAS_IA;
  if (propia) {
    try {
      const leidas = JSON.parse(propia) as Record<string, { entrada: number; salida: number }>;
      if (leidas[modelo]) return leidas[modelo];
    } catch { /* si el JSON esta mal, se usan las de siempre */ }
  }
  const clave = Object.keys(TARIFAS).find((k) => modelo.startsWith(k));
  return clave ? TARIFAS[clave] : POR_DEFECTO;
}

export function calcularCoste(
  modelo: string,
  tokensEntrada: number | null,
  tokensSalida: number | null,
  caracteres: number | null,
) {
  if (caracteres !== null) return (caracteres / 1_000_000) * TARIFA_VOZ_POR_MILLON;
  const t = tarifa(modelo);
  const entrada = ((tokensEntrada ?? 0) / 1_000_000) * t.entrada;
  const salida = ((tokensSalida ?? 0) / 1_000_000) * t.salida;
  return entrada + salida;
}

export function nuevaTraza() {
  return `tz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Ventana en memoria. Acotada a proposito: no es el histórico, es lo reciente. */
const VENTANA = 200;
const reciente: Consumo[] = [];

function credenciales() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && clave ? { url, clave } : null;
}

async function persistir(c: Consumo) {
  const cred = credenciales();
  if (!cred) return;
  const { url, clave } = cred;
  try {
    await fetch(`${url}/rest/v1/consumo_ia`, {
      method: "POST",
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        traza: c.traza, tipo: c.tipo, modelo: c.modelo, ok: c.ok, ms: c.ms,
        tokens_entrada: c.tokensEntrada, tokens_salida: c.tokensSalida,
        caracteres: c.caracteres, coste: c.coste, error: c.error, momento: c.momento,
      }),
    });
  } catch { /* la observabilidad nunca puede tumbar la peticion que observa */ }
}

/**
 * Se espera al guardado a proposito. Dispararlo sin esperar parece mas rapido,
 * pero en serverless la funcion puede terminar antes de que salga la peticion y
 * el registro se pierde. Cuesta unas decenas de milisegundos.
 */
export async function registrar(datos: Omit<Consumo, "coste" | "momento">): Promise<Consumo> {
  const consumo: Consumo = {
    ...datos,
    coste: calcularCoste(datos.modelo, datos.tokensEntrada, datos.tokensSalida, datos.caracteres),
    momento: new Date().toISOString(),
  };
  reciente.push(consumo);
  if (reciente.length > VENTANA) reciente.shift();
  await persistir(consumo);
  return consumo;
}

/** Lee las ultimas llamadas de la base de datos. Sin ella, lo que haya en memoria. */
async function ultimasLlamadas(limite = 300): Promise<Consumo[]> {
  const cred = credenciales();
  if (!cred) return reciente;
  try {
    const r = await fetch(
      `${cred.url}/rest/v1/consumo_ia?select=*&order=momento.desc&limit=${limite}`,
      { headers: { apikey: cred.clave, Authorization: `Bearer ${cred.clave}` }, cache: "no-store" },
    );
    if (!r.ok) return reciente;
    const filas = (await r.json()) as Record<string, unknown>[];
    return filas.map((f) => ({
      traza: String(f.traza),
      tipo: f.tipo as TipoLlamada,
      modelo: String(f.modelo),
      ok: f.ok === true,
      ms: Number(f.ms),
      tokensEntrada: f.tokens_entrada === null ? null : Number(f.tokens_entrada),
      tokensSalida: f.tokens_salida === null ? null : Number(f.tokens_salida),
      caracteres: f.caracteres === null ? null : Number(f.caracteres),
      coste: Number(f.coste),
      error: (f.error as string) ?? null,
      momento: String(f.momento),
    }));
  } catch {
    return reciente;
  }
}

/** Umbral de gasto declarado. Si no se configura, no hay alerta que dar. */
export function presupuestoMensual() {
  const v = Number(process.env.PRESUPUESTO_IA_MES);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function percentil(valores: number[], p: number) {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))];
}

export async function resumen() {
  const llamadas = await ultimasLlamadas();
  const total = llamadas.reduce((s, c) => s + c.coste, 0);
  const fallos = llamadas.filter((c) => !c.ok).length;

  const porTipo: Record<string, { llamadas: number; coste: number; msMedio: number }> = {};
  for (const c of llamadas) {
    const t = (porTipo[c.tipo] ??= { llamadas: 0, coste: 0, msMedio: 0 });
    t.llamadas += 1;
    t.coste += c.coste;
    t.msMedio += c.ms;
  }
  for (const t of Object.values(porTipo)) t.msMedio = Math.round(t.msMedio / t.llamadas);

  // Un "caso" es un cliente atendido: una extraccion de perfil y su argumento.
  const casos = llamadas.filter((c) => c.tipo === "argumento").length || 1;
  const presupuesto = presupuestoMensual();
  const proyeccionMes = total > 0 && casos > 0 ? (total / casos) * 4000 : 0;

  return {
    llamadas: llamadas.length,
    fallos,
    tasaError: llamadas.length ? Number((fallos / llamadas.length).toFixed(3)) : 0,
    costeTotal: Number(total.toFixed(4)),
    costePorCaso: Number((total / casos).toFixed(4)),
    latenciaP95: percentil(llamadas.map((c) => c.ms), 95),
    porTipo,
    presupuestoMensual: presupuesto,
    proyeccion4000Propuestas: Number(proyeccionMes.toFixed(2)),
    alerta: presupuesto !== null && proyeccionMes > presupuesto
      ? `La proyección mensual (${proyeccionMes.toFixed(2)} €) supera el presupuesto declarado (${presupuesto} €)`
      : null,
    ultimas: llamadas.slice(0, 10),
  };
}
