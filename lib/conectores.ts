import type { Destino } from "@/types";

/**
 * Conectores de fuentes externas.
 *
 * Todas aterrizan en la MISMA forma —fuente, destino, periodo, metrica, valor,
 * estado y cuando se obtuvo— aunque una sea un archivo climatico estable y otra
 * una serie diaria de visitas. Eso es lo que significa unificar datos dispersos:
 * anadir una fuente es escribir un conector, no tocar el motor.
 *
 * Cuando una fuente no devuelve dato se guarda el MOTIVO. El sistema se
 * autodiagnostica en vez de decir solo «sin dato».
 */

export type FilaSenal = {
  fuente: "clima" | "interes";
  destino_id: string;
  periodo: string;
  metrica: string;
  valor: number | null;
  valor_bruto: unknown;
  estado: "ok" | "no_disponible";
};

export type ResumenFuente = { fuente: string; detalle: string; ok: number; fallos: number; ms: number };

/**
 * Tandas pequenas con pausa. Lanzar 30 peticiones simultaneas contra una API
 * publica hace que limite por ritmo: la primera ingesta real trajo dato de 17 de
 * 30 en clima y 10 de 30 en interes, con las dos fuentes fallando a la vez. Ese
 * es el patron de un limite de ritmo, no de datos que no existen.
 */
async function enTandas<T, R>(xs: T[], tarea: (x: T) => Promise<R>, tam = 5, pausa = 300): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < xs.length; i += tam) {
    salida.push(...(await Promise.all(xs.slice(i, i + tam).map(tarea))));
    if (i + tam < xs.length) await new Promise((r) => setTimeout(r, pausa));
  }
  return salida;
}

async function conReintento(url: string, opciones?: RequestInit): Promise<Response | null> {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(url, opciones);
      if (r.ok) return r;
      if (r.status !== 429 && r.status < 500) return r;
    } catch {
      // se reintenta
    }
    await new Promise((r) => setTimeout(r, 500 * (intento + 1)));
  }
  return null;
}

const periodoDe = (mes: number) =>
  `${new Date().getUTCFullYear()}-${String(mes).padStart(2, "0")}`;

/**
 * Clima — Open-Meteo, archivo historico. Gratuita y sin clave.
 * Se consulta el mismo mes del ano anterior: el clima de agosto en Creta no
 * cambia esta semana.
 */
export async function conectorClima(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const anio = new Date().getUTCFullYear() - 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta = `${anio}-${String(mes).padStart(2, "0")}-${ultimo}`;
  const periodo = periodoDe(mes);

  return enTandas(destinos, async (d): Promise<FilaSenal> => {
    const base: FilaSenal = {
      fuente: "clima", destino_id: d.id, periodo, metrica: "temperatura_media",
      valor: null, valor_bruto: null, estado: "no_disponible",
    };
    try {
      const r = await conReintento(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${d.lat}&longitude=${d.lon}` +
          `&start_date=${desde}&end_date=${hasta}&daily=temperature_2m_mean&timezone=UTC`,
      );
      if (!r) return { ...base, valor_bruto: { motivo: "sin respuesta tras reintentos" } };
      if (!r.ok) return { ...base, valor_bruto: { motivo: `respuesta ${r.status}` } };
      const j = (await r.json()) as { daily?: { temperature_2m_mean?: (number | null)[] } };
      const serie = (j.daily?.temperature_2m_mean ?? []).filter((v): v is number => typeof v === "number");
      if (serie.length === 0) return { ...base, valor_bruto: { motivo: "serie vacia" } };
      const media = serie.reduce((a, b) => a + b, 0) / serie.length;
      return {
        ...base,
        valor: Math.round(media * 10) / 10,
        valor_bruto: { dias: serie.length, anio_referencia: anio },
        estado: "ok",
      };
    } catch (e) {
      return { ...base, valor_bruto: { motivo: e instanceof Error ? e.message : "fallo de red" } };
    }
  });
}

/**
 * Interes — vistas de pagina de Wikipedia en espanol, con granularidad DIARIA.
 *
 * Por que esta fuente y no Google Trends: es una API oficial, gratuita y sin
 * clave, asi que no depende de un scraper que puede caerse en produccion. Mide
 * lo mismo —atencion sobre un destino— y comparte su limitacion, que hay que
 * reconocer: es interes, no intencion de compra.
 *
 * Ventanas de 28 dias frente a los 28 anteriores: el multiplo de 7 cancela el
 * efecto del dia de la semana. Se descartan los 2 ultimos dias porque Wikipedia
 * publica con retraso y vendrian incompletos.
 */
export async function conectorInteres(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const dias = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };
  const hasta = fmt(dias(2));
  const desde = fmt(dias(58));
  const periodo = periodoDe(mes);

  return enTandas(destinos, async (d): Promise<FilaSenal> => {
    const base: FilaSenal = {
      fuente: "interes", destino_id: d.id, periodo, metrica: "tendencia_interes_pct",
      valor: null, valor_bruto: null, estado: "no_disponible",
    };
    const titulo = d.wiki ?? d.destino;
    try {
      const r = await conReintento(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/` +
          `all-access/user/${encodeURIComponent(titulo.replace(/ /g, "_"))}/daily/${desde}/${hasta}`,
        { headers: { "User-Agent": "travel-intelligence/1.0 (caso practico)" } },
      );
      if (!r) return { ...base, valor_bruto: { motivo: "sin respuesta tras reintentos" } };
      if (!r.ok) {
        return {
          ...base,
          valor_bruto: {
            motivo: r.status === 404 ? `no existe el articulo «${titulo}»` : `respuesta ${r.status}`,
          },
        };
      }
      const j = (await r.json()) as { items?: { timestamp: string; views: number }[] };
      const serie = (j.items ?? []).map((i) => i.views);
      if (serie.length < 40) return { ...base, valor_bruto: { motivo: `solo ${serie.length} dias de serie` } };

      const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const recientes = media(serie.slice(-28));
      const previos = media(serie.slice(-56, -28));
      if (previos === 0) return { ...base, valor_bruto: { motivo: "ventana previa sin visitas" } };

      return {
        ...base,
        valor: Math.round(((recientes - previos) / previos) * 1000) / 10,
        valor_bruto: {
          articulo: titulo,
          dias: serie.length,
          media_28d: Math.round(recientes),
          media_28d_previos: Math.round(previos),
          hasta: (j.items ?? []).at(-1)?.timestamp ?? null,
        },
        estado: "ok",
      };
    } catch (e) {
      return { ...base, valor_bruto: { motivo: e instanceof Error ? e.message : "fallo de red" } };
    }
  });
}
