import { NextResponse } from "next/server";
import { cargarDestinos } from "@/lib/data";
import {
  conectorClima,
  conectorDivisa,
  conectorInteres,
  type FilaSenal,
  type ResumenFuente,
} from "@/lib/conectores";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ingesta en lote. Es el unico sitio del sistema que llama a APIs externas: el
 * motor nunca lo hace durante una recomendacion, solo lee lo ya cocinado.
 *
 * Compra latencia baja, coste acotado y reproducibilidad. Cuesta frescura, y
 * para decidir que destino promover eso es irrelevante.
 */
export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    return NextResponse.json(
      {
        error: {
          code: "SIN_BASE_DE_DATOS",
          message:
            "La ingesta necesita base de datos para guardar las observaciones. Sin ella, la plataforma sirve la última observación real del repositorio.",
        },
      },
      { status: 503 },
    );
  }

  const mes = Number(new URL(request.url).searchParams.get("mes")) || new Date().getMonth() + 1;
  const { destinos } = await cargarDestinos();

  const resumen: ResumenFuente[] = [];
  const filas: FilaSenal[] = [];

  for (const [fuente, detalle, ejecutar] of [
    ["clima", "Open-Meteo · archivo histórico · sin clave", () => conectorClima(destinos, mes)],
    ["interes", "Wikimedia · vistas diarias · sin clave", () => conectorInteres(destinos, mes)],
    ["divisa", "Banco Central Europeo · tipos de referencia · sin clave", () => conectorDivisa(destinos, mes)],
  ] as const) {
    const inicio = Date.now();
    const r = await ejecutar();
    filas.push(...r);
    resumen.push({
      fuente,
      detalle,
      ok: r.filter((f) => f.estado === "ok").length,
      fallos: r.filter((f) => f.estado !== "ok").length,
      ms: Date.now() - inicio,
    });
  }

  const cabeceras = {
    apikey: clave,
    Authorization: `Bearer ${clave}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  };
  const escritura = await fetch(`${url}/rest/v1/senales?on_conflict=fuente,destino_id,periodo,metrica`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify(
      filas.map((f) => ({
        fuente: f.fuente,
        destino_id: f.destino_id,
        periodo: f.periodo,
        metrica: f.metrica,
        valor: f.valor,
        valor_bruto: f.valor_bruto,
        estado: f.estado,
        obtenido_en: new Date().toISOString(),
      })),
    ),
  });

  if (!escritura.ok) {
    return NextResponse.json(
      { error: { code: "ESCRITURA", message: `No se han podido guardar las señales (${escritura.status}).` } },
      { status: 500 },
    );
  }

  // Los motivos de fallo, para que el sistema se autodiagnostique.
  const motivos = filas
    .filter((f) => f.estado !== "ok")
    .map((f) => (f.valor_bruto as { motivo?: string } | null)?.motivo)
    .filter((m): m is string => Boolean(m));

  return NextResponse.json({
    resumen,
    guardadas: filas.length,
    ejecutado: new Date().toISOString(),
    motivosDeFallo: [...new Set(motivos)].slice(0, 10),
  });
}
