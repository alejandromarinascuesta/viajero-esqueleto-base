/**
 * Locucion del guion.
 *
 * El texto que se lee NO se escribe aqui: viene del plan ya verificado contra la
 * ficha del catalogo. La voz no aniade informacion, solo la pronuncia. Es el
 * mismo principio que rige el resto del sistema — la IA transforma lo que ya
 * existe, no lo inventa.
 *
 * Si no hay clave de OpenAI configurada, la pieza se genera igual con la cama
 * musical y sin voz. La locucion es una mejora, no un requisito.
 */

import { nuevaTraza, registrar } from "@/lib/observabilidad";

const VOCES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type Voz = (typeof VOCES)[number];

export function vozValida(valor: unknown): Voz {
  return VOCES.includes(valor as Voz) ? (valor as Voz) : "nova";
}

/** Solo se acepta una clave de OpenAI: la de Anthropic no hace sintesis de voz. */
export function claveVoz(): string | null {
  const clave = process.env.OPENAI_API_KEY ?? process.env.TTS_API_KEY;
  return clave && clave.startsWith("sk-") && !clave.startsWith("sk-ant-") ? clave : null;
}

export function hayLocucion() {
  return Boolean(claveVoz());
}

const ESTILO =
  "Locucion publicitaria en espaniol de Espania. Tono calido y natural, ritmo agil, " +
  "como una agente de viajes con oficio contando algo que le apetece contar. " +
  "Nada de voz de telediario ni de locutor de anuncio antiguo.";

/**
 * `instructions` solo lo admiten los modelos nuevos. Si el despliegue no tiene
 * acceso a ellos, se reintenta con el clasico, que existe en cualquier cuenta.
 */
const MODELOS = ["gpt-4o-mini-tts", "tts-1"];

function extraerMensaje(cuerpo: string, estado: number) {
  try {
    const json = JSON.parse(cuerpo) as { error?: { message?: string; code?: string } };
    const mensaje = json.error?.message;
    if (mensaje) return `${mensaje} (HTTP ${estado})`;
  } catch { /* la respuesta no era JSON */ }
  return `HTTP ${estado}: ${cuerpo.slice(0, 180)}`;
}

async function pedirVoz(
  modelo: string,
  texto: string,
  voz: Voz,
  velocidad: number,
  clave: string,
  signal: AbortSignal,
): Promise<{ audio: ArrayBuffer } | { error: string; estado: number }> {
  const cuerpo: Record<string, unknown> = {
    model: modelo,
    voice: voz,
    input: texto.slice(0, 1800),
    speed: Math.min(1.25, Math.max(0.85, velocidad)),
    response_format: "mp3",
  };
  if (modelo.startsWith("gpt-")) cuerpo.instructions = ESTILO;

  const respuesta = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    return { error: extraerMensaje(await respuesta.text(), respuesta.status), estado: respuesta.status };
  }
  return { audio: await respuesta.arrayBuffer() };
}

/**
 * Devuelve el MP3 de la locucion. `velocidad` permite ajustar el ritmo para que
 * el texto quepa en los 15 o 30 segundos de la pieza sin cortarse.
 *
 * El error se devuelve tal cual lo manda el proveedor: si falta saldo o la clave
 * esta restringida, hay que poder leerlo, no adivinarlo.
 */
