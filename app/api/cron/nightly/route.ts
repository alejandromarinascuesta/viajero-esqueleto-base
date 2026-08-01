import { NextResponse } from "next/server";
import { ErrorIngesta, ejecutarIngestaNocturna } from "@/lib/ingesta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "No autorizado" } }, { status: 401 });
  }

  try {
    return NextResponse.json(await ejecutarIngestaNocturna(new Date().getMonth() + 1));
  } catch (error) {
    if (error instanceof ErrorIngesta) {
      return NextResponse.json(
        { error: { code: error.codigo, message: error.message } },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: { code: "INGESTA", message: "La sincronización nocturna no ha podido completarse." } },
      { status: 500 },
    );
  }
}
