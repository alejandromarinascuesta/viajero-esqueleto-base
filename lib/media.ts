import type { ActivoVisual, Destino } from "@/types";

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
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

export async function buscarActivosCommons(destino: Destino): Promise<ActivoVisual[]> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 9_000);
  try {
    const enfoque: Record<string, string> = {
      playa: "beach",
      ciudad: "landmark",
      cultural: "landmark",
      naturaleza: "landscape",
      aventura: "landscape",
    };
    // Una búsqueda corta y específica funciona mejor que una consulta con OR:
    // en Tenerife, por ejemplo, evita que los resultados de satélite desplacen
    // a las playas que el vídeo necesita enseñar.
    const consulta = `\"${destino.destino}\" ${enfoque[destino.tipo] ?? "tourism"}`;
    const parametros = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: consulta,
      gsrnamespace: "6",
      gsrlimit: "18",
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "1200",
      format: "json",
      origin: "*",
    });
    const respuesta = await fetch(`https://commons.wikimedia.org/w/api.php?${parametros}`, {
      signal: control.signal,
      headers: { "User-Agent": "TravelIntelligenceAI/1.0 (portfolio product)" },
      next: { revalidate: 86_400 },
    });
    if (!respuesta.ok) return [];
    const cuerpo = (await respuesta.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const paginas = Object.values(cuerpo.query?.pages ?? {});
    return paginas.flatMap((pagina): ActivoVisual[] => {
      const info = pagina.imageinfo?.[0];
      if (!info?.url || !["image/jpeg", "image/png", "image/webp"].includes(info.mime ?? "")) return [];
      const meta = info.extmetadata ?? {};
      const descripcion = `${pagina.title ?? ""} ${meta.ImageDescription?.value ?? ""}`.toLowerCase();
      if (/satellite|space agency|map of|locator|flag of|coat of arms|logo|diagram/.test(descripcion)) return [];
      const licencia = textoPlano(meta.LicenseShortName?.value) || "Licencia indicada en Wikimedia Commons";
      const libre = /cc|public domain|dominio público/i.test(licencia);
      if (!libre) return [];
      return [{
        id: String(pagina.pageid ?? pagina.title ?? info.url),
        titulo: textoPlano(meta.ImageDescription?.value) || textoPlano(pagina.title?.replace(/^File:/, "")),
        url: info.url,
        miniatura: info.thumburl ?? info.url,
        paginaFuente: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(pagina.title ?? "")}`,
        autor: textoPlano(meta.Artist?.value) || "Autor indicado en Wikimedia Commons",
        licencia,
        tipo: "imagen",
      }];
    }).slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(reloj);
  }
}
