import { createServerFn } from "@tanstack/react-start";

import type { Perfil, Propuesta } from "./recomendador/tipos";

// ---------------------------------------------------------------------------
// Uso 1 del modelo · extraer un perfil de las notas de la llamada
// ---------------------------------------------------------------------------
// Existe porque nadie rellena un desplegable con "ella quiere playa pero él se
// aburre". El valor está en capturar lo que un formulario no captura.
//
// Regla principal: extrae solo lo que las notas dicen. Es preferible un perfil
// incompleto que el agente completa, a uno inventado en el que confía sin
// darse cuenta.

const INSTRUCCION_EXTRAER = `Eres el asistente de un agente de viajes. Recibes las notas informales que ha tomado durante una llamada con un cliente y las conviertes en un perfil estructurado.

REGLA PRINCIPAL: extrae únicamente lo que las notas dicen. No completes, no supongas y no infieras. Si un dato no aparece, déjalo a null y añádelo a "no_consta".

Devuelve exclusivamente este JSON, sin texto alrededor:
{
  "adultos": entero o null,
  "ninos": [edades como enteros] o [],
  "presupuesto_total": entero en euros o null,
  "presupuesto_es_por_persona": true si las notas dicen que la cifra es por persona, false si es el total del grupo, null si no queda claro,
  "flexible": true solo si las notas dicen expresamente que hay margen,
  "mes": 1-12 o null,
  "dias": entero o null,
  "motivacion": "descanso" | "cultura" | "aventura" | "romantico" | "celebracion" | null,
  "intensidad": 1 (no quieren moverse) a 5 (mochila y ruta) o null,
  "restricciones": array con cualquiera de "movilidad reducida", "no vuelos largos", "presupuesto ajustado",
  "destinos_mencionados": [destinos nombrados por el cliente, los que quiere y los que descarta],
  "tension": "una frase con la contradicción entre los viajeros si las notas la reflejan" o null,
  "no_consta": [nombres de los campos que has dejado a null],
  "literales": {"campo": "el trozo exacto de las notas del que sale ese dato"}
}`;

export type PerfilExtraido = {
  adultos: number | null;
  ninos: number[];
  presupuesto_total: number | null;
  presupuesto_es_por_persona: boolean | null;
  flexible: boolean | null;
  mes: number | null;
  dias: number | null;
  motivacion: string | null;
  intensidad: number | null;
  restricciones: string[];
  destinos_mencionados: string[];
  tension: string | null;
  no_consta: string[];
  literales: Record<string, string>;
};

export const extraerPerfil = createServerFn({ method: "POST" })
  .inputValidator((data: { notas: string }) => data)
  .handler(async ({ data }) => {
    const { pedirJson } = await import("@/lib/ia.server");
    const r = await pedirJson<PerfilExtraido>(INSTRUCCION_EXTRAER, data.notas);
    return {
      perfil: r.datos,
      uso: r.uso,
      // El error más caro posible: leer "3.500" como por persona cuando era el
      // total de una familia de cuatro multiplica el presupuesto por cuatro.
      requiereConfirmarPresupuesto:
        r.datos?.presupuesto_total != null && r.datos.presupuesto_es_por_persona == null,
    };
  });

// ---------------------------------------------------------------------------
// Uso 2 del modelo · redactar el argumento de las dos propuestas
// ---------------------------------------------------------------------------
// No elige, no ordena y no aporta ni un dato. Recibe solo las dos experiencias
// ya elegidas por el motor, y solo los campos de su ficha.

