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

/**
 * Devuelve el MP3 de la locucion. `velocidad` permite ajustar el ritmo para que
 * el texto quepa en los 15 o 30 segundos de la pieza sin cortarse.
 */
export async function sintetizar(
  texto: string,
  voz: Voz,
  velocidad: number,
): Promise<{ audio: ArrayBuffer; modelo: string } | { error: string }> {
  const clave = claveVoz();
  if (!clave) return { error: "No hay clave de sintesis de voz configurada." };

  const modelo = process.env.TTS_MODELO ?? "gpt-4o-mini-tts";
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 25_000);
  try {
    const respuesta = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal: control.signal,
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        voice: voz,
        input: texto.slice(0, 1800),
        speed: Math.min(1.25, Math.max(0.85, velocidad)),
        response_format: "mp3",
        instructions:
          "Locucion publicitaria en espaniol de Espania. Tono calido y natural, ritmo agil, " +
          "como una agente de viajes con oficio contando algo que le apetece contar. " +
          "Nada de voz de telediario ni de locutor de anuncio antiguo.",
      }),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      return { error: `La sintesis de voz respondio ${respuesta.status}: ${detalle.slice(0, 160)}` };
    }
    return { audio: await respuesta.arrayBuffer(), modelo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se ha podido sintetizar la voz." };
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
 * Estima cuanto durara la locucion y devuelve la velocidad necesaria para que
 * quepa en la pieza. Referencia: unos 14 caracteres por segundo en espaniol a
 * ritmo publicitario.
 */
export function velocidadPara(texto: string, segundos: number) {
  const estimados = texto.length / 14;
  if (estimados <= segundos * 0.92) return 1;
  return Math.min(1.25, estimados / (segundos * 0.92));
}
