import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Los activos se sirven a traves del propio dominio por dos razones: el canvas
 * que monta el video quedaria "contaminado" con imagen de otro origen y no se
 * podria exportar, y ademas asi la lista de origenes permitidos esta declarada
 * en un solo sitio. Nunca se proxya una URL arbitraria.
 */
const ORIGENES = new Set([
  "upload.wikimedia.org",
  "images.pexels.com",
  "videos.pexels.com",
  "player.vimeo.com",
]);

const TIPOS = ["image/", "video/"];

export async function GET(request: Request) {
  const valor = new URL(request.url).searchParams.get("url");
  if (!valor) return NextResponse.json({ error: "URL obligatoria" }, { status: 400 });
  let url: URL;
  try { url = new URL(valor); } catch { return NextResponse.json({ error: "URL no válida" }, { status: 400 }); }
  if (url.protocol !== "https:" || !ORIGENES.has(url.hostname)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 20_000);
    const respuesta = await fetch(url, { signal: control.signal, next: { revalidate: 86_400 } });
    clearTimeout(reloj);
    if (!respuesta.ok) return NextResponse.json({ error: "Activo no disponible" }, { status: 502 });
    const tipo = respuesta.headers.get("content-type") ?? "application/octet-stream";
    if (!TIPOS.some((permitido) => tipo.startsWith(permitido))) {
      return NextResponse.json({ error: "Tipo no permitido" }, { status: 415 });
    }
    return new NextResponse(respuesta.body, {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Activo no disponible" }, { status: 502 });
  }
}
