import snapshot from "@/data/snapshot.json";
import type { Destino, Frescura } from "@/types";

/**
 * Origen de los datos, por orden de preferencia:
 *
 *  1. Base de datos con el histórico de observaciones, si está configurada.
 *  2. La última observación real guardada en el repositorio.
 *
 * No existe un tercer camino. Si una métrica no tiene dato real, queda a null
 * y la interfaz lo dice. Nunca se genera un valor para rellenar una tarjeta.
 */

/**
 * Destinos retirados del catalogo comercial.
 *
 * Doce experiencias bien documentadas venden mas que quince a medias: cada una
 * necesita motivos escritos a mano, precio ancla revisado y material visual que
 * la represente. Estos tres se retiran por solaparse con otros que ya cubren el
 * mismo perfil de cliente — dos playas espaniolas mas y una ciudad europea mas
 * no aniaden decision, solo alargan la lista.
 *
 * Es una decision comercial, no tecnica: no se borra nada de la base de datos.
 * Su historico de seniales se sigue guardando y devolverlos al catalogo es
 * quitarlos de esta lista.
 */
export const RETIRADOS = ["Tenerife", "Praga", "Ámsterdam"];

function enCatalogo(destinos: Destino[]) {
  return destinos.filter((d) => !RETIRADOS.includes(d.destino));
}

export type OrigenDatos = {
  modo: "base-de-datos" | "ultima-observacion";
  frescura: Frescura;
  ingestadoEn: string | null;
  detalle: string;
};

const SNAPSHOT = snapshot as unknown as {
  meta: { ingestadoEn: string; fuentes: string[] };
  destinos: Destino[];
};

function desdeSnapshot(): { destinos: Destino[]; origen: OrigenDatos } {
  return {
    destinos: enCatalogo(SNAPSHOT.destinos),
    origen: {
      modo: "ultima-observacion",
      frescura: frescuraDe(SNAPSHOT.meta.ingestadoEn),
      ingestadoEn: SNAPSHOT.meta.ingestadoEn,
      detalle: "Última observación real guardada en el repositorio",
    },
  };
}

/** La frescura es un hecho medido sobre la fecha de ingesta, no una etiqueta. */
export function frescuraDe(ingestadoEn: string | null, horasEsperadas = 24): Frescura {
  if (!ingestadoEn) return "unavailable";
  const horas = (Date.now() - new Date(ingestadoEn).getTime()) / 3_600_000;
  if (horas < 1) return "live";
  if (horas < horasEsperadas) return "fresh";
  if (horas < horasEsperadas * 7) return "cached";
  return "stale";
}

export const ETIQUETA_FRESCURA: Record<Frescura, string> = {
  live: "En directo",
  fresh: "Actualizado",
  "official-latest": "Último dato oficial",
  cached: "Dato real guardado",
  stale: "Sin actualizar",
  unavailable: "Sin datos",
};

export async function cargarDestinos(): Promise<{ destinos: Destino[]; origen: OrigenDatos }> {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return desdeSnapshot();

  try {
    const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}` };
    const [expRes, senRes] = await Promise.all([
      fetch(`${url}/rest/v1/experiencias?select=*`, { headers: cabeceras, cache: "no-store" }),
      fetch(`${url}/rest/v1/senales?select=*`, { headers: cabeceras, cache: "no-store" }),
    ]);
    if (!expRes.ok || !senRes.ok) return desdeSnapshot();

    const filas = (await expRes.json()) as Record<string, unknown>[];
    const senales = (await senRes.json()) as Record<string, unknown>[];
    if (!Array.isArray(filas) || filas.length === 0) return desdeSnapshot();

    const destinos: Destino[] = filas.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      destino: String(f.destino),
      pais: String(f.pais),
      lat: Number(f.lat),
      lon: Number(f.lon),
      tipo: String(f.tipo),
      iata: (f.iata as string) ?? null,
      wiki: (f.wiki as string) ?? null,
      enCampana: f.en_campana === true,
      precioDesdePp: Number(f.precio_desde_pp),
      noches: Number(f.noches),
      temporada: String(f.temporada_agencia),
      horasVuelo: Number(f.horas_vuelo),
      visado: String(f.visado),
      aptoNinos: f.apto_ninos as Destino["aptoNinos"],
      intensidad: Number(f.intensidad),
      margenPct: Number(f.margen_pct),
      cupo: Number(f.cupo),
      motivos: [f.motivo_1, f.motivo_2, f.motivo_3].filter(Boolean).map(String),
      noRecomendadoSi: String(f.no_recomendado_si ?? ""),
      senales: senales
        .filter((s) => s.destino_id === f.id)
        .map((s) => ({
          fuente: s.fuente as Destino["senales"][number]["fuente"],
          metrica: String(s.metrica),
          valor: s.valor === null ? null : Number(s.valor),
          periodo: String(s.periodo),
          estado: s.estado as Destino["senales"][number]["estado"],
          obtenidoEn: (s.obtenido_en as string) ?? null,
        })),
    }));

    const catalogo = enCatalogo(destinos);

    const ultima = catalogo
      .flatMap((d) => d.senales.map((s) => s.obtenidoEn))
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1) ?? null;

    return {
      destinos: catalogo,
      origen: {
        modo: "base-de-datos",
        frescura: frescuraDe(ultima),
        ingestadoEn: ultima,
        detalle: "Histórico de observaciones de la plataforma",
      },
    };
  } catch {
    return desdeSnapshot();
  }
}

export async function cargarDestino(id: string) {
  const { destinos, origen } = await cargarDestinos();
  const destino = destinos.find((d) => d.id === id || d.destino.toLowerCase() === id.toLowerCase());
  return { destino: destino ?? null, origen };
}
