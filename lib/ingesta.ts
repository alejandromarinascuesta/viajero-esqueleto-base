import { cargarDestinos } from "@/lib/data";
import {
  conectorClima,
  conectorDivisa,
  conectorIne,
  conectorInteres,
  type FilaSenal,
  type ResumenFuente,
} from "@/lib/conectores";
import { conectorGoogleTrends } from "@/lib/google-trends";

export type ResultadoIngesta = {
  resumen: ResumenFuente[];
  guardadas: number;
  ejecutado: string;
  motivosDeFallo: string[];
};

export class ErrorIngesta extends Error {
  constructor(
    public readonly codigo: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function ejecutarIngestaNocturna(mes: number): Promise<ResultadoIngesta> {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new ErrorIngesta(
      "SIN_BASE_DE_DATOS",
      "La ingesta necesita base de datos para guardar observaciones reales.",
      503,
    );
  }

  const { destinos } = await cargarDestinos();
  const resumen: ResumenFuente[] = [];
  const filas: FilaSenal[] = [];

  const inicioTrends = Date.now();
  const trends = await conectorGoogleTrends(destinos);
  filas.push(...trends.filas);
  resumen.push({
    fuente: "trends",
    detalle: trends.omitido
      ? `Google Trends · omitido: ${trends.omitido}`
      : `${trends.proveedor} · automático · ${trends.consultas} consultas`,
    ok: trends.filas.filter((fila) => fila.estado === "ok").length,
    noAplican: trends.filas.filter((fila) => fila.estado === "no_aplicable").length,
    sinDato: trends.omitido
      ? destinos.length
      : trends.filas.filter((fila) => fila.estado === "no_disponible").length,
    motivo: trends.omitido
      ?? (trends.filas.find((f) => f.estado === "no_disponible")?.valor_bruto as { motivo?: string } | undefined)?.motivo
      ?? null,
    ms: Date.now() - inicioTrends,
  });

  for (const [fuente, detalle, ejecutar] of [
    ["clima", "Open-Meteo · archivo histórico · sin clave", () => conectorClima(destinos, mes)],
    ["interes", "Wikimedia · vistas diarias · respaldo", () => conectorInteres(destinos, mes)],
    ["divisa", "Banco Central Europeo · tipos de referencia", () => conectorDivisa(destinos, mes)],
    ["ine", "INE · viajeros por provincia · último dato oficial", () => conectorIne(destinos, mes)],
  ] as const) {
    const inicio = Date.now();
    const resultado = await ejecutar();
    filas.push(...resultado);
    resumen.push({
      fuente,
      detalle,
      ok: resultado.filter((fila) => fila.estado === "ok").length,
      noAplican: resultado.filter((fila) => fila.estado === "no_aplicable").length,
      sinDato: resultado.filter((fila) => fila.estado === "no_disponible").length,
      motivo: (resultado.find((f) => f.estado === "no_disponible")?.valor_bruto as { motivo?: string } | undefined)?.motivo ?? null,
      ms: Date.now() - inicio,
    });
  }

  if (filas.length > 0) {
    const escritura = await fetch(`${url}/rest/v1/senales?on_conflict=fuente,destino_id,periodo,metrica`, {
      method: "POST",
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(
        filas.map((fila) => ({
          fuente: fila.fuente,
          destino_id: fila.destino_id,
          periodo: fila.periodo,
          metrica: fila.metrica,
          valor: fila.valor,
          valor_bruto: fila.valor_bruto,
          estado: fila.estado,
          obtenido_en: new Date().toISOString(),
        })),
      ),
    });

    if (!escritura.ok) {
      throw new ErrorIngesta(
        "ESCRITURA",
        `No se han podido guardar las señales (${escritura.status}).`,
        500,
      );
    }
  }

  const motivos = filas
    .filter((fila) => fila.estado !== "ok")
    .map((fila) => (fila.valor_bruto as { motivo?: string } | null)?.motivo)
    .filter((motivo): motivo is string => Boolean(motivo));

  return {
    resumen,
    guardadas: filas.length,
    ejecutado: new Date().toISOString(),
    motivosDeFallo: [...new Set(motivos)].slice(0, 10),
  };
}
