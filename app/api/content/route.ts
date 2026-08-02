import { frenar } from "@/lib/limite";
import { NextResponse } from "next/server";
import { cargarDestinos } from "@/lib/data";
import { EntradaContenido, generarPlanContenido } from "@/lib/content";
import { buscarActivosCommons } from "@/lib/media";
import { buscarActivosPexels, hayPexels } from "@/lib/pexels";
import { hayLocucion } from "@/lib/locucion";
import type { ActivoVisual } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Pexels es la fuente principal porque es un banco comercial con clips
 * verticales. Commons queda como respaldo: si no hay clave, o si Pexels no
 * devuelve nada para ese destino, la pieza se sigue generando. Lo que no se
 * hace nunca es rellenar con material de otro destino.
 */
async function buscarActivos(destino: Parameters<typeof buscarActivosCommons>[0]) {
  if (hayPexels()) {
    const r = await buscarActivosPexels(destino);
    if (r.activos.length) {
      return { activos: r.activos, fuente: "Pexels", verificados: r.verificados, descartados: r.descartados };
    }
  }
  const respaldo = await buscarActivosCommons(destino);
  return {
    activos: respaldo,
    fuente: hayPexels() ? "Wikimedia Commons (respaldo)" : "Wikimedia Commons",
    verificados: respaldo.length,
    descartados: 0,
  };
}

/** Alterna vídeo y foto sin perder ninguno de los dos. */
function intercalar(videos: ActivoVisual[], fotos: ActivoVisual[]) {
  const total = Math.max(videos.length, fotos.length);
  return Array.from({ length: total }, (_, i) => [videos[i], fotos[i]]).flat().filter(Boolean) as ActivoVisual[];
}

export async function POST(request: Request) {
  const freno = frenar(request, "content", 10);
  if (freno) return freno;

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

  const [{ plan, uso }, { activos: encontrados, fuente, verificados, descartados }] = await Promise.all([
    generarPlanContenido(destino, entrada.data),
    buscarActivos(destino),
  ]);

  const videos = encontrados.filter((a) => a.tipo === "video");
  const fotos = encontrados.filter((a) => a.tipo === "imagen");
  const activos =
    entrada.data.visualMix === "fotos" ? (fotos.length ? fotos : encontrados)
    : entrada.data.visualMix === "mixto" ? intercalar(videos, fotos)
    : [...videos, ...fotos];

  return NextResponse.json({
    plan,
    activos,
    media: {
      fuente,
      licencia: "Cada activo conserva autor, licencia y enlace de origen.",
      estado: activos.length ? "live" : "unavailable",
      videos: videos.length,
      fotos: fotos.length,
      verificados,
      descartados,
    },
    voz: { disponible: hayLocucion() },
    modelo: uso,
  });
}
