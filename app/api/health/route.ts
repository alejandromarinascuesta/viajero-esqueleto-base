import { NextResponse } from "next/server";
import { cargarDestinos } from "@/lib/data";
import { hayModelo } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const { destinos, origen } = await cargarDestinos();
  return NextResponse.json({
    status: "ok",
    modeloLenguaje: hayModelo() ? "configurado" : "no configurado",
    origenDatos: origen.modo,
    frescura: origen.frescura,
    ingestadoEn: origen.ingestadoEn,
    destinos: destinos.length,
    fuentes: ["Catálogo de la agencia", "Open-Meteo", "Wikimedia Pageviews"],
    timestamp: new Date().toISOString(),
  });
}
