import { createServerFn } from "@tanstack/react-start";

import { calcularRecomendacion } from "./recomendador/motor";
import type { ExperienciaFila, PesoFila } from "./recomendador/motor";
import type { Perfil } from "./recomendador/tipos";

export const listarDestinos = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("experiencias")
    .select("destino")
    .order("destino");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((f) => f.destino)));
});

export const recomendar = createServerFn({ method: "POST" })
  .inputValidator((data: Perfil) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [experiencias, pesos] = await Promise.all([
      supabaseAdmin
        .from("experiencias")
        .select(
          "id, nombre, destino, tipo, precio_desde_pp, noches, temporada_agencia, horas_vuelo, apto_ninos, intensidad, margen_pct, cupo, motivo_1, motivo_2, motivo_3, no_recomendado_si",
        ),
      supabaseAdmin.from("pesos").select("clave, valor"),
    ]);
    if (experiencias.error) throw new Error(experiencias.error.message);
    if (pesos.error) throw new Error(pesos.error.message);

    return calcularRecomendacion(
      (experiencias.data ?? []) as ExperienciaFila[],
      (pesos.data ?? []) as PesoFila[],
      data,
    );
  });
