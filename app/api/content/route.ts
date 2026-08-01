import { NextResponse } from "next/server";
import { cargarDestinos } from "@/lib/data";
import { EntradaContenido, generarPlanContenido } from "@/lib/content";
import { buscarActivosCommons } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
  }
  const entrada = EntradaContenido.safeParse(cuerpo);
  if (!entrada.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Revisa los datos del contenido." } }, { status: 400 });
  }
  const { destinos } = await cargarDestinos();
  const destino = destinos.find((d) => d.id === entrada.data.destinationId);
  if (!destino) {
    return NextResponse.json({ error: { code: "DESTINATION_NOT_FOUND", message: "Destino no encontrado" } }, { status: 404 });
  }

  const [{ plan, uso }, activosEncontrados] = await Promise.all([
    generarPlanContenido(destino, entrada.data),
    buscarActivosCommons(destino),
  ]);
  const videos = activosEncontrados.filter((a) => a.tipo === "video");
  const fotos = activosEncontrados.filter((a) => a.tipo === "imagen");
  const activos = entrada.data.visualMix === "fotos"
    ? fotos
    : entrada.data.visualMix === "mixto"
      ? Array.from({ length: Math.max(videos.length, fotos.length) }, (_, i) => [videos[i], fotos[i]]).flat().filter(Boolean)
      : [...videos, ...fotos];
  return NextResponse.json({
    plan,
    activos,
    media: {
      fuente: "Wikimedia Commons",
      licencia: "Cada activo conserva autor, licencia y enlace de atribución.",
      estado: activos.length ? "live" : "unavailable",
    },
    modelo: uso,
  });
}