const INSTRUCCION_ARGUMENTO = `Eres el asistente de un agente de viajes. El sistema ya ha elegido estas experiencias. Tu único trabajo es redactar por qué encajan con este cliente.

REGLA ABSOLUTA: solo puedes usar información contenida en los campos que te paso. No puedes mencionar ningún dato, cifra, lugar, servicio o característica que no esté literalmente en esos campos. No sabes nada de estos destinos más allá de lo que te doy. Si te falta un dato para un argumento que te parecería bueno, no lo hagas: usa otro.

Para cada experiencia, tres frases:
1. Por qué encaja con lo que este cliente ha pedido.
2. Un dato concreto de la ficha que lo respalde.
3. Si el cliente tiene una tensión declarada, cómo la resuelve esta opción. Si no la tiene, un tercer motivo de la ficha.

Tono: el de un agente con veinte años de oficio hablando con un cliente. Sobrio y directo. Nada de "descubre", "sumérgete" ni lenguaje de folleto. Frases cortas. Español de España.

En "campos_citados" pon el nombre exacto de cada campo del que has sacado información. Se comprueba automáticamente.

Devuelve exclusivamente: {"propuestas": [{"id": "...", "argumento": ["f1","f2","f3"], "campos_citados": ["..."]}]}`;

export type ArgumentoVerificado = {
  id: string;
  argumento: string[];
  camposCitados: string[];
  verificado: boolean;
  motivoFallo: string | null;
};

export const redactarArgumentos = createServerFn({ method: "POST" })
  .inputValidator((data: { perfil: Perfil; propuestas: Propuesta[] }) => data)
  .handler(async ({ data }) => {
    const { pedirJson } = await import("@/lib/ia.server");
    const { verificarArgumento } = await import("@/lib/recomendador/verificar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = data.propuestas.map((p) => p.id);
    const { data: fichasBrutas } = await supabaseAdmin
      .from("experiencias")
      .select("*")
      .in("id", ids);
    const fichas = Object.fromEntries(
      ((fichasBrutas ?? []) as Record<string, unknown>[]).map((f) => [String(f.id), f]),
    );

    const entrada = JSON.stringify({
      perfil: {
        adultos: data.perfil.adultos,
        ninos: data.perfil.edadesNinos,
        presupuesto_total: data.perfil.presupuestoTotal,
        mes: data.perfil.mes,
        dias: data.perfil.dias,
        motivacion: data.perfil.motivacion,
        intensidad: data.perfil.intensidad,
        restricciones: data.perfil.restricciones,
        tension: data.perfil.tensionDeclarada,
      },
      experiencias: ids.map((id) => fichas[id]).filter(Boolean),
    });

    const r = await pedirJson<{
      propuestas?: { id: string; argumento: string[]; campos_citados: string[] }[];
    }>(INSTRUCCION_ARGUMENTO, entrada, 0.3);

    const argumentos: ArgumentoVerificado[] = data.propuestas.map((p) => {
      const redactado = r.datos?.propuestas?.find((x) => x.id === p.id);
      if (!redactado || !Array.isArray(redactado.argumento)) {
        return {
          id: p.id,
          argumento: p.motivos,
          camposCitados: [],
          verificado: false,
          motivoFallo: r.uso.error ?? "el modelo no devolvió argumento para esta propuesta",
        };
      }
      const ficha = fichas[p.id] ?? {};
      const v = verificarArgumento(
        redactado.argumento,
        redactado.campos_citados ?? [],
        ficha as Record<string, unknown>,
      );
      // Si no se puede verificar, NO se muestra: cae a los motivos del catálogo.
      if (!v.valido) {
        const detalles = [
          v.camposInexistentes.length
            ? `campos que no existen: ${v.camposInexistentes.join(", ")}`
            : null,
          v.numerosInventados.length
            ? `cifras que no están en la ficha: ${v.numerosInventados.join(", ")}`
            : null,
        ].filter(Boolean);
        return {
          id: p.id,
          argumento: p.motivos,
          camposCitados: v.camposCitados,
          verificado: false,
          motivoFallo: detalles.join(" · "),
        };
      }
      return {
        id: p.id,
        argumento: redactado.argumento,
        camposCitados: v.camposCitados,
        verificado: true,
        motivoFallo: null,
      };
    });

    return {
      argumentos,
      uso: r.uso,
      camposCitados: argumentos.reduce((n, a) => n + a.camposCitados.length, 0),
      camposInventados: argumentos.filter(
        (a) => !a.verificado && a.motivoFallo?.includes("no está"),
      ).length,
    };
  });
