import { NextResponse } from "next/server";
import { z } from "zod";
import { guardarCriterio, leerCriterio } from "@/lib/criterio";
import type { Pesos, Veto } from "@/lib/motor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await leerCriterio());
}

// Escala de 1 a 5: quien mueve las palancas es un responsable comercial, no un
// analista. «Cuánto me importa esto, del 1 al 5» se entiende sin formación.
const Entrada = z.object({
  pesos: z.object({
    encaje_cliente: z.number().int().min(1).max(5),
    demanda: z.number().int().min(1).max(5),
    margen: z.number().int().min(1).max(5),
    campana: z.number().int().min(1).max(5),
    cupo: z.number().int().min(1).max(5),
  }),
  campanas: z.array(z.string().max(20)).max(60),
  vetos: z
    .array(
      z.object({
        destinoId: z.string().max(20),
        mes: z.number().int().min(1).max(12).nullable(),
        motivo: z.string().max(200),
      }),
    )
    .max(60),
});

export async function PUT(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
  }
  const parseado = Entrada.safeParse(cuerpo);
  if (!parseado.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Cada peso tiene que ser un entero del 1 al 5." } },
      { status: 400 },
    );
  }

  const guardado = await guardarCriterio({
    pesos: parseado.data.pesos as Pesos,
    campanas: parseado.data.campanas,
    vetos: parseado.data.vetos as Veto[],
  });

  return NextResponse.json({
    guardado,
    mensaje: guardado
      ? "Criterio guardado. Todos los agentes recomiendan ya con estos pesos, campañas y vetos."
      : "Cambios aplicados en esta sesión. Sin base de datos configurada no se persisten.",
  });
}
