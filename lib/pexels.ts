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
const CONSULTAS: Record<string, string[]> = {
  "Creta": ["Balos lagoon Crete", "Elafonissi beach Crete", "Crete Greece coast"],
  "Santorini": ["Santorini Oia sunset", "Santorini caldera", "Santorini white houses"],
  "París": ["Paris Eiffel Tower", "Paris street", "Paris Seine river"],
  "Sevilla": ["Seville Plaza de Espana", "Seville Spain street", "Andalusia architecture"],
  "Lisboa": ["Lisbon tram", "Lisbon Portugal viewpoint", "Belem tower Lisbon"],
  "Mallorca": ["Mallorca beach", "Mallorca Serra de Tramuntana", "Palma de Mallorca"],
  "Tenerife": ["Tenerife Teide", "Tenerife beach", "Canary islands coast"],
  "Ibiza": ["Ibiza beach sunset", "Ibiza Es Vedra", "Ibiza coast"],
  "Roma": ["Rome Colosseum", "Rome Trevi fountain", "Rome Italy street"],
  "Praga": ["Prague Charles bridge", "Prague old town", "Prague castle"],
  "Maldivas": ["Maldives overwater villa", "Maldives beach aerial", "Maldives turquoise water"],
  "Marrakech": ["Marrakech medina", "Marrakech riad", "Morocco desert"],
  "Ámsterdam": ["Amsterdam canal", "Amsterdam bikes", "Amsterdam houses"],
  "Riviera Maya": ["Tulum beach ruins", "Mexico cenote", "Riviera Maya caribbean"],
  "Nueva York": ["New York skyline", "New York Brooklyn bridge", "Manhattan street"],
};

function consultasDe(destino: Destino) {
  const propias = CONSULTAS[destino.destino];
  if (propias) return propias;
  const base = `${destino.destino} ${destino.pais}`;
  return destino.tipo === "playa"
    ? [`${base} beach`, `${base} coast`, base]
    : [`${base} landmark`, `${base} old town`, base];
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

export async function buscarActivosPexels(destino: Destino): Promise<ActivoVisual[]> {
  const clave = process.env.PEXELS_API_KEY;
  if (!clave) return [];

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 12_000);
  try {
    const consultas = consultasDe(destino);
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
    const clips: ActivoVisual[] = [];
    for (const video of ordenarPorVerticalidad(videos)) {
      const activo = videoAActivo(video);
      if (!activo || vistos.has(activo.id)) continue;
      vistos.add(activo.id);
      clips.push(activo);
      if (clips.length >= 8) break;
    }
    const imagenes: ActivoVisual[] = [];
    for (const foto of ordenarPorVerticalidad(fotos)) {
      const activo = fotoAActivo(foto);
      if (!activo || vistos.has(activo.id)) continue;
      vistos.add(activo.id);
      imagenes.push(activo);
      if (imagenes.length >= 8) break;
    }
    return [...clips, ...imagenes];
  } catch {
    return [];
  } finally {
    clearTimeout(reloj);
  }
}
