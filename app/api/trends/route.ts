import { NextResponse } from "next/server";
import { z } from "zod";
import { cargarDestinos } from "@/lib/data";
import { emparejar, parsearTrends } from "@/lib/trends";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Entrada = z.object({
  csv: z.string().min(10).max(500_000),
  mes: z.number().int().min(1).max(12).optional(),
});

/**
 * Importa una exportacion real de Google Trends.
 *
 * Solo se guarda el MOMENTUM, no el valor absoluto: Trends normaliza de 0 a 100
 * dentro de cada consulta, asi que dos exportaciones distintas no son
 * comparables entre si. La variacion dentro de una misma serie si lo es.
 */
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
      { error: { code: "INVALID_INPUT", message: "Pega el contenido del CSV exportado de Google Trends." } },
      { status: 400 },
    );
  }

  const parseado = parsearTrends(p.data.csv);
  if (parseado.error) {
    return NextResponse.json({ error: { code: "CSV_NO_VALIDO", message: parseado.error } }, { status: 400 });
  }

  const { destinos } = await cargarDestinos();
  const pares = emparejar(parseado.series, destinos);

  const emparejados = pares.filter((x) => x.destinoId && x.serie.momentum !== null);
  const sinDestino = pares.filter((x) => !x.destinoId).map((x) => x.serie.termino);
  const sinMomentum = pares
    .filter((x) => x.destinoId && x.serie.momentum === null)
    .map((x) => `${x.serie.termino}: ${x.serie.motivo}`);

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    return NextResponse.json({
      guardadas: 0,
      emparejados: emparejados.map((x) => ({ termino: x.serie.termino, destinoId: x.destinoId, momentum: x.serie.momentum })),
      sinDestino,
      sinMomentum,
      aviso: "Sin base de datos configurada no se guarda nada. Esto es solo la lectura del archivo.",
    });
  }

  const periodo = `${new Date().getUTCFullYear()}-${String(p.data.mes ?? new Date().getMonth() + 1).padStart(2, "0")}`;
  const r = await fetch(`${url}/rest/v1/senales?on_conflict=fuente,destino_id,periodo,metrica`, {
    method: "POST",
    headers: {
      apikey: clave,
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(
      emparejados.map((x) => ({
        fuente: "trends",
        destino_id: x.destinoId,
        periodo,
        metrica: "momentum_busquedas_pct",
        valor: x.serie.momentum,
        valor_bruto: {
          termino: x.serie.termino,
          semanas: x.serie.semanas,
          nota: "Momentum de 4 semanas frente a las 4 anteriores. El valor absoluto de Trends no se guarda porque no es comparable entre exportaciones.",
        },
        estado: "ok",
        obtenido_en: new Date().toISOString(),
      })),
    ),
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: { code: "ESCRITURA", message: `No se han podido guardar las señales (${r.status}).` } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    guardadas: emparejados.length,
    emparejados: emparejados.map((x) => ({ termino: x.serie.termino, destinoId: x.destinoId, momentum: x.serie.momentum })),
    sinDestino,
    sinMomentum,
  });
}
