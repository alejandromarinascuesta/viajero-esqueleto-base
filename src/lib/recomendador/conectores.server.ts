// Conectores de fuentes externas. Server-only.
//
// Todas las fuentes, por distintas que sean, aterrizan en la MISMA forma:
// (fuente, destino_id, periodo, metrica, valor, valor_bruto, estado).
// Eso es lo que significa unificar datos dispersos. Añadir una sexta fuente
// es escribir un conector, no tocar el motor.
//
// La ingesta es en lote y está desacoplada del consumo: el motor nunca llama
// a una API externa durante una recomendación.

export type FilaSenal = {
  fuente: "clima" | "interes";
  destino_id: string;
  periodo: string;
  metrica: string;
  valor: number | null;
  valor_bruto: unknown;
  estado: "ok" | "no_disponible";
};

export type ResumenConector = {
  fuente: string;
  descripcion: string;
  ok: number;
  fallos: number;
  ms: number;
};

type Destino = { id: string; destino: string; lat: number; lon: number };

const mesesAtras = (n: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
};
const periodoDe = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Clima — Open-Meteo, archivo histórico. Gratuita y sin clave.
 * Se consulta el mismo mes del año anterior: el clima de agosto en Creta no
 * cambia esta semana, así que se cachea de forma permanente.
 */
async function conectorClima(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const anio = new Date().getUTCFullYear() - 1;
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, "0")}-${ultimoDia}`;
  const periodo = `${new Date().getUTCFullYear()}-${String(mes).padStart(2, "0")}`;

  return Promise.all(
    destinos.map(async (d): Promise<FilaSenal> => {
      const base: FilaSenal = {
        fuente: "clima",
        destino_id: d.id,
        periodo,
        metrica: "temperatura_media",
        valor: null,
        valor_bruto: null,
        estado: "no_disponible",
      };
      try {
        const url =
          `https://archive-api.open-meteo.com/v1/archive?latitude=${d.lat}&longitude=${d.lon}` +
          `&start_date=${desde}&end_date=${hasta}&daily=temperature_2m_mean&timezone=UTC`;
        const r = await fetch(url);
        if (!r.ok) return base;
        const j = (await r.json()) as { daily?: { temperature_2m_mean?: (number | null)[] } };
        const serie = (j.daily?.temperature_2m_mean ?? []).filter(
          (v): v is number => typeof v === "number",
        );
        if (serie.length === 0) return base;
        const media = serie.reduce((a, b) => a + b, 0) / serie.length;
        return {
          ...base,
          valor: Math.round(media * 10) / 10,
          valor_bruto: { dias: serie.length, anio_referencia: anio },
          estado: "ok",
        };
      } catch {
        return base;
      }
    }),
  );
}

/**
 * Interés — vistas de página de Wikipedia en español.
 *
 * Por qué esta fuente y no Google Trends: es una API oficial, gratuita y sin
 * clave, así que no depende de un scraper que puede caerse en producción.
 * Mide lo mismo que Trends —atención sobre un destino— y comparte su misma
 * limitación, que hay que reconocer: es interés, no intención de compra.
 *
 * Normalización: media de los 3 últimos meses frente a los 3 anteriores. El
 * valor guardado es la variación porcentual, que es lo accionable.
 */
async function conectorInteres(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}0100`;
  const desde = fmt(mesesAtras(6));
  const hasta = fmt(mesesAtras(0));
  // Mismo periodo que el resto de fuentes, para que la ficha unificada cuadre.
  const periodo = `${new Date().getUTCFullYear()}-${String(mes).padStart(2, "0")}`;

  return Promise.all(
    destinos.map(async (d): Promise<FilaSenal> => {
      const base: FilaSenal = {
        fuente: "interes",
        destino_id: d.id,
        periodo,
        metrica: "tendencia_interes_pct",
        valor: null,
        valor_bruto: null,
        estado: "no_disponible",
      };
      try {
        const titulo = encodeURIComponent(d.destino.replace(/ /g, "_"));
        const url =
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/` +
          `all-access/user/${titulo}/monthly/${desde}/${hasta}`;
        const r = await fetch(url, { headers: { "User-Agent": "recomendador-agencia/1.0" } });
        if (!r.ok) return base;
        const j = (await r.json()) as { items?: { timestamp: string; views: number }[] };
        const serie = (j.items ?? []).map((i) => i.views);
        if (serie.length < 4) return base;

        const recientes = serie.slice(-3);
        const previos = serie.slice(-6, -3);
        const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        const anterior = media(previos);
        if (anterior === 0) return base;
        const variacion = ((media(recientes) - anterior) / anterior) * 100;

        return {
          ...base,
          valor: Math.round(variacion * 10) / 10,
          valor_bruto: { serie, meses: serie.length },
          estado: "ok",
        };
      } catch {
        return base;
      }
    }),
  );
}

export async function ingerirTodo(mes: number): Promise<{
  resumen: ResumenConector[];
  filas: FilaSenal[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("experiencias").select("id, destino, lat, lon");
  if (error) throw new Error(error.message);
  const destinos = (data ?? []) as Destino[];

  const resumen: ResumenConector[] = [];
  const filas: FilaSenal[] = [];

  for (const [fuente, descripcion, ejecutar] of [
    ["clima", "Open-Meteo · archivo histórico · sin clave", () => conectorClima(destinos, mes)],
    ["interes", "Wikipedia · vistas de página · sin clave", () => conectorInteres(destinos, mes)],
  ] as const) {
    const arranque = Date.now();
    const resultado = await ejecutar();
    filas.push(...resultado);
    resumen.push({
      fuente,
      descripcion,
      ok: resultado.filter((f) => f.estado === "ok").length,
      fallos: resultado.filter((f) => f.estado !== "ok").length,
      ms: Date.now() - arranque,
    });
  }

  if (filas.length > 0) {
    const { error: errorEscritura } = await supabaseAdmin.from("senales").upsert(
      filas.map((f) => ({
        fuente: f.fuente,
        destino_id: f.destino_id,
        periodo: f.periodo,
        metrica: f.metrica,
        valor: f.valor,
        valor_bruto: f.valor_bruto as never,
        estado: f.estado,
        obtenido_en: new Date().toISOString(),
      })),
      { onConflict: "fuente,destino_id,periodo,metrica" },
    );
    if (errorEscritura) throw new Error(errorEscritura.message);
  }

  return { resumen, filas };
}
