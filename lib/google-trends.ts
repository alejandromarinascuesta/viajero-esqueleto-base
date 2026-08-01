import type { Destino } from "@/types";
import type { FilaSenal } from "@/lib/conectores";

type ValorTrends = {
  query?: string;
  extracted_value?: number;
};

type PuntoTrends = {
  timestamp?: string;
  values?: ValorTrends[];
};

type RespuestaSerpApi = {
  error?: string;
  search_metadata?: { status?: string };
  interest_over_time?: { timeline_data?: PuntoTrends[] };
};

export type ResultadoGoogleTrends = {
  filas: FilaSenal[];
  consultas: number;
  proveedor: "SerpApi / Google Trends";
  omitido: string | null;
};

const TAMANO_LOTE = 5;

function lotes<T>(elementos: T[], tamano: number): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < elementos.length; i += tamano) resultado.push(elementos.slice(i, i + tamano));
  return resultado;
}

const media = (valores: number[]) =>
  valores.reduce((total, valor) => total + valor, 0) / Math.max(1, valores.length);

/**
 * Calcula cuatro periodos recientes frente a los cuatro anteriores. El
 * cociente se calcula dentro de cada serie: no compara los índices 0-100 de
 * consultas diferentes.
 */
export function calcularMomentumTrends(valores: number[]): number | null {
  if (valores.length < 8) return null;
  const recientes = media(valores.slice(-4));
  const anteriores = media(valores.slice(-8, -4));
  if (anteriores <= 0) return null;
  return Math.round(((recientes - anteriores) / anteriores) * 1000) / 10;
}

function fechaIso(timestamp: string | undefined): string | null {
  const segundos = Number(timestamp);
  if (!Number.isFinite(segundos)) return null;
  return new Date(segundos * 1000).toISOString();
}

function termino(destino: Destino): string {
  return `viajar a ${destino.destino}`;
}

function filaSinDato(destino: Destino, motivo: string, periodo: string): FilaSenal {
  return {
    fuente: "trends",
    destino_id: destino.id,
    periodo,
    metrica: "momentum_busquedas_pct",
    valor: null,
    valor_bruto: { proveedor: "SerpApi / Google Trends", termino: termino(destino), motivo },
    estado: "no_disponible",
  };
}

/**
 * Importación automática para todo el catálogo. Cada llamada agrupa hasta
 * cinco destinos, por lo que 15 destinos consumen tres búsquedas nocturnas.
 * Sin clave no inventa datos ni borra la última observación real guardada.
 */
export async function conectorGoogleTrends(destinos: Destino[]): Promise<ResultadoGoogleTrends> {
  const clave = process.env.SERPAPI_API_KEY;
  if (!clave) {
    return {
      filas: [],
      consultas: 0,
      proveedor: "SerpApi / Google Trends",
      omitido: "SERPAPI_API_KEY no configurada",
    };
  }

  const filas: FilaSenal[] = [];
  let consultas = 0;

  for (const grupo of lotes(destinos, TAMANO_LOTE)) {
    const terminos = grupo.map(termino);
    const parametros = new URLSearchParams({
      engine: "google_trends",
      q: terminos.join(","),
      geo: "ES",
      hl: "es",
      date: "today 12-m",
      data_type: "TIMESERIES",
      api_key: clave,
    });

    let respuesta: RespuestaSerpApi | null = null;
    try {
      consultas += 1;
      const r = await fetch(`https://serpapi.com/search.json?${parametros}`, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (r.ok) respuesta = (await r.json()) as RespuestaSerpApi;
      else respuesta = { error: `respuesta ${r.status}` };
    } catch (error) {
      respuesta = { error: error instanceof Error ? error.message : "fallo de red" };
    }

    const puntos = respuesta?.interest_over_time?.timeline_data ?? [];
    const ultimaFecha = fechaIso(puntos.at(-1)?.timestamp);
    const periodo = ultimaFecha?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

    for (const [indiceDestino, destino] of grupo.entries()) {
      const consulta = termino(destino);
      if (respuesta?.error || respuesta?.search_metadata?.status === "Error") {
        filas.push(filaSinDato(destino, respuesta.error ?? "consulta fallida", periodo));
        continue;
      }

      const serie = puntos
        .map((punto) => {
          const valores = punto.values ?? [];
          const conNombre = valores.find(
            (valor) => valor.query?.toLocaleLowerCase("es") === consulta.toLocaleLowerCase("es"),
          );
          // En consultas de un único término SerpApi puede omitir `query`.
          return (conNombre ?? valores[indiceDestino])?.extracted_value;
        })
        .filter((valor): valor is number => Number.isFinite(valor));
      const momentum = calcularMomentumTrends(serie);

      if (momentum === null) {
        filas.push(filaSinDato(destino, `serie insuficiente: ${serie.length} periodos`, periodo));
        continue;
      }

      filas.push({
        fuente: "trends",
        destino_id: destino.id,
        periodo,
        metrica: "momentum_busquedas_pct",
        valor: momentum,
        valor_bruto: {
          proveedor: "SerpApi / Google Trends",
          termino: consulta,
          mercado: "ES",
          periodos: serie.length,
          ultima_observacion: ultimaFecha,
          metodologia: "media de los 4 últimos periodos frente a los 4 anteriores",
        },
        estado: "ok",
      });
    }
  }

  return { filas, consultas, proveedor: "SerpApi / Google Trends", omitido: null };
}
