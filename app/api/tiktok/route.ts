import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Entrada = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("initialize"),
    size: z.number().int().positive().max(64_000_000),
    mime: z.enum(["video/webm", "video/mp4", "video/quicktime"]),
  }),
  z.object({ action: z.literal("status"), publishId: z.string().min(1).max(100) }),
]);

export async function POST(request: Request) {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({
      error: {
        code: "TIKTOK_NOT_CONNECTED",
        message: "Conecta la cuenta de TikTok para habilitar el envío de borradores.",
      },
    }, { status: 503 });
  }
  let cuerpo: unknown;
  try { cuerpo = await request.json(); } catch { cuerpo = null; }
  const entrada = Entrada.safeParse(cuerpo);
  if (!entrada.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Petición de TikTok no válida." } }, { status: 400 });
  }

  const endpoint = entrada.data.action === "initialize"
    ? "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
    : "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
  const payload = entrada.data.action === "initialize"
    ? {
        source_info: {
          source: "FILE_UPLOAD",
          video_size: entrada.data.size,
          chunk_size: entrada.data.size,
          total_chunk_count: 1,
        },
      }
    : { publish_id: entrada.data.publishId };

  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 15_000);
    const respuesta = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload),
      signal: control.signal,
    });
    clearTimeout(reloj);
    const datos = (await respuesta.json()) as {
      data?: { publish_id?: string; upload_url?: string; status?: string; fail_reason?: string };
      error?: { code?: string; message?: string };
    };
    if (!respuesta.ok || datos.error?.code !== "ok") {
      return NextResponse.json({ error: { code: "TIKTOK_PROVIDER_ERROR", message: "TikTok no ha aceptado el envío. Revisa la conexión de la cuenta." } }, { status: 502 });
    }
    return NextResponse.json({
      publishId: datos.data?.publish_id,
      uploadUrl: datos.data?.upload_url,
      status: datos.data?.status,
      failReason: datos.data?.fail_reason,
    });
  } catch {
    return NextResponse.json({ error: { code: "TIKTOK_UNAVAILABLE", message: "TikTok no está disponible en este momento." } }, { status: 503 });
  }
}