export async function sintetizar(
  texto: string,
  voz: Voz,
  velocidad: number,
): Promise<{ audio: ArrayBuffer; modelo: string } | { error: string }> {
  const clave = claveVoz();
  if (!clave) {
    return { error: "No hay clave de sintesis de voz configurada en el despliegue." };
  }

  const forzado = process.env.TTS_MODELO;
  const candidatos = forzado ? [forzado] : MODELOS;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 25_000);
  const fallos: string[] = [];
  try {
    for (const modelo of candidatos) {
      const inicio = Date.now();
      try {
        const resultado = await pedirVoz(modelo, texto, voz, velocidad, clave, control.signal);
        registrar({
          traza: nuevaTraza(), tipo: "voz", modelo,
          ok: "audio" in resultado, ms: Date.now() - inicio,
          tokensEntrada: null, tokensSalida: null, caracteres: texto.length,
          error: "error" in resultado ? resultado.error.slice(0, 120) : null,
        });
        if ("audio" in resultado) return { audio: resultado.audio, modelo };
        fallos.push(`${modelo}: ${resultado.error}`);
        // 401, 403 y 429 no se arreglan cambiando de modelo: es la clave o el saldo.
        if ([401, 403, 429].includes(resultado.estado)) break;
      } catch (e) {
        fallos.push(`${modelo}: ${e instanceof Error ? e.message : "fallo de red"}`);
      }
    }
    return { error: fallos.join(" · ") || "No se ha podido sintetizar la voz." };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Une las locuciones de todas las escenas en un unico texto. Se separan con una
 * pausa marcada para que la voz respire entre plano y plano.
 */
export function guionHablado(locuciones: string[]) {
  return locuciones.map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean).join(" … ");
}

/**
 * Caracteres por segundo de una locucion comoda en espaniol. Por encima de esto
 * la voz suena atropellada, y una voz atropellada suena a maquina.
 */
const RITMO = 13;

/**
 * Velocidad de lectura para que el guion quepa en la pieza.
 *
 * El limite superior es deliberadamente bajo: antes llegaba a 1,25 y la voz
 * salia siempre acelerada, que es la causa principal de que sonara robotica. La
 * solucion correcta no es acelerar la voz sino acortar el texto, y de eso se
 * encarga recortarAlPresupuesto. Un guion corto leido despacio suena a persona.
 */
export function velocidadPara(texto: string, segundos: number) {
  const estimados = texto.length / RITMO;
  const hueco = segundos * 0.9;
  if (estimados <= hueco * 0.75) return 0.94; // sobra sitio: se lee con calma
  if (estimados <= hueco) return 1;
  return Math.min(1.12, estimados / hueco);
}

/**
 * Recorta cada linea hablada a lo que cabe en la pieza, cortando por final de
 * frase y nunca a mitad de palabra. Lo que se ve en pantalla no se toca: solo
 * se acorta lo que se pronuncia.
 */
export function recortarAlPresupuesto(locuciones: string[], segundos: number) {
  const limpias = locuciones.map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (!limpias.length) return limpias;
  const presupuesto = Math.floor(segundos * RITMO * 0.9);
  const porLinea = Math.max(30, Math.floor(presupuesto / limpias.length));

  return limpias.map((linea) => {
    if (linea.length <= porLinea) return linea;
    const trozo = linea.slice(0, porLinea);
    const frase = Math.max(trozo.lastIndexOf(". "), trozo.lastIndexOf("? "), trozo.lastIndexOf("! "));
    if (frase > porLinea * 0.5) return trozo.slice(0, frase + 1);
    const palabra = trozo.lastIndexOf(" ");
    return `${palabra > 0 ? trozo.slice(0, palabra) : trozo}.`;
  });
}

/**
 * Reparte las voces disponibles para que dos piezas seguidas no suenen iguales.
 * El tono marca el registro y la semilla — el destino — desempata dentro de el,
 * asi que la misma campania siempre suena igual pero dos destinos distintos no.
 */
const REGISTRO: Record<string, Voz[]> = {
  inspirador: ["nova", "shimmer", "alloy"],
  premium: ["onyx", "echo", "fable"],
  familiar: ["shimmer", "nova", "alloy"],
  aventurero: ["fable", "echo", "onyx"],
};

export function vozPara(tono: string, semilla: string): Voz {
  const opciones = REGISTRO[tono] ?? REGISTRO.inspirador;
  let suma = 0;
  for (const caracter of semilla) suma = (suma + caracter.charCodeAt(0)) % 9973;
  return opciones[suma % opciones.length];
}
