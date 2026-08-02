/**
 * Observabilidad del gasto en IA.
 *
 * Contar tokens no es observar: un token no le dice nada a quien firma el
 * presupuesto. Aqui cada llamada se convierte a euros, se le pone una traza
 * para poder reconstruirla, y se acumula por caso de uso, de modo que la
 * pregunta "cuanto cuesta atender a un cliente" tiene respuesta y no
 * estimacion.
 *
 * Se guarda en memoria del proceso y, si hay base de datos, tambien en ella.
 * En serverless la memoria no sobrevive entre ejecuciones, asi que la copia
 * persistida es la que vale para el histórico; la de memoria sirve para
 * responder rapido en la misma ejecucion.
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

async function persistir(c: Consumo) {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return;
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

export function registrar(datos: Omit<Consumo, "coste" | "momento">): Consumo {
  const consumo: Consumo = {
    ...datos,
    coste: calcularCoste(datos.modelo, datos.tokensEntrada, datos.tokensSalida, datos.caracteres),
    momento: new Date().toISOString(),
  };
  reciente.push(consumo);
  if (reciente.length > VENTANA) reciente.shift();
  void persistir(consumo);
  return consumo;
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

export function resumen() {
  const total = reciente.reduce((s, c) => s + c.coste, 0);
  const fallos = reciente.filter((c) => !c.ok).length;

  const porTipo: Record<string, { llamadas: number; coste: number; msMedio: number }> = {};
  for (const c of reciente) {
    const t = (porTipo[c.tipo] ??= { llamadas: 0, coste: 0, msMedio: 0 });
    t.llamadas += 1;
    t.coste += c.coste;
    t.msMedio += c.ms;
  }
  for (const t of Object.values(porTipo)) t.msMedio = Math.round(t.msMedio / t.llamadas);

  // Un "caso" es un cliente atendido: una extraccion de perfil y su argumento.
  const casos = reciente.filter((c) => c.tipo === "argumento").length || 1;
  const presupuesto = presupuestoMensual();
  const proyeccionMes = total > 0 && casos > 0 ? (total / casos) * 4000 : 0;

  return {
    llamadas: reciente.length,
    fallos,
    tasaError: reciente.length ? Number((fallos / reciente.length).toFixed(3)) : 0,
    costeTotal: Number(total.toFixed(4)),
    costePorCaso: Number((total / casos).toFixed(4)),
    latenciaP95: percentil(reciente.map((c) => c.ms), 95),
    porTipo,
    presupuestoMensual: presupuesto,
    proyeccion4000Propuestas: Number(proyeccionMes.toFixed(2)),
    alerta: presupuesto !== null && proyeccionMes > presupuesto
      ? `La proyección mensual (${proyeccionMes.toFixed(2)} €) supera el presupuesto declarado (${presupuesto} €)`
      : null,
    ultimas: reciente.slice(-10).reverse(),
  };
}
