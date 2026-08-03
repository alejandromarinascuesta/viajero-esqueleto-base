import { actorDe, conActor } from "@/lib/contexto";
import { frenar } from "@/lib/limite";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cargarDestinos } from "@/lib/data";
import { contextoParaArgumento, INSTRUCCION_ARGUMENTO, pedirJson, type UsoModelo } from "@/lib/ai";
import { extraerPerfilDeterminista, fusionarPerfil, INSTRUCCION_PERFIL } from "@/lib/extraccion";
import { recomendar } from "@/lib/motor";
import { leerCriterio } from "@/lib/criterio";
import { verificarArgumento } from "@/lib/verificar";
import { estimarConversion, leerHistorico } from "@/lib/conversion";
import { senalMasReciente } from "@/lib/signals";
import { detectarTopePrecioReferenciado } from "@/lib/restricciones-cliente";
import type { Destino, Perfil } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PerfilDirecto = z.object({
  adultos: z.number().int().min(1).max(12),
  edadesNinos: z.array(z.number().int().min(0).max(17)).max(8),
  presupuestoTotal: z.number().int().min(100).max(200000),
  presupuestoFlexible: z.boolean(),
  mes: z.number().int().min(1).max(12),
  dias: z.number().int().min(1).max(60),
  motivacion: z.enum(["descanso", "cultura", "aventura", "romantico", "celebracion"]),
  intensidad: z.number().int().min(1).max(5),
  restricciones: z.array(z.string().max(40)).max(6),
  destinosVisitados: z.array(z.string().max(60)).max(20),
  tensionDeclarada: z.string().max(300),
  fechaSalida: z.string().max(10).nullable().optional(),
});

const Entrada = z.object({
  // El formulario guiado ahorra la llamada de extraccion: menos tokens, menos
  // latencia y cero ambiguedad. Las notas libres siguen valiendo para cuando el
  // agente prefiere escribir como habla.
  perfil: PerfilDirecto.optional(),
  notas: z.string().min(3).max(2000).optional(),
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

async function registrar(
  perfil: Perfil,
  resultado: Awaited<ReturnType<typeof recomendar>>,
  excluidos: string[],
): Promise<number | null> {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  try {
    const r = await fetch(`${url}/rest/v1/recomendaciones`, {
      method: "POST",
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        perfil,
        candidatas: resultado.candidatas,
        supervivientes: resultado.supervivientes,
        propuestas: resultado.propuestas,
        traza: { ...resultado.traza, excluidos },
      }),
    });
    if (!r.ok) return null;
    const filas = (await r.json()) as { id: number }[];
    return filas[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  return conActor(actorDe(request), async () => {
    const freno = frenar(request, "ai", 20);
    if (freno) return freno;

    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return NextResponse.json({ error: { code: "BAD_JSON", message: "Cuerpo no válido" } }, { status: 400 });
    }
    const parseado = Entrada.safeParse(cuerpo);
    if (!parseado.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Rellena el formulario o escribe las notas de la llamada." } },
        { status: 400 },
      );
    }
    const { perfil: perfilDirecto, notas, excluidos = [], campanas, pesos } = parseado.data;
    if (!perfilDirecto && !notas) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Hace falta el perfil o las notas de la llamada." } },
        { status: 400 },
      );
    }

    // 1 · Si viene del formulario guiado no hay nada que extraer. Si vienen
    // notas, primero las reglas —que funcionan sin red, sin clave y sin coste— y
    // despues el modelo, que SOLO rellena lo que quedo vacio. Nunca sobreescribe
    // un dato que las reglas ya encontraron: por eso sigue siendo predecible y
    // sigue funcionando cuando el modelo no esta disponible.
    const usoPerfil: { valor: UsoModelo | null } = { valor: null };
    const extraido = notas
      ? await (async () => {
          const base = extraerPerfilDeterminista(notas);
          if (!base.no_consta.length) return base;
          const entrada = [
            "Notas de la llamada:",
            notas,
            "",
            `Campos que las reglas no han podido extraer: ${base.no_consta.join(", ")}.`,
          ].join("\n");
          const r = await pedirJson<Record<string, unknown>>(INSTRUCCION_PERFIL, entrada, 0, "perfil");
          usoPerfil.valor = r.uso;
          return fusionarPerfil(base, r.datos as never);
        })()
      : {
          adultos: perfilDirecto!.adultos,
          ninos: perfilDirecto!.edadesNinos,
          presupuesto_total: perfilDirecto!.presupuestoTotal,
          presupuesto_es_por_persona: false,
          flexible: perfilDirecto!.presupuestoFlexible,
          mes: perfilDirecto!.mes,
          dias: perfilDirecto!.dias,
          motivacion: perfilDirecto!.motivacion,
          intensidad: perfilDirecto!.intensidad,
          restricciones: perfilDirecto!.restricciones,
          destinos_mencionados: [],
          tension: perfilDirecto!.tensionDeclarada || null,
          no_consta: [],
          literales: {},
        };
    // Si hay fecha concreta, el mes se deriva de ella: manda la fecha.
    const mesDeLaFecha = perfilDirecto?.fechaSalida
      ? Number(perfilDirecto.fechaSalida.slice(5, 7))
      : null;
    let perfil: Perfil = perfilDirecto
      ? { ...perfilDirecto, mes: mesDeLaFecha && mesDeLaFecha >= 1 && mesDeLaFecha <= 12 ? mesDeLaFecha : perfilDirecto.mes }
      : {
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
      fechaSalida: null,
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
    const topeReferenciado = notas ? detectarTopePrecioReferenciado(notas, destinos) : null;
    if (topeReferenciado) {
      perfil = {
        ...perfil,
        precioMaximoReferenciaPp: topeReferenciado.precioMaximoPp,
        destinoReferenciaPrecio: topeReferenciado.destino,
      };
    }
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
            senalMasReciente(d.senales, "temperatura_media")?.valor ?? null,
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

    // Probabilidad estimada de conversion por propuesta. Es un MODELO, no un dato:
    // declara su base y sobre cuantas observaciones reales se apoya.
    const historico = await leerHistorico();
    const conversiones = resultado.propuestas.map((p) => {
      const d = destinos.find((x) => x.id === p.id);
      return {
        id: p.id,
        ...(d
          ? estimarConversion(d, perfil, p.puntuacion, historico[p.id])
          : { probabilidad: 0, base: 0, ajustes: [], empirica: false, observaciones: 0, explicacion: "" }),
      };
    });

    // El bucle: cada recomendacion y cada descarte quedan registrados. Es el
    // unico dato que ningun proveedor puede vender —que funciona en ESTA
    // agencia— y el cimiento de la v2.
    const recomendacionId = await registrar(perfil, resultado, excluidos);

    return NextResponse.json({
      modo: "ok",
      recomendacionId,
      perfilExtraido: extraido,
      perfil,
      resultado,
      argumentos,
      conversiones,
      origen,
      traza: {
        ...resultado.traza,
        redaccion: uso,
        extraccionPerfil: usoPerfil.valor
          ? {
              modelo: usoPerfil.valor.modelo,
              ms: usoPerfil.valor.ms,
              ok: usoPerfil.valor.ok,
              coste: usoPerfil.valor.coste,
            }
          : "solo reglas: no hizo falta el modelo",
        camposCitados: argumentos.reduce((n, a) => n + a.camposCitados.length, 0),
        argumentosVerificados: argumentos.filter((a) => a.verificado).length,
      },
    });
  });
}
