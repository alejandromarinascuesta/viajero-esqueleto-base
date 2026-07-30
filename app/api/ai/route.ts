import { NextResponse } from "next/server";
import { z } from "zod";
import { cargarDestinos } from "@/lib/data";
import { contextoParaArgumento, INSTRUCCION_ARGUMENTO, pedirJson } from "@/lib/ai";
import { extraerPerfilDeterminista } from "@/lib/extraccion";
import { recomendar } from "@/lib/motor";
import { leerCriterio } from "@/lib/criterio";
import { verificarArgumento } from "@/lib/verificar";
import type { Destino, Perfil } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Entrada = z.object({
  notas: z.string().min(3).max(2000),
  excluidos: z.array(z.string()).max(30).optional(),
  campanas: z.array(z.string()).max(30).optional(),
  pesos: z
    .object({
      encaje_cliente: z.number().int().min(1).max(5),
      demanda: z.number().int().min(1).max(5),
      margen: z.number().int().min(1).max(5),
      campana: z.number().int().min(1).max(5),
      cupo: z.number().int().min(1).max(5),
    })
    .optional(),
});

const MOTIVACIONES = ["descanso", "cultura", "aventura", "romantico", "celebracion"];
const RESTRICCIONES = ["movilidad reducida", "no vuelos largos", "presupuesto ajustado"];

export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
  }
  const parseado = Entrada.safeParse(cuerpo);
  if (!parseado.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Escribe entre 3 y 2000 caracteres." } },
      { status: 400 },
    );
  }
  const { notas, excluidos = [], campanas, pesos } = parseado.data;

  // 1 · Extraccion determinista. Siempre funciona: sin red, sin clave y sin coste.
  const extraido = extraerPerfilDeterminista(notas);
  const perfil: Perfil = {
    adultos: extraido.adultos ?? 2,
    edadesNinos: extraido.ninos ?? [],
    presupuestoTotal: extraido.presupuesto_total ?? 0,
    presupuestoFlexible: extraido.flexible === true,
    mes: extraido.mes ?? new Date().getMonth() + 1,
    dias: extraido.dias ?? 7,
    motivacion: (MOTIVACIONES.includes(extraido.motivacion ?? "")
      ? extraido.motivacion
      : "descanso") as Perfil["motivacion"],
    intensidad: extraido.intensidad ?? 2,
    restricciones: (extraido.restricciones ?? []).filter((r) => RESTRICCIONES.includes(r)),
    destinosVisitados: [],
    tensionDeclarada: extraido.tension ?? "",
  };

  if (!perfil.presupuestoTotal) {
    return NextResponse.json({
      modo: "perfil-incompleto",
      perfil: extraido,
      mensaje:
        "No he encontrado el presupuesto en tus notas. Añádelo y vuelve a enviarlo: sin presupuesto no puedo descartar nada.",
    });
  }

  // 2 · El motor decide. Determinista, sin IA.
  const { destinos, origen } = await cargarDestinos();
  // El criterio comercial que ha configurado la direccion. Lo que llega en la
  // peticion solo sirve para previsualizar cambios sin guardarlos todavia.
  const criterio = await leerCriterio();
  const resultado = recomendar(
    destinos,
    perfil,
    { pesos: pesos ?? criterio.pesos, campanas: campanas ?? criterio.campanas, vetos: criterio.vetos },
    excluidos,
  );

  // 3 · La IA solo redacta sobre las dos ya elegidas, y se verifica.
  let argumentos: {
    id: string;
    argumento: string[];
    camposCitados: string[];
    verificado: boolean;
    motivo: string | null;
  }[] = [];
  let uso = null as unknown;

  if (resultado.propuestas.length > 0) {
    const elegidos = resultado.propuestas
      .map((p) => destinos.find((d) => d.id === p.id))
      .filter((d): d is Destino => Boolean(d));

    const r = await pedirJson<{
      propuestas?: { id: string; argumento: string[]; campos_citados: string[] }[];
    }>(INSTRUCCION_ARGUMENTO, contextoParaArgumento(perfil, elegidos), 0.3);
    uso = r.uso;

    argumentos = resultado.propuestas.map((p) => {
      const d = elegidos.find((x) => x.id === p.id);
      const redactado = r.datos?.propuestas?.find((x) => x.id === p.id);
      if (!redactado || !Array.isArray(redactado.argumento) || !d) {
        return {
          id: p.id, argumento: p.motivos, camposCitados: [], verificado: false,
          motivo: r.uso.error ?? "sin redacción del modelo",
        };
      }
      const ficha: Record<string, unknown> = {
        precio_desde_pp: d.precioDesdePp, noches: d.noches, horas_vuelo: d.horasVuelo,
        motivo_1: d.motivos[0], motivo_2: d.motivos[1], motivo_3: d.motivos[2],
        temperatura_media:
          d.senales.find((s) => s.metrica === "temperatura_media" && s.estado === "ok")?.valor ?? null,
      };
      const v = verificarArgumento(redactado.argumento, redactado.campos_citados ?? [], ficha);
      // Si no se puede verificar, NO se muestra el texto del modelo.
      return v.valido
        ? { id: p.id, argumento: redactado.argumento, camposCitados: v.camposCitados, verificado: true, motivo: null }
        : {
            id: p.id, argumento: p.motivos, camposCitados: v.camposCitados, verificado: false,
            motivo: [
              v.camposInexistentes.length ? `campos inexistentes: ${v.camposInexistentes.join(", ")}` : null,
              v.numerosInventados.length ? `cifras fuera de la ficha: ${v.numerosInventados.join(", ")}` : null,
            ].filter(Boolean).join(" · ") || "no verificable",
          };
    });
  }

  return NextResponse.json({
    modo: "ok",
    perfilExtraido: extraido,
    perfil,
    resultado,
    argumentos,
    origen,
    traza: {
      ...resultado.traza,
      redaccion: uso,
      camposCitados: argumentos.reduce((n, a) => n + a.camposCitados.length, 0),
      argumentosVerificados: argumentos.filter((a) => a.verificado).length,
    },
  });
}
