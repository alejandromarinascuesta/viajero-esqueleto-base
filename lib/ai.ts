import type { Destino, Perfil } from "@/types";

/**
 * El proveedor del modelo es intercambiable por variable de entorno: cualquier
 * API compatible con OpenAI sirve. Y si no hay ninguna configurada, el sistema
 * **sigue funcionando**: la extracción del perfil es determinista y el
 * argumento cae a los motivos del catálogo.
 */
export type UsoModelo = {
  ok: boolean;
  ms: number;
  modelo: string;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  error: string | null;
};

type Proveedor = { familia: "anthropic" | "openai"; url: string; modelo: string; clave: string };

/**
 * Acepta claves de Anthropic y de cualquier API compatible con OpenAI, y lo
 * detecta por el prefijo. Cambiar de proveedor es cambiar una variable de
 * entorno, no tocar codigo: la IA esta en los bordes del sistema, no dentro.
 */
function proveedor(): Proveedor | null {
  // Se acepta el nombre propio del proyecto, el que usa esta instalacion y los
  // canonicos de cada proveedor, para que la clave funcione se llame como se
  // llame en el entorno de despliegue.
  const clave =
    process.env.IA_API_KEY ??
    process.env.Claude_LLM ??
    process.env.CLAUDE_LLM ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY;
  if (!clave) return null;
  const anthropic = clave.startsWith("sk-ant-");
  return {
    familia: anthropic ? "anthropic" : "openai",
    url:
      process.env.IA_URL ??
      (anthropic
        ? "https://api.anthropic.com/v1/messages"
        : "https://api.openai.com/v1/chat/completions"),
    modelo: process.env.IA_MODELO ?? (anthropic ? "claude-sonnet-4-5" : "gpt-5-mini"),
    clave,
  };
}

export function hayModelo(): boolean {
  return proveedor() !== null;
}

function extraerJson(texto: string): unknown | null {
  const limpio = texto.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const a = limpio.indexOf("{");
    const b = limpio.lastIndexOf("}");
    if (a === -1 || b <= a) return null;
    try {
      return JSON.parse(limpio.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}

export async function pedirJson<T>(
  instruccion: string,
  entrada: string,
  temperatura = 0,
): Promise<{ datos: T | null; uso: UsoModelo }> {
  const inicio = Date.now();
  const p = proveedor();
  const base: UsoModelo = {
    ok: false, ms: 0, modelo: p?.modelo ?? "sin proveedor",
    tokensEntrada: null, tokensSalida: null, error: null,
  };
  if (!p) return { datos: null, uso: { ...base, error: "sin clave de modelo configurada" } };

  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 20_000);
    const anthropic = p.familia === "anthropic";
    const r = await fetch(p.url, {
      method: "POST",
      headers: anthropic
        ? { "Content-Type": "application/json", "x-api-key": p.clave, "anthropic-version": "2023-06-01" }
        : { "Content-Type": "application/json", Authorization: `Bearer ${p.clave}` },
      body: JSON.stringify(
        anthropic
          ? {
              model: p.modelo,
              max_tokens: 1500,
              temperature: temperatura,
              system: instruccion,
              messages: [{ role: "user", content: entrada }],
            }
          : {
              model: p.modelo,
              temperature: temperatura,
              messages: [
                { role: "system", content: instruccion },
                { role: "user", content: entrada },
              ],
            },
      ),
      signal: control.signal,
    });
    clearTimeout(reloj);
    const ms = Date.now() - inicio;
    if (!r.ok) return { datos: null, uso: { ...base, ms, error: `el modelo respondió ${r.status}` } };

    const cuerpo = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      content?: { text?: string }[];
      usage?: {
        prompt_tokens?: number; completion_tokens?: number;
        input_tokens?: number; output_tokens?: number;
      };
    };
    const texto = anthropic
      ? (cuerpo.content ?? []).map((c) => c.text ?? "").join("")
      : (cuerpo.choices?.[0]?.message?.content ?? "");
    const datos = extraerJson(texto) as T | null;
    return {
      datos,
      uso: {
        ...base,
        ok: datos !== null,
        ms,
        tokensEntrada: cuerpo.usage?.prompt_tokens ?? cuerpo.usage?.input_tokens ?? null,
        tokensSalida: cuerpo.usage?.completion_tokens ?? cuerpo.usage?.output_tokens ?? null,
        error: datos === null ? "el modelo no devolvió JSON válido" : null,
      },
    };
  } catch (e) {
    return {
      datos: null,
      uso: { ...base, ms: Date.now() - inicio, error: e instanceof Error ? e.message : "fallo de red" },
    };
  }
}

export const INSTRUCCION_ARGUMENTO = `Eres el asistente de un agente de viajes. El sistema ya ha elegido estas experiencias. Tu único trabajo es redactar por qué encajan con este cliente.

REGLA ABSOLUTA: solo puedes usar información contenida en los campos que te paso. No puedes mencionar ningún dato, cifra, lugar, servicio o característica que no esté literalmente en esos campos. No sabes nada de estos destinos más allá de lo que te doy. Si te falta un dato para un argumento que te parecería bueno, no lo hagas: usa otro.

Tres frases por experiencia: por qué encaja con lo pedido; un dato concreto de la ficha que lo respalde; y si el cliente tiene una tensión declarada, cómo la resuelve.

Tono: agente con veinte años de oficio hablando con un cliente. Sobrio y directo. Nada de "descubre" ni "sumérgete". Frases cortas. Español de España.

En "campos_citados" pon el nombre exacto de cada campo del que has sacado información. Se comprueba automáticamente.

Devuelve exclusivamente: {"propuestas":[{"id":"...","argumento":["f1","f2","f3"],"campos_citados":["..."]}]}`;

export function contextoParaArgumento(perfil: Perfil, elegidos: Destino[]) {
  return JSON.stringify({
    perfil: {
      adultos: perfil.adultos,
      ninos: perfil.edadesNinos,
      presupuesto_total: perfil.presupuestoTotal,
      mes: perfil.mes,
      dias: perfil.dias,
      motivacion: perfil.motivacion,
      tension: perfil.tensionDeclarada,
    },
    experiencias: elegidos.map((d) => ({
      id: d.id,
      destino: d.destino,
      precio_desde_pp: d.precioDesdePp,
      noches: d.noches,
      horas_vuelo: d.horasVuelo,
      tipo: d.tipo,
      motivo_1: d.motivos[0] ?? null,
      motivo_2: d.motivos[1] ?? null,
      motivo_3: d.motivos[2] ?? null,
      temperatura_media: d.senales.find((s) => s.metrica === "temperatura_media" && s.estado === "ok")?.valor ?? null,
    })),
  });
}
