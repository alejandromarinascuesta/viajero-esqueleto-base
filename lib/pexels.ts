import type { ActivoVisual, Destino } from "@/types";

/**
 * Banco de material visual para el Content Studio.
 *
 * Wikimedia Commons es un archivo enciclopedico: sirve para documentar, no para
 * vender un viaje. En vertical apenas tiene video, y las fotos son de registro,
 * no de campania. Pexels es un banco comercial con licencia libre, con clips
 * grabados en 9:16 y sin exigir atribucion. Aun asi aqui se guarda el autor y el
 * enlace de origen, porque una agencia tiene que poder justificar de donde sale
 * cada plano que publica.
 *
 * Commons se conserva como respaldo en lib/media.ts: si maniana Pexels cambia
 * las condiciones, la plataforma sigue devolviendo material.
 */

const RAIZ_VIDEO = "https://api.pexels.com/videos/search";
const RAIZ_FOTO = "https://api.pexels.com/v1/search";

export const DOMINIOS_PEXELS = ["images.pexels.com", "videos.pexels.com", "player.vimeo.com"];

type FicheroVideo = {
  id?: number;
  quality?: string;
  file_type?: string;
  width?: number | null;
  height?: number | null;
  link?: string;
};

type VideoPexels = {
  id?: number;
  width?: number;
  height?: number;
  duration?: number;
  url?: string;
  image?: string;
  user?: { name?: string; url?: string };
  video_files?: FicheroVideo[];
};

type FotoPexels = {
  id?: number;
  width?: number;
  height?: number;
  url?: string;
  alt?: string;
  photographer?: string;
  photographer_url?: string;
  src?: Record<string, string>;
};

/**
 * Consultas editoriales por destino. Son terminos visuales, no datos de
 * negocio: describen que lugar debe verse en pantalla. Sin esto, "Creta"
 * devuelve cualquier cosa rodada en Grecia y la pieza deja de reconocerse.
 */
type Visual = { consultas: string[]; terminos: string[] };

/**
 * Consultas editoriales y terminos de comprobacion, por destino.
 *
 * Las consultas dicen que buscar. Los terminos sirven para VERIFICAR que lo que
 * ha devuelto el banco es realmente de ese sitio: el buscador de un banco de
 * stock es semantico y aproximado, y buscando Sevilla devuelve plazas
 * monumentales espanolas en general. Una campania de Sevilla con el ayuntamiento
 * de Madrid no es un fallo estetico, es un fallo de producto.
 */
const DESTINOS_VISUALES: Record<string, Visual> = {
  "Creta": {
    consultas: ["Balos lagoon Crete", "Elafonissi beach Crete", "Crete Greece coast"],
    terminos: ["crete", "creta", "balos", "elafonissi", "chania", "heraklion", "knossos"],
  },
  "Santorini": {
    consultas: ["Santorini Oia sunset", "Santorini caldera", "Santorini Greece"],
    terminos: ["santorini", "oia", "thira", "caldera", "fira"],
  },
  "París": {
    consultas: ["Paris Eiffel Tower", "Paris street France", "Paris Seine river"],
    terminos: ["paris", "eiffel", "louvre", "seine", "montmartre", "champs"],
  },
  "Sevilla": {
    consultas: ["Seville Plaza de Espana", "Seville Andalusia Spain", "Seville cathedral Giralda"],
    terminos: ["seville", "sevilla", "andalusia", "andalucia", "giralda", "alcazar", "triana", "guadalquivir"],
  },
  "Lisboa": {
    consultas: ["Lisbon tram Portugal", "Lisbon viewpoint", "Belem tower Lisbon"],
    terminos: ["lisbon", "lisboa", "portugal", "belem", "alfama", "tejo", "tagus"],
  },
  "Mallorca": {
    consultas: ["Mallorca beach Spain", "Serra de Tramuntana Mallorca", "Palma de Mallorca"],
    terminos: ["mallorca", "majorca", "palma", "tramuntana", "balearic", "baleares"],
  },
  "Ibiza": {
    consultas: ["Ibiza beach sunset", "Ibiza Es Vedra", "Ibiza coast Spain"],
    terminos: ["ibiza", "eivissa", "vedra", "balearic", "baleares", "formentera"],
  },
  "Roma": {
    consultas: ["Rome Colosseum Italy", "Rome Trevi fountain", "Rome street Italy"],
    terminos: ["rome", "roma", "colosseum", "colosseo", "trevi", "vatican", "pantheon", "italy"],
  },
  "Maldivas": {
    consultas: ["Maldives overwater villa", "Maldives beach aerial", "Maldives turquoise lagoon"],
    terminos: ["maldives", "maldivas", "atoll", "overwater", "male"],
  },
  "Marrakech": {
    consultas: ["Marrakech medina Morocco", "Marrakech riad", "Marrakech souk"],
    terminos: ["marrakech", "marrakesh", "morocco", "marruecos", "medina", "koutoubia", "jemaa", "souk"],
  },
  "Riviera Maya": {
    consultas: ["Tulum beach ruins Mexico", "Mexico cenote", "Riviera Maya caribbean"],
    terminos: ["tulum", "riviera maya", "cenote", "mexico", "yucatan", "cancun", "playa del carmen", "akumal"],
  },
  "Nueva York": {
    consultas: ["New York skyline", "New York Brooklyn bridge", "Manhattan street New York"],
    terminos: ["new york", "nyc", "manhattan", "brooklyn", "times square", "central park"],
  },
};

