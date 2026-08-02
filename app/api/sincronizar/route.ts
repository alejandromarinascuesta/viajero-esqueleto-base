import { NextResponse } from "next/server";
import { ErrorIngesta, ejecutarIngestaNocturna } from "@/lib/ingesta";
import { dentroDelLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronizacion lanzada desde la interfaz.
 *
 * La ruta del proceso nocturno exige el secreto del cron, que vive en el
 * servidor y el navegador no puede enviar. Esta es su equivalente para una
 * persona, y por eso lleva un limite GLOBAL —no por origen— de dos ejecuciones
 * cada diez minutos: cada una consume cuota de las fuentes externas.
 *
 * En produccion esto va detras del rol de direccion. Hoy no hay roles, y esta
 * es la mitigacion honesta mientras no los haya.
 */
export async function POST(request: Request) {
  const limite = dentroDelLimite("sincronizar-global", 2, 600_000);
  if (!limite.permitido) {
    return NextResponse.json(
      {
        error: {
          code: "DEMASIADO_PRONTO",
          message: `Las fuentes se han sincronizado hace poco. Vuelve a intentarlo en ${Math.ceil(limite.esperaMs / 60_000)} minutos.`,
        },
      },
      { status: 429 },
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
      { error: { code: "SINCRONIZACION", message: "La sincronización no ha podido completarse." } },
      { status: 500 },
    );
  }
}
