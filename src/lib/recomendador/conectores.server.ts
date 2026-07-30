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
  fuente: "clima" | "interes" | "reservas";
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

type Destino = { id: string; destino: string; lat: number; lon: number; iata: string | null };

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

/**
 * Reservas reales — Amadeus, destinos más reservados desde una ciudad de origen.
 *
 * Por qué esta fuente y no scrapear un comparador: son las reservas efectivas
 * hechas en los sistemas de Amadeus, servidas por una API oficial. Un scraper
 * de un portal de reservas intentaría aproximar este mismo dato incumpliendo
 * términos de servicio y rompiéndose cuando cambie el HTML.
 *
 * Y aporta algo que ninguna otra fuente da: interés es atención, reserva es
 * intención consumada. Cruzar las dos es la lectura de negocio que sirve.
 *
 * El entorno de pruebas de Amadeus solo tiene datos de periodos concretos, así
 * que el periodo consultado es configurable (AMADEUS_PERIODO). Si no hay dato,
 * la señal se marca como no disponible: nunca se inventa un valor.
 */
async function conectorReservas(destinos: Destino[], mes: number): Promise<FilaSenal[]> {
  const periodo = `${new Date().getUTCFullYear()}-${String(mes).padStart(2, "0")}`;
  const sinDato = (d: Destino, motivo: string): FilaSenal => ({
    fuente: "reservas",
    destino_id: d.id,
    periodo,
    metrica: "cuota_reservas",
    valor: null,
    valor_bruto: { motivo },
    estado: "no_disponible",
  });

  const id = process.env.AMADEUS_CLIENT_ID;
  const secreto = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secreto) {
    return destinos.map((d) => sinDato(d, "sin credenciales de Amadeus"));
  }

  const base = process.env.AMADEUS_URL ?? "https://test.api.amadeus.com";
  const origen = process.env.AMADEUS_ORIGEN ?? "MAD";
  // El entorno de pruebas de Amadeus publica datos historicos concretos.
  const periodoConsulta = process.env.AMADEUS_PERIODO ?? "2017-08";

  try {
    const auth = await fetch(`${base}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secreto,
      }),
    });
    if (!auth.ok) {
      const detalle = await auth.text();
      return destinos.map((d) =>
        sinDato(d, `autenticacion ${auth.status}: ${detalle.slice(0, 120)}`),
      );
    }
    const { access_token } = (await auth.json()) as { access_token?: string };
    if (!access_token) return destinos.map((d) => sinDato(d, "la autenticacion no devolvio token"));

    const url = `${base}/v1/travel/analytics/air-traffic/booked?originCityCode=${origen}&period=${periodoConsulta}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!r.ok) {
      const detalle = await r.text();
      return destinos.map((d) => sinDato(d, `consulta ${r.status}: ${detalle.slice(0, 160)}`));
    }

    const cuerpo = (await r.json()) as {
      data?: {
        destination?: string;
        analytics?: { travelers?: { score?: number }; flights?: { score?: number } };
      }[];
    };
    const porCodigo = new Map<string, number>();
    for (const fila of cuerpo.data ?? []) {
      const codigo = fila.destination;
      const puntuacion = fila.analytics?.travelers?.score ?? fila.analytics?.flights?.score;
      if (codigo && typeof puntuacion === "number") porCodigo.set(codigo, puntuacion);
    }

    return destinos.map((d) => {
      if (!d.iata) return sinDato(d, "el destino no tiene codigo de ciudad");
      const puntuacion = porCodigo.get(d.iata);
      if (puntuacion === undefined) {
        return sinDato(d, `sin reservas desde ${origen} en ${periodoConsulta}`);
      }
      return {
        fuente: "reservas",
        destino_id: d.id,
        periodo,
        metrica: "cuota_reservas",
        valor: puntuacion,
        valor_bruto: { origen, periodo_consultado: periodoConsulta, iata: d.iata },
        estado: "ok",
      };
    });
  } catch (e) {
    return destinos.map((d) => sinDato(d, e instanceof Error ? e.message : "fallo de red"));
  }
}

export async function ingerirTodo(mes: number): Promise<{
  resumen: ResumenConector[];
  filas: FilaSenal[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("experiencias")
    .select("id, destino, lat, lon, iata");
  if (error) throw new Error(error.message);
  // Los tipos de Supabase estan autogenerados y todavia no incluyen la columna
  // iata, anadida por migracion. Se regeneran solos en el siguiente ciclo de la
  // plataforma; hasta entonces la conversion es explicita y esta acotada aqui.
  const destinos = (data ?? []) as unknown as Destino[];

  const resumen: ResumenConector[] = [];
  const filas: FilaSenal[] = [];

  for (const [fuente, descripcion, ejecutar] of [
    ["clima", "Open-Meteo · archivo histórico · sin clave", () => conectorClima(destinos, mes)],
    ["interes", "Wikipedia · vistas de página · sin clave", () => conectorInteres(destinos, mes)],
    [
      "reservas",
      "Amadeus · destinos más reservados · requiere clave",
      () => conectorReservas(destinos, mes),
    ],
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