/** Terminos de otros destinos y confusiones habituales del buscador. */
const AJENOS = [
  "madrid", "barcelona", "valencia", "granada", "cordoba", "malaga", "bilbao", "toledo", "segovia",
  "london", "berlin", "amsterdam", "prague", "praha", "vienna", "budapest", "venice", "florence",
  "milan", "naples", "athens", "mykonos", "dubai", "bali", "thailand", "tenerife", "gran canaria",
  "lanzarote", "porto", "istanbul", "tokyo", "singapore", "miami", "los angeles", "chicago",
];

function visualDe(destino: Destino): Visual {
  const propio = DESTINOS_VISUALES[destino.destino];
  if (propio) return propio;
  const base = `${destino.destino} ${destino.pais}`;
  return {
    consultas: destino.tipo === "playa"
      ? [`${base} beach`, `${base} coast`, base]
      : [`${base} landmark`, `${base} old town`, base],
    terminos: [destino.destino.toLowerCase(), destino.pais.toLowerCase()],
  };
}

const normalizar = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * El banco no tiene metadatos de lugar fiables, asi que se mira lo unico que
 * viene con cada activo: la direccion publica —que lleva el titulo en la ruta—
 * y el texto alternativo o el autor.
 *
 * Dos preguntas distintas y por eso dos funciones:
 *   nombraDestino   ¿puedo afirmar que es de aqui?      -> va como verificado
 *   nombraOtroSitio ¿puedo afirmar que es de otro sitio? -> se descarta
 * Lo que no responde ni a una ni a otra es material generico: entra, pero
 * detras y sin contar como verificado.
 */
export function nombraDestino(texto: string, terminos: string[]) {
  const t = normalizar(texto);
  return terminos.some((termino) => t.includes(normalizar(termino)));
}

export function nombraOtroSitio(texto: string, terminos: string[], ajenos: string[] = AJENOS) {
  if (nombraDestino(texto, terminos)) return false;
  const t = normalizar(texto);
  return ajenos.some((ajeno) => t.includes(normalizar(ajeno)));
}

