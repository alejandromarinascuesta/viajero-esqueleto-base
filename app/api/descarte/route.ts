import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Cada descarte del agente, con su motivo, es una correccion al criterio. Es la
 * materia prima del bucle de aprendizaje: sin esto, la v2 no tiene de que
 * aprender.
 */
const Entrada = z.object({
  recomendacionId: z.number().int().nullable(),
  destinoId: z.string().max(20),
  motivo: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
  }
  const p = Entrada.safeParse(cuerpo);
  if (!p.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Falta el motivo del descarte." } },
      { status: 400 },
    );
  }

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return NextResponse.json({ registrado: false });

  try {
    const r = await fetch(`${url}/rest/v1/descartes`, {
      method: "POST",
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recomendacion_id: p.data.recomendacionId,
        destino_id: p.data.destinoId,
        motivo_agente: p.data.motivo,
      }),
    });
    return NextResponse.json({ registrado: r.ok });
  } catch {
    return NextResponse.json({ registrado: false });
  }
}
