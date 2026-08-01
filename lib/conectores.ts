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
  fuente: "clima" | "interes" | "divisa";
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

  /** Una edicion de Wikipedia. Devuelve null si no hay serie utilizable. */
  async function serieDe(edicion: string, titulo: string) {
    const r = await conReintento(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${edicion}/` +
        `all-access/user/${encodeURIComponent(titulo.replace(/ /g, "_"))}/daily/${desde}/${hasta}`,
      { headers: { "User-Agent": "travel-intelligence/1.0 (caso practico)" } },
    );
    if (!r || !r.ok) return { serie: null as number[] | null, motivo: `${edicion}: ${r ? r.status : "sin respuesta"}` };
    const j = (await r.json()) as { items?: { timestamp: string; views: number }[] };
    const serie = (j.items ?? []).map((i) => i.views);
    if (serie.length < 40) return { serie: null, motivo: `${edicion}: solo ${serie.length} dias` };
    // Con muy pocas visitas al dia el porcentaje es ruido, no senal.
    const media = serie.reduce((a, b) => a + b, 0) / serie.length;
    if (media < 30) return { serie: null, motivo: `${edicion}: trafico demasiado bajo (${Math.round(media)}/dia)` };
    return { serie, motivo: "" };
  }

  return enTandas(destinos, async (d): Promise<FilaSenal> => {
    const base: FilaSenal = {
      fuente: "interes", destino_id: d.id, periodo, metrica: "tendencia_interes_pct",
      valor: null, valor_bruto: null, estado: "no_disponible",
    };
    const titulo = d.wiki ?? d.destino;
    try {
      // Espanol primero porque el mercado emisor es Espana. Si el articulo tiene
      // poco trafico —pasa con destinos lejanos como Zanzibar o Maldivas— se cae
      // a la edicion inglesa, que para esos destinos es mucho mas solida.
      let edicion = "es.wikipedia";
      const primero = await serieDe(edicion, titulo);
      let serie = primero.serie;
      if (!serie) {
        edicion = "en.wikipedia";
        const alterno = await serieDe(edicion, titulo);
        if (alterno.serie) {
          serie = alterno.serie;
        } else {
          return {
            ...base,
            valor_bruto: { motivo: `${primero.motivo} · ${alterno.motivo}`, articulo: titulo },
          };
        }
      }

      const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const recientes = media(serie.slice(-28));
      const previos = media(serie.slice(-56, -28));
      if (previos === 0) return { ...base, valor_bruto: { motivo: "ventana previa sin visitas" } };

      return {
        ...base,
        valor: Math.round(((recientes - previos) / previos) * 1000) / 10,
        valor_bruto: {
          articulo: titulo,
          edicion,
          dias: serie.length,
          media_28d: Math.round(recientes),
          media_28d_previos: Math.round(previos),
        },
        estado: "ok",
      };
    } catch (e) {
      return { ...base, valor_bruto: { motivo: e instanceof Error ? e.message : "fallo de red" } };
    }
  });
}

/**
 * Divisa — Banco Central Europeo. Oficial, gratuita y sin clave.
 *
 * Para que sirve: un destino cuya moneda se ha depreciado frente al euro se ha
 * abaratado en la practica aunque su precio de catalogo no haya cambiado. Es
 * una senal de oportunidad que ninguna otra fuente da.
 *
 * Los tipos de referencia se publican cada dia laborable sobre las 16:00 CET.
 */
const MONEDA_POR_PAIS: Record<string, string> = {
  "Estados Unidos": "USD", México: "MXN", Marruecos: "MAD", Indonesia: "IDR",
  Emiratos: "AED", Tailandia: "THB", Japón: "JPY", "Costa Rica": "CRC",
  Maldivas: "MVR", Tanzania: "TZS", Egipto: "EGP", Islandia: "ISK",
  Chequia: "CZK", Croacia: "EUR", Reino_Unido: "GBP",
};

export async function conectorDivisa(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const periodo = periodoDe(mes);
  const base = (d: Destino, motivo: string): FilaSenal => ({
    fuente: "divisa", destino_id: d.id, periodo, metrica: "variacion_divisa_pct",
    valor: null, valor_bruto: { motivo }, estado: "no_disponible",
  });

  const necesarias = [...new Set(
    destinos.map((d) => MONEDA_POR_PAIS[d.pais]).filter((m): m is string => Boolean(m) && m !== "EUR"),
  )];
  if (necesarias.length === 0) return destinos.map((d) => base(d, "destino en euros"));

  const hoy = new Date();
  const hace90 = new Date(hoy.getTime() - 90 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const r = await conReintento(
      `https://data-api.ecb.europa.eu/service/data/EXR/D.${necesarias.join("+")}.EUR.SP00.A` +
        `?startPeriod=${iso(hace90)}&endPeriod=${iso(hoy)}&format=jsondata&detail=dataonly`,
    );
    if (!r || !r.ok) return destinos.map((d) => base(d, `respuesta ${r?.status ?? "sin respuesta"}`));

    const j = (await r.json()) as {
      dataSets?: { series?: Record<string, { observations?: Record<string, (number | null)[]> }> }[];
      structure?: { dimensions?: { series?: { id: string; values: { id: string }[] }[] } };
    };
    const dims = j.structure?.dimensions?.series ?? [];
    const idxMoneda = dims.findIndex((x) => x.id === "CURRENCY");
    const series = j.dataSets?.[0]?.series ?? {};

    const variacion: Record<string, number> = {};
    for (const [clave, valor] of Object.entries(series)) {
      const posicion = Number(clave.split(":")[idxMoneda]);
      const moneda = dims[idxMoneda]?.values[posicion]?.id;
      const obs = Object.entries(valor.observations ?? {})
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, v]) => v?.[0])
        .filter((v): v is number => typeof v === "number");
      if (!moneda || obs.length < 2) continue;
      // Sube el tipo = hacen falta mas unidades por euro = el destino se abarata.
      variacion[moneda] = Math.round(((obs.at(-1)! - obs[0]) / obs[0]) * 1000) / 10;
    }

    return destinos.map((d) => {
      const moneda = MONEDA_POR_PAIS[d.pais];
      if (!moneda || moneda === "EUR") return base(d, "destino en euros");
      const v = variacion[moneda];
      if (v === undefined) return base(d, `sin serie para ${moneda}`);
      return {
        fuente: "divisa", destino_id: d.id, periodo, metrica: "variacion_divisa_pct",
        valor: v, valor_bruto: { moneda, ventana: "90 dias" }, estado: "ok",
      };
    });
  } catch (e) {
    return destinos.map((d) => base(d, e instanceof Error ? e.message : "fallo de red"));
  }
}
