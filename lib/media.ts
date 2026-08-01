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

type ConsultaVisual = {
  consulta: string;
  terminos: string[];
};

/**
 * Consultas editoriales del catálogo. No contienen métricas ni datos de negocio:
 * solo indican los lugares visuales que deben representarse en una campaña.
 * Así una búsqueda genérica no sustituye una playa o monumento emblemático por
 * material accidentalmente relacionado con el destino.
 */
const CONSULTAS_POR_DESTINO: Record<string, ConsultaVisual[]> = {
  Creta: [
    { consulta: "Crete Balos lagoon beach", terminos: ["balos", "lagoon", "beach"] },
    { consulta: "Crete Elafonissi beach", terminos: ["elafonissi", "beach"] },
    { consulta: "Knossos Crete", terminos: ["knossos"] },
  ],
  Santorini: [
    { consulta: "Santorini Oia caldera", terminos: ["santorini", "oia", "caldera"] },
    { consulta: "Santorini Red Beach", terminos: ["santorini", "red beach"] },
    { consulta: "Santorini Akrotiri", terminos: ["santorini", "akrotiri"] },
  ],
  París: [
    { consulta: "Paris Eiffel Tower", terminos: ["eiffel"] },
    { consulta: "Paris Louvre", terminos: ["louvre"] },
    { consulta: "Paris Arc de Triomphe", terminos: ["arc de triomphe"] },
  ],
  Sevilla: [
    { consulta: "Seville Plaza de España", terminos: ["plaza de españa", "plaza de espana"] },
    { consulta: "Seville Giralda", terminos: ["giralda"] },
    { consulta: "Royal Alcazar Seville", terminos: ["alcazar", "alcázar"] },
  ],
  Lisboa: [
    { consulta: "Lisbon Belem Tower", terminos: ["belem", "belém"] },
    { consulta: "Lisbon Tram 28", terminos: ["tram 28", "eléctrico 28"] },
    { consulta: "Jeronimos Monastery Lisbon", terminos: ["jeronimos", "jerónimos"] },
  ],
  Mallorca: [
    { consulta: "Mallorca Es Trenc beach", terminos: ["es trenc", "beach"] },
    { consulta: "Mallorca Cala Agulla", terminos: ["cala agulla"] },
    { consulta: "Palma Cathedral Mallorca", terminos: ["palma cathedral", "la seu"] },
  ],
  Tenerife: [
    { consulta: "Tenerife Las Teresitas beach", terminos: ["teresitas", "beach"] },
    { consulta: "Tenerife Teide", terminos: ["teide"] },
    { consulta: "Tenerife Los Gigantes", terminos: ["los gigantes"] },
  ],
  Ibiza: [
    { consulta: "Ibiza Cala Comte beach", terminos: ["cala comte", "beach"] },
    { consulta: "Ibiza Cala d'Hort Es Vedra", terminos: ["es vedra", "es vedrà", "cala d'hort"] },
    { consulta: "Ibiza Dalt Vila", terminos: ["dalt vila"] },
  ],
  Roma: [
    { consulta: "Rome Colosseum", terminos: ["colosseum", "colosseo"] },
    { consulta: "Rome Trevi Fountain", terminos: ["trevi"] },
    { consulta: "Rome Pantheon", terminos: ["pantheon"] },
  ],
  Praga: [
    { consulta: "Prague Charles Bridge", terminos: ["charles bridge", "karluv"] },
    { consulta: "Prague Castle", terminos: ["prague castle", "pražský hrad"] },
    { consulta: "Prague Old Town astronomical clock", terminos: ["astronomical clock", "orloj"] },
  ],
  Maldivas: [
    { consulta: "Maldives tropical beach", terminos: ["maldives", "beach"] },
    { consulta: "Maldives overwater villas", terminos: ["maldives", "overwater", "water villa"] },
    { consulta: "Maldives coral reef", terminos: ["maldives", "coral", "reef"] },
  ],
  Marrakech: [
    { consulta: "Marrakech Jemaa el Fna", terminos: ["jemaa", "djemaa"] },
    { consulta: "Marrakech Koutoubia", terminos: ["koutoubia"] },
    { consulta: "Marrakech Bahia Palace", terminos: ["bahia palace", "palais bahia"] },
  ],
  Ámsterdam: [
    { consulta: "Amsterdam canals", terminos: ["amsterdam", "canal"] },
    { consulta: "Amsterdam Rijksmuseum", terminos: ["rijksmuseum"] },
    { consulta: "Amsterdam Magere Brug", terminos: ["magere brug"] },
  ],
  "Riviera Maya": [
    { consulta: "Riviera Maya Tulum ruins beach", terminos: ["tulum", "ruins", "beach"] },
    { consulta: "Riviera Maya cenote", terminos: ["riviera maya", "cenote"] },
    { consulta: "Akumal beach Mexico", terminos: ["akumal", "beach"] },
  ],
  "Nueva York": [
    { consulta: "New York Statue of Liberty", terminos: ["statue of liberty"] },
    { consulta: "New York Brooklyn Bridge", terminos: ["brooklyn bridge"] },
    { consulta: "New York Central Park", terminos: ["central park"] },
  ],
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

function normalizar(valor: string) {
  return textoPlano(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

async function consultarCommons(consulta: string, tipo: "video" | "bitmap", signal: AbortSignal): Promise<CommonsPage[]> {
  const parametros = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `\"${consulta}\" filetype:${tipo}`,
    gsrnamespace: "6",
    gsrlimit: "12",
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

const CONTENIDO_NO_TURISTICO = /military|army|navy|air force|weapon|missile|strike|exercise|drill|fire training|protest|demonstration|war|combat|police|accident|map of|locator|flag of|coat of arms|logo|diagram|satellite|space agency/i;

function convertirPagina(pagina: CommonsPage, terminos: string[]): ActivoVisual | null {
  const info = pagina.imageinfo?.[0];
  if (!info?.url) return null;
  const esVideo = ["video/webm", "video/ogg"].includes(info.mime ?? "");
  const esImagen = ["image/jpeg", "image/png", "image/webp"].includes(info.mime ?? "");
  if (!esVideo && !esImagen) return null;

  const meta = info.extmetadata ?? {};
  const descripcionOriginal = `${pagina.title ?? ""} ${meta.ImageDescription?.value ?? ""}`;
  const descripcion = normalizar(descripcionOriginal);
  if (CONTENIDO_NO_TURISTICO.test(descripcion)) return null;
  if (!terminos.some((termino) => descripcion.includes(normalizar(termino)))) return null;

  const licencia = textoPlano(meta.LicenseShortName?.value) || "Licencia indicada en Wikimedia Commons";
  if (!/cc|public domain|dominio público/i.test(licencia)) return null;

  const derivada = esVideo ? elegirDerivada(info.derivatives) : null;
  // Si no existe una transcodificación ligera, evitamos cargar originales enormes
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

function consultasGenericas(destino: Destino): ConsultaVisual[] {
  if (destino.tipo === "playa") {
    return [
      { consulta: `${destino.destino} beach`, terminos: [destino.destino, "beach", "playa"] },
      { consulta: `${destino.destino} coast`, terminos: [destino.destino, "coast", "costa"] },
      { consulta: `${destino.destino} landmark`, terminos: [destino.destino, "landmark", "monument"] },
    ];
  }
  return [
    { consulta: `${destino.destino} landmark`, terminos: [destino.destino, "landmark"] },
    { consulta: `${destino.destino} monument`, terminos: [destino.destino, "monument"] },
    { consulta: `${destino.destino} historic centre`, terminos: [destino.destino, "historic"] },
  ];
}

export async function buscarActivosCommons(destino: Destino): Promise<ActivoVisual[]> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 12_000);
  try {
    const consultas = CONSULTAS_POR_DESTINO[destino.destino] ?? consultasGenericas(destino);
    const resultados = await Promise.all(
      consultas.flatMap((item) => ["video", "bitmap"].map(async (tipo) => ({
        item,
        tipo: tipo as "video" | "bitmap",
        paginas: await consultarCommons(item.consulta, tipo as "video" | "bitmap", control.signal),
      }))),
    );

    const vistos = new Set<string>();
    const videos: ActivoVisual[] = [];
    const imagenes: ActivoVisual[] = [];
    for (const resultado of resultados) {
      for (const pagina of resultado.paginas) {
        const clave = String(pagina.pageid ?? pagina.title);
        if (vistos.has(clave)) continue;
        const activo = convertirPagina(pagina, resultado.item.terminos);
        if (!activo) continue;
        vistos.add(clave);
        (activo.tipo === "video" ? videos : imagenes).push(activo);
      }
    }
    return [...videos.slice(0, 6), ...imagenes.slice(0, 8)];
  } catch {
    return [];
  } finally {
    clearTimeout(reloj);
  }
}

