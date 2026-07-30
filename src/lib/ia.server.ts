// Cliente del modelo de lenguaje. Server-only.
//
// La IA interviene en tres sitios y solo tres: extraer un perfil de texto
// libre, redactar el argumento de las dos propuestas, y responder consultas
// del copiloto sobre datos que ya están en la base. En ninguno de los tres
// decide qué se recomienda.
//
// Si el modelo falla, la función devuelve null y quien llama degrada a un
// camino determinista. Nunca se inventa un valor para tapar un hueco.

// El proveedor del modelo es intercambiable por diseño: cualquier API
// compatible con OpenAI sirve. Sin esto, el producto quedaría atado al host.
//
//   IA_URL     endpoint de chat completions (opcional)
//   IA_MODELO  identificador del modelo (opcional)
//   IA_API_KEY clave propia (OpenAI, Anthropic vía proxy, Groq, etc.)
//
// Si no hay IA_API_KEY, se usa la pasarela del host (LOVABLE_API_KEY). Si no
// hay ninguna de las dos, las funciones devuelven null y quien llama degrada a
// un camino determinista.

type Proveedor = { url: string; modelo: string; clave: string; nombre: string } | null;

function proveedor(): Proveedor {
  const propia = process.env.IA_API_KEY;
  if (propia) {
    return {
      url: process.env.IA_URL ?? "https://api.openai.com/v1/chat/completions",
      modelo: process.env.IA_MODELO ?? "gpt-5-mini",
      clave: propia,
      nombre: "propio",
    };
  }
  const host = process.env.LOVABLE_API_KEY;
  if (host) {
    return {
      url: process.env.IA_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions",
      modelo: process.env.IA_MODELO ?? "google/gemini-2.5-flash",
      clave: host,
      nombre: "pasarela del host",
    };
  }
  return null;
}

export type UsoModelo = {
  ok: boolean;
  ms: number;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  modelo: string;
  error: string | null;
};

export type RespuestaModelo<T> = { datos: T | null; uso: UsoModelo };

function extraerJson(texto: string): unknown | null {
  const limpio = texto
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const desde = limpio.indexOf("{");
    const hasta = limpio.lastIndexOf("}");
    if (desde === -1 || hasta <= desde) return null;
    try {
      return JSON.parse(limpio.slice(desde, hasta + 1));
    } catch {
      return null;
    }
  }
}

export async function pedirJson<T>(
  instruccion: string,
  entrada: string,
  temperatura = 0,
): Promise<RespuestaModelo<T>> {
  const arranque = Date.now();
  const p = proveedor();
  const base: UsoModelo = {
    ok: false,
    ms: 0,
    tokensEntrada: null,
    tokensSalida: null,
    modelo: p?.modelo ?? "sin proveedor",
    error: null,
  };

  if (!p) {
    return {
      datos: null,
      uso: { ...base, error: "no hay clave de modelo configurada (IA_API_KEY o LOVABLE_API_KEY)" },
    };
  }

  try {
    const respuesta = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.clave}` },
      body: JSON.stringify({
        model: p.modelo,
        temperature: temperatura,
        messages: [
          { role: "system", content: instruccion },
          { role: "user", content: entrada },
        ],
      }),
    });

    const ms = Date.now() - arranque;
    if (!respuesta.ok) {
      return {
        datos: null,
        uso: { ...base, ms, error: `el modelo respondió ${respuesta.status}` },
      };
    }

    const cuerpo = (await respuesta.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const contenido = cuerpo.choices?.[0]?.message?.content ?? "";
    const datos = extraerJson(contenido) as T | null;

    return {
      datos,
      uso: {
        ...base,
        ok: datos !== null,
        ms,
        tokensEntrada: cuerpo.usage?.prompt_tokens ?? null,
        tokensSalida: cuerpo.usage?.completion_tokens ?? null,
        error: datos === null ? "el modelo no devolvió JSON válido" : null,
      },
    };
  } catch (e) {
    return {
      datos: null,
      uso: {
        ...base,
        ms: Date.now() - arranque,
        error: e instanceof Error ? e.message : "fallo de red",
      },
    };
  }
}

export async function pedirTexto(
  instruccion: string,
  entrada: string,
): Promise<{ texto: string | null; uso: UsoModelo }> {
  const r = await pedirJson<{ respuesta?: string }>(
    `${instruccion}\n\nDevuelve exclusivamente JSON: {"respuesta": "tu texto"}`,
    entrada,
  );
  return { texto: r.datos?.respuesta ?? null, uso: r.uso };
}
