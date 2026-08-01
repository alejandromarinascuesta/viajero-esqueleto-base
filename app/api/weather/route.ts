import { NextResponse } from "next/server";
import { cargarDestino } from "@/lib/data";
import { senalMasReciente } from "@/lib/signals";

export const dynamic = "force-dynamic";

/**
 * Clima en directo desde Open-Meteo. Si la llamada falla, se devuelve la
 * última observación real guardada para ese destino — nunca un valor generado.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("destinationId");
  if (!id) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAM", message: "Falta destinationId" } },
      { status: 400 },
    );
  }

  const { destino } = await cargarDestino(id);
  if (!destino) {
    return NextResponse.json(
      { error: { code: "DESTINATION_NOT_FOUND", message: "Destino no encontrado" } },
      { status: 404 },
    );
  }

  const guardada = senalMasReciente(destino.senales, "temperatura_media");

  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 6000);
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${destino.lat}&longitude=${destino.lon}` +
        `&current=temperature_2m,weather_code&timezone=auto`,
      { signal: control.signal, next: { revalidate: 1800 } },
    );
    clearTimeout(reloj);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { current?: { temperature_2m?: number; time?: string } };
    const t = j.current?.temperature_2m;
    if (typeof t !== "number") throw new Error("sin dato");

    return NextResponse.json({
      estado: "live",
      temperatura: t,
      observadoEn: j.current?.time ?? null,
      fuente: "Open-Meteo · previsión",
    });
  } catch {
    if (!guardada) {
      return NextResponse.json({
        estado: "unavailable",
        temperatura: null,
        fuente: "Open-Meteo",
        mensaje: "No hay datos disponibles para este destino.",
      });
    }
    return NextResponse.json({
      estado: "cached",
      temperatura: guardada.valor,
      observadoEn: guardada.obtenidoEn,
      fuente: "Open-Meteo · archivo histórico",
      mensaje: "Última observación real guardada.",
    });
  }
}
