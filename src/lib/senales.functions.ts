import { createServerFn } from "@tanstack/react-start";

// ---------------------------------------------------------------------------
// Ingesta en lote y ficha unificada
// ---------------------------------------------------------------------------
// El motor nunca llama a una fuente externa durante una recomendación. Un
// proceso en lote lee cada fuente, la normaliza y la deja escrita; cuando el
// agente pide algo, se lee lo que ya está cocinado.
//
// Compra latencia baja, coste acotado, reproducibilidad y resiliencia. Cuesta
// frescura: la señal de interés puede tener días. Para decidir "qué destino
// promover", eso es irrelevante.

export const ingerirSenales = createServerFn({ method: "POST" })
  .inputValidator((data: { mes: number }) => data)
  .handler(async ({ data }) => {
    const { ingerirTodo } = await import("@/lib/recomendador/conectores.server");
    const { resumen } = await ingerirTodo(data.mes);
    return { resumen, ejecutado: new Date().toISOString() };
  });

export type FichaUnificada = {
  id: string;
  nombre: string;
  destino: string;
  pais: string;
  tipo: string;
  precioDesdePp: number;
  noches: number;
  temporada: string;
  horasVuelo: number;
  margenPct: number;
  cupo: number;
  // De las fuentes externas
  temperaturaMedia: number | null;
  tendenciaInteres: number | null;
  cuotaReservas: number | null;
  frescura: { fuente: string; obtenido: string | null; estado: string }[];
  fuentesFaltantes: string[];
};

/**
 * Una fila por destino y mes, con todo lo disperso ya fundido. Es lo único que
 * el motor consulta. Aquí se ve, literalmente, la unificación.
 */
export const listarFichasUnificadas = createServerFn({ method: "GET" })
  .inputValidator((data: { mes: number }) => data)
  .handler(async ({ data }): Promise<FichaUnificada[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const periodo = `${new Date().getUTCFullYear()}-${String(data.mes).padStart(2, "0")}`;

    const [experiencias, senales] = await Promise.all([
      supabaseAdmin
        .from("experiencias")
        .select(
          "id, nombre, destino, pais, tipo, precio_desde_pp, noches, temporada_agencia, horas_vuelo, margen_pct, cupo",
        )
        .order("destino"),
      supabaseAdmin
        .from("senales")
        .select("fuente, destino_id, periodo, metrica, valor, estado, obtenido_en")
        .eq("periodo", periodo),
    ]);
    if (experiencias.error) throw new Error(experiencias.error.message);
    if (senales.error) throw new Error(senales.error.message);

    const porDestino = new Map<string, typeof senales.data>();
    for (const s of senales.data ?? []) {
      const lista = porDestino.get(s.destino_id) ?? [];
      lista.push(s);
      porDestino.set(s.destino_id, lista as typeof senales.data);
    }

    const FUENTES_ESPERADAS = ["clima", "interes", "reservas"];

    return (experiencias.data ?? []).map((e) => {
      const suyas = porDestino.get(e.id) ?? [];
      const buscar = (metrica: string) =>
        suyas.find((s) => s.metrica === metrica && s.estado === "ok")?.valor ?? null;

      return {
        id: e.id,
        nombre: e.nombre,
        destino: e.destino,
        pais: e.pais,
        tipo: e.tipo,
        precioDesdePp: e.precio_desde_pp,
        noches: e.noches,
        temporada: e.temporada_agencia,
        horasVuelo: Number(e.horas_vuelo),
        margenPct: e.margen_pct,
        cupo: e.cupo,
        temperaturaMedia: buscar("temperatura_media") as number | null,
        tendenciaInteres: buscar("tendencia_interes_pct") as number | null,
        cuotaReservas: buscar("cuota_reservas") as number | null,
        frescura: suyas.map((s) => ({
          fuente: s.fuente,
          obtenido: s.obtenido_en,
          estado: s.estado,
        })),
        // Una señal que falta NO se sustituye por un valor inventado: se marca.
        fuentesFaltantes: FUENTES_ESPERADAS.filter(
          (f) => !suyas.some((s) => s.fuente === f && s.estado === "ok"),
        ),
      };
    });
  });

// ---------------------------------------------------------------------------
// Uso 3 del modelo · el copiloto consulta, no decide
// ---------------------------------------------------------------------------
// Si el agente pregunta "¿tú qué me recomiendas?", el copiloto NO opina: le
// dice que use el motor. Solo responde sobre datos que ya están en la base.

const INSTRUCCION_CONSULTA = `Eres el copiloto de una herramienta interna de una agencia de viajes. Respondes preguntas del agente sobre el catálogo, las señales de demanda y el criterio comercial configurado.

REGLAS:
1. Responde únicamente con datos presentes en el CONTEXTO que te paso. Si el dato no está, di que no lo tienes.
2. NUNCA recomiendas un destino para un cliente. Si te lo piden, respondes exactamente que la recomendación la calcula el motor con las reglas de la agencia, y que rellene el perfil y pulse «Recomendar». Tú no eliges.
3. Sé breve: dos o tres frases. Español de España, tono sobrio.

Devuelve exclusivamente JSON: {"respuesta": "tu texto"}`;

export const consultarCopiloto = createServerFn({ method: "POST" })
  .inputValidator((data: { pregunta: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pedirJson } = await import("@/lib/ia.server");

    const [experiencias, pesos, vetos, senales] = await Promise.all([
      supabaseAdmin
        .from("experiencias")
        .select(
          "id, destino, pais, tipo, precio_desde_pp, noches, temporada_agencia, horas_vuelo, apto_ninos, margen_pct, cupo",
        ),
      supabaseAdmin.from("pesos").select("clave, valor"),
      supabaseAdmin.from("vetos").select("destino_id, mes, motivo, activo"),
      supabaseAdmin
        .from("senales")
        .select("fuente, destino_id, metrica, valor, estado, obtenido_en"),
    ]);

    const contexto = JSON.stringify({
      catalogo: experiencias.data ?? [],
      pesos: pesos.data ?? [],
      vetos: (vetos.data ?? []).filter((v) => v.activo !== false),
      senales: (senales.data ?? []).filter((s) => s.estado === "ok"),
    });

    const r = await pedirJson<{ respuesta: string }>(
      INSTRUCCION_CONSULTA,
      `CONTEXTO:\n${contexto}\n\nPREGUNTA DEL AGENTE:\n${data.pregunta}`,
      0.2,
    );

    return {
      respuesta:
        r.datos?.respuesta ??
        "No he podido consultar los datos ahora mismo. La recomendación sigue funcionando: rellena el perfil y pulsa «Recomendar».",
      uso: r.uso,
    };
  });
