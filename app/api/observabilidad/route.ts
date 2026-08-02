import { NextResponse } from "next/server";
import { resumen } from "@/lib/observabilidad";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...(await resumen()),
    nota: "Ventana reciente del proceso. El histórico completo vive en la tabla consumo_ia.",
  });
}
