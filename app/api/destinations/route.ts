import { NextResponse } from "next/server";
import { cargarDestino, cargarDestinos } from "@/lib/data";
import { opportunityScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");


  if (id) {
    const { destino, origen } = await cargarDestino(id);
    if (!destino) {
      return NextResponse.json(
        { error: { code: "DESTINATION_NOT_FOUND", message: "Destino no encontrado" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ destino, oportunidad: opportunityScore(destino), origen });
  }

  const { destinos, origen } = await cargarDestinos();
  return NextResponse.json({
    destinos: destinos.map((d) => ({ ...d, oportunidad: opportunityScore(d) })),
    origen,
    total: destinos.length,
  });
}
