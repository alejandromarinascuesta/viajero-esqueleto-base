import { frenar } from "@/lib/limite";
import { NextResponse } from "next/server";
import { ErrorIngesta, ejecutarIngestaNocturna } from "@/lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Endpoint operativo. La interfaz no lo invoca: lo usa el proceso programado. */
export async function POST(request: Request) {
  const freno = frenar(request, "ingesta", 3);
  if (freno) return freno;

  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado" } },
      { status: 401 },
    );
  }
  const mes = Number(new URL(request.url).searchParams.get("mes")) || new Date().getMonth() + 1;
  try {
    return NextResponse.json(await ejecutarIngestaNocturna(mes));
  } catch (error) {
    if (error instanceof ErrorIngesta) {
      return NextResponse.json(
        { error: { code: error.codigo, message: error.message } },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: { code: "INGESTA", message: "La sincronización no ha podido completarse." } },
      { status: 500 },
    );
  }
}
