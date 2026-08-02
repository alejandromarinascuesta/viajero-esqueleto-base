import { actorDe, conActor } from "@/lib/contexto";
import { frenar } from "@/lib/limite";
import { NextResponse } from "next/server";
import { guionHablado, recortarAlPresupuesto, sintetizar, velocidadPara, vozValida } from "@/lib/locucion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  return conActor(actorDe(request), async () => {
    const freno = frenar(request, "tts", 10);
    if (freno) return freno;

    let cuerpo: { locuciones?: unknown; duracion?: unknown; voz?: unknown };
    try {
      cuerpo = (await request.json()) as typeof cuerpo;
    } catch {
      return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
    }

    const locuciones = Array.isArray(cuerpo.locuciones)
      ? cuerpo.locuciones.filter((l): l is string => typeof l === "string").slice(0, 8)
      : [];
    if (!locuciones.length) {
      return NextResponse.json({ error: { code: "SIN_TEXTO", message: "No hay guion que locutar." } }, { status: 400 });
    }
    const duracion = cuerpo.duracion === 15 ? 15 : 30;

    const texto = guionHablado(recortarAlPresupuesto(locuciones, duracion));
    const resultado = await sintetizar(texto, vozValida(cuerpo.voz), velocidadPara(texto, duracion));
    if ("error" in resultado) {
      return NextResponse.json({ error: { code: "TTS_NO_DISPONIBLE", message: resultado.error } }, { status: 503 });
    }

    return new NextResponse(resultado.audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Modelo-Voz": resultado.modelo,
      },
    });
  });
}
