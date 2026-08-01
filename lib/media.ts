import type { ActivoVisual, Destino } from "@/types";

type DerivadaCommons = {
  src?: string;
  type?: string;
  width?: number;
  height?: number;
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    mime?: string;
    size?: number;
    descriptionurl?: string;
    derivatives?: DerivadaCommons[];
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

const ALIAS_COMMONS: Record<string, string> = {
  Creta: "Crete",
  Sevilla: "Seville",
  Lisboa: "Lisbon",
  Roma: "Rome",
  París: "Paris",
  Ámsterdam: "Amsterdam",
  Praga: "Prague",
  "Nueva York": "New York",
  Maldivas: "Maldives",
};

function textoPlano(valor?: string) {
  return (valor ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function urlHttps(valor?: string) {
  if (!valor) return "";
  return valor.startsWith("//") ? `https:${valor}` : valor;
}

function elegirDerivada(derivadas: DerivadaCommons[] = []) {
  return derivadas
    .filter((d) => d.src && d.type?.startsWith("video/") && (d.width ?? 0) >= 480 && (d.width ?? 0) <= 1280)
    .sort((a, b) => Math.abs((a.width ?? 720) - 720) - Math.abs((b.width ?? 720) - 720))[0];
}

async function consultarCommons(consulta: string, signal: AbortSignal): Promise<CommonsPage[]> {
  const parametros = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: consulta,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata|derivatives",
    iiurlwidth: "1200",
    format: "json",
    origin: "*",
  });
  const respuesta = await fetch(`https://commons.wikimedia.org/w/api.php?${parametros}`, {
    signal,
    headers: { "User-Agent": "TravelIntelligenceAI/1.0 (portfolio product)" },
    next: { revalidate: 86_400 },
  });
  if (!respuesta.ok) return [];
  const cuerpo = (await respuesta.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  return Object.values(cuerpo.query?.pages ?? {});
}

function convertirPagina(pagina: CommonsPage): ActivoVisual | null {
  const info = pagina.imageinfo?.[0];
  if (!info?.url) return null;
  const esVideo = ["video/webm", "video/ogg"].includes(info.mime ?? "");
  const esImagen = ["image/jpeg", "image/png", "image/webp"].includes(info.mime ?? "");
  if (!esVideo && !esImagen) return null;

  const meta = info.extmetadata ?? {};
  const descripcion = `${pagina.title ?? ""} ${meta.ImageDescription?.value ?? ""}`.toLowerCase();
  if (/satellite|space agency|map of|locator|flag of|coat of arms|logo|diagram/.test(descripcion)) return null;
  const licencia = textoPlano(meta.LicenseShortName?.value) || "Licencia indicada en Wikimedia Commons";
  if (!/cc|public domain|dominio público/i.test(licencia)) return null;

  const derivada = esVideo ? elegirDerivada(info.derivatives) : null;
  // Si no existe transcodificación ligera, evitamos cargar originales enormes
  // en el navegador durante una demo.
  if (esVideo && !derivada && (info.size ?? 0) > 80_000_000) return null;
  const url = esVideo ? urlHttps(derivada?.src ?? info.url) : info.url;
  return {
    id: String(pagina.pageid ?? pagina.title ?? url),
    titulo: textoPlano(meta.ImageDescription?.value) || textoPlano(pagina.title?.replace(/^File:/, "")),
    url,
    miniatura: urlHttps(info.thumburl) || url,
    paginaFuente: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(pagina.title ?? "")}`,
    autor: textoPlano(meta.Artist?.value) || "Autor indicado en Wikimedia Commons",
    licencia,
    tipo: esVideo ? "video" : "imagen",
  };
}

export async function buscarActivosCommons(destino: Destino): Promise<ActivoVisual[]> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 12_000);
  try {
    const enfoques: Record<string, [string, string]> = {
      playa: ["beach", "coast"],
      ciudad: ["landmark", "monument"],
      cultural: ["landmark", "monument"],
      naturaleza: ["landscape", "nature"],
      aventura: ["landscape", "nature"],
    };
    const nombre = ALIAS_COMMONS[destino.destino] ?? destino.destino;
    const [temaPrincipal, temaSecundario] = enfoques[destino.tipo] ?? ["tourism", "landmark"];
    const [videoPrincipal, videoSecundario, imagenPrincipal, imagenSecundaria] = await Promise.all([
      consultarCommons(`\"${nombre}\" ${temaPrincipal} filetype:video`, control.signal),
      consultarCommons(`\"${nombre}\" ${temaSecundario} filetype:video`, control.signal),
      consultarCommons(`\"${nombre}\" ${temaPrincipal} filetype:bitmap`, control.signal),
      consultarCommons(`\"${nombre}\" ${temaSecundario} filetype:bitmap`, control.signal),
    ]);
    const unicos = (paginas: CommonsPage[]) => [...new Map(paginas.map((p) => [p.pageid ?? p.title, p])).values()];
    // Playa/naturaleza: el paisaje manda. Ciudad/cultura: landmark + monument
    // hace que aparezcan los lugares emblemáticos y no imágenes genéricas.
    const videos = unicos([...videoPrincipal, ...videoSecundario])
      .map(convertirPagina).filter((a): a is ActivoVisual => a?.tipo === "video").slice(0, 6);
    const imagenes = unicos([...imagenPrincipal, ...imagenSecundaria])
      .map(convertirPagina).filter((a): a is ActivoVisual => a?.tipo === "imagen").slice(0, 8);
    return [...videos, ...imagenes];
  } catch {
    return [];
  } finally {
    clearTimeout(reloj);
  }
}
