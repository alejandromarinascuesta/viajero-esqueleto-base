import { createServerFn } from "@tanstack/react-start";

import { calcularRecomendacion } from "./recomendador/motor";
import type { ExperienciaFila, PesoFila } from "./recomendador/motor";
import { CLAVES_PESOS } from "./recomendador/tipos";
import type { PeticionRecomendacion, ResultadoRecomendacion, VetoFila } from "./recomendador/tipos";

const CAMPOS_EXPERIENCIA =
  "id, nombre, destino, tipo, precio_desde_pp, noches, temporada_agencia, horas_vuelo, visado, apto_ninos, intensidad, margen_pct, cupo, motivo_1, motivo_2, motivo_3, no_recomendado_si";

const PREFIJO_CAMPANA = "campana:";

export const listarDestinos = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("experiencias")
    .select("destino")
    .order("destino");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((f) => f.destino)));
});

export const listarCatalogo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("experiencias")
    .select("id, nombre, destino, pais")
    .order("destino");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const obtenerCriterio = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [pesos, vetos] = await Promise.all([
    supabaseAdmin.from("pesos").select("clave, valor"),
    supabaseAdmin.from("vetos").select("id, destino_id, mes, motivo, activo").order("id"),
  ]);
  if (pesos.error) throw new Error(pesos.error.message);
  if (vetos.error) throw new Error(vetos.error.message);

  const filas = (pesos.data ?? []) as PesoFila[];
  const valores = Object.fromEntries(
    CLAVES_PESOS.map((clave) => [clave, filas.find((f) => f.clave === clave)?.valor ?? 0]),
  ) as Record<(typeof CLAVES_PESOS)[number], number>;

  return {
    pesos: valores,
    campanas: filas
      .filter((f) => f.clave.startsWith(PREFIJO_CAMPANA) && f.valor === 1)
      .map((f) => f.clave.slice(PREFIJO_CAMPANA.length)),
    vetos: ((vetos.data ?? []) as VetoFila[]).filter((v) => v.activo !== false),
  };
});

export const guardarPesos = createServerFn({ method: "POST" })
  .inputValidator((data: Record<string, number>) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filas = CLAVES_PESOS.filter((clave) => clave in data).map((clave) => ({
      clave,
      valor: Math.round(data[clave]),
      editado_en: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("pesos").upsert(filas, { onConflict: "clave" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarCampana = createServerFn({ method: "POST" })
  .inputValidator((data: { experienciaId: string; activa: boolean }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pesos").upsert(
      {
        clave: `${PREFIJO_CAMPANA}${data.experienciaId}`,
        valor: data.activa ? 1 : 0,
        editado_en: new Date().toISOString(),
      },
      { onConflict: "clave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const crearVeto = createServerFn({ method: "POST" })
  .inputValidator((data: { destinoId: string; mes: number | null; motivo: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vetos").insert({
      destino_id: data.destinoId,
      mes: data.mes,
      motivo: data.motivo || null,
      activo: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retirarVeto = createServerFn({ method: "POST" })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("vetos").update({ activo: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recomendar = createServerFn({ method: "POST" })
  .inputValidator((data: PeticionRecomendacion) => data)
  .handler(async ({ data }): Promise<ResultadoRecomendacion> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [experiencias, pesos, vetos] = await Promise.all([
      supabaseAdmin.from("experiencias").select(CAMPOS_EXPERIENCIA),
      supabaseAdmin.from("pesos").select("clave, valor"),
      supabaseAdmin.from("vetos").select("id, destino_id, mes, motivo, activo"),
    ]);
    if (experiencias.error) throw new Error(experiencias.error.message);
    if (pesos.error) throw new Error(pesos.error.message);
    if (vetos.error) throw new Error(vetos.error.message);

    const filasPesos = (pesos.data ?? []) as PesoFila[];
    const campanas = filasPesos
      .filter((f) => f.clave.startsWith(PREFIJO_CAMPANA) && f.valor === 1)
      .map((f) => f.clave.slice(PREFIJO_CAMPANA.length));

    const resultado = calcularRecomendacion(
      (experiencias.data ?? []) as ExperienciaFila[],
      filasPesos.filter((f) => !f.clave.startsWith(PREFIJO_CAMPANA)),
      data.perfil,
      {
        vetos: ((vetos.data ?? []) as VetoFila[]).filter((v) => v.activo !== false),
        campanas,
        excluidos: data.excluidos ?? [],
        afinar: data.afinar ?? "",
      },
    );

    const registro = await supabaseAdmin
      .from("recomendaciones")
      .insert({
        perfil: data.perfil as unknown as never,
        candidatas: resultado.candidatas,
        supervivientes: resultado.supervivientes,
        propuestas: resultado.propuestas as unknown as never,
        traza: {
          modo: resultado.modo,
          avisos: resultado.avisos,
          excluidos: data.excluidos ?? [],
          afinar: data.afinar ?? "",
          campanas,
        } as unknown as never,
      })
      .select("id")
      .single();

    return { ...resultado, recomendacionId: registro.data?.id ?? null };
  });

export const registrarDescarte = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { recomendacionId: number | null; destinoId: string; motivo: string }) => data,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("descartes").insert({
      recomendacion_id: data.recomendacionId,
      destino_id: data.destinoId,
      motivo_agente: data.motivo || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