async function pedir<T>(url: string, clave: string, signal: AbortSignal): Promise<T | null> {
  try {
    const respuesta = await fetch(url, {
      signal,
      headers: { Authorization: clave },
      next: { revalidate: 86_400 },
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Se elige el fichero mas cercano a 720 px de ancho: por debajo se ve blando al
 * escalarlo a 9:16, y por encima descarga megas que la demo no necesita.
 */
export function elegirFichero(ficheros: FicheroVideo[] = []): FicheroVideo | null {
  const validos = ficheros.filter(
    (f) => f.link && (f.file_type ?? "").includes("mp4") && (f.width ?? 0) >= 400 && (f.width ?? 0) <= 1300,
  );
  if (!validos.length) return null;
  return validos.sort((a, b) => Math.abs((a.width ?? 720) - 720) - Math.abs((b.width ?? 720) - 720))[0];
}

/** Prioriza lo vertical, que es el formato de la pieza, sin descartar lo demas. */
export function ordenarPorVerticalidad<T extends { width?: number | null; height?: number | null }>(lista: T[]) {
  const ratio = (x: T) => (x.height ?? 1) / Math.max(1, x.width ?? 1);
  return [...lista].sort((a, b) => ratio(b) - ratio(a));
}

/** Todo lo que el banco nos da para saber que es: la ruta publica y el autor. */
function huellaVideo(video: VideoPexels) {
  return `${video.url ?? ""} ${video.user?.name ?? ""}`;
}

function huellaFoto(foto: FotoPexels) {
  return `${foto.url ?? ""} ${foto.alt ?? ""}`;
}

function videoAActivo(video: VideoPexels): ActivoVisual | null {
  const fichero = elegirFichero(video.video_files);
  if (!fichero?.link) return null;
  return {
    id: `pexels-video-${video.id ?? fichero.id}`,
    titulo: video.user?.name ? `Clip de ${video.user.name}` : "Clip de Pexels",
    url: fichero.link,
    miniatura: video.image ?? "",
    paginaFuente: video.url ?? "https://www.pexels.com",
    autor: video.user?.name ?? "Autor en Pexels",
    licencia: "Licencia Pexels · uso comercial sin atribución obligatoria",
    tipo: "video",
  };
}

function fotoAActivo(foto: FotoPexels): ActivoVisual | null {
  const url = foto.src?.large2x ?? foto.src?.large ?? foto.src?.original;
  if (!url) return null;
  return {
    id: `pexels-foto-${foto.id}`,
    titulo: foto.alt || (foto.photographer ? `Foto de ${foto.photographer}` : "Foto de Pexels"),
    url,
    miniatura: foto.src?.medium ?? url,
    paginaFuente: foto.url ?? "https://www.pexels.com",
    autor: foto.photographer ?? "Autor en Pexels",
    licencia: "Licencia Pexels · uso comercial sin atribución obligatoria",
    tipo: "imagen",
  };
}

export function hayPexels() {
  return Boolean(process.env.PEXELS_API_KEY);
}

export type ResultadoBanco = { activos: ActivoVisual[]; verificados: number; descartados: number };

export async function buscarActivosPexels(destino: Destino): Promise<ResultadoBanco> {
  const clave = process.env.PEXELS_API_KEY;
  if (!clave) return { activos: [], verificados: 0, descartados: 0 };

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 12_000);
  try {
    const { consultas, terminos } = visualDe(destino);
    const respuestas = await Promise.all(
      consultas.flatMap((consulta) => [
        pedir<{ videos?: VideoPexels[] }>(
          `${RAIZ_VIDEO}?query=${encodeURIComponent(consulta)}&orientation=portrait&size=medium&per_page=8`,
          clave,
          control.signal,
        ),
        pedir<{ photos?: FotoPexels[] }>(
          `${RAIZ_FOTO}?query=${encodeURIComponent(consulta)}&orientation=portrait&per_page=8`,
          clave,
          control.signal,
        ),
      ]),
    );

    const videos: VideoPexels[] = [];
    const fotos: FotoPexels[] = [];
    for (const respuesta of respuestas) {
      if (!respuesta) continue;
      if ("videos" in respuesta && respuesta.videos) videos.push(...respuesta.videos);
      if ("photos" in respuesta && respuesta.photos) fotos.push(...respuesta.photos);
    }

    const vistos = new Set<string>();
    let descartados = 0;

    // Dos cestas: lo que nombra el destino y lo que simplemente no nombra otro.
    // Lo verificado va primero y es lo que acaba en el video.
    const recoger = <T,>(
      lista: T[],
      convertir: (x: T) => ActivoVisual | null,
      huella: (x: T) => string,
    ) => {
      const seguros: ActivoVisual[] = [];
      const dudosos: ActivoVisual[] = [];
      for (const item of ordenarPorVerticalidad(lista as never[])) {
        const activo = convertir(item as T);
        if (!activo || vistos.has(activo.id)) continue;
        const texto = huella(item as T);
        if (nombraOtroSitio(texto, terminos)) { descartados += 1; continue; }
        vistos.add(activo.id);
        (nombraDestino(texto, terminos) ? seguros : dudosos).push(activo);
      }
      return { seguros, dudosos };
    };

    const clips = recoger(videos, videoAActivo, huellaVideo);
    const imagenes = recoger(fotos, fotoAActivo, huellaFoto);

    const activos = [
      ...clips.seguros.slice(0, 6),
      ...imagenes.seguros.slice(0, 6),
      ...clips.dudosos.slice(0, 3),
      ...imagenes.dudosos.slice(0, 3),
    ];
    return {
      activos,
      verificados: Math.min(clips.seguros.length, 6) + Math.min(imagenes.seguros.length, 6),
      descartados,
    };
  } catch {
    return { activos: [], verificados: 0, descartados: 0 };
  } finally {
    clearTimeout(reloj);
  }
}
