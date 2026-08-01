import type { Destino, Perfil } from "@/types";

/**
 * Probabilidad estimada de que una propuesta acabe en reserva.
 *
 * REGLA DE HONESTIDAD: esto NO es un dato, es un modelo. Y el modelo dice
 * siempre sobre qué se apoya.
 *
 *   - Si la agencia tiene histórico suficiente, la base es su tasa real de
 *     conversión y la estimación es empírica.
 *   - Si no lo tiene —hoy no lo tiene—, la base es un supuesto declarado y la
 *     interfaz lo dice con todas las letras, junto al número de observaciones
 *     reales sobre las que se apoya: cero.
 *
 * Los ajustes son multiplicadores explícitos, no un modelo opaco: cada uno
 * aparece en pantalla con su nombre y su efecto. El objetivo no es acertar la
 * cifra, es que el agente entienda por qué una propuesta convierte mejor que
 * otra y pueda discutirlo.
 *
 * Todo es determinista: mismo perfil y mismo destino, misma probabilidad.
 */

/** Sin histórico, esta es la base declarada. Es una hipótesis, no un dato. */
export const BASE_SUPUESTA = 0.2;

/** Por debajo de esto, la muestra no da para estimar nada. */
export const MINIMO_OBSERVACIONES = 30;

export type Ajuste = { nombre: string; factor: number; porque: string };

export type Conversion = {
  probabilidad: number;
  base: number;
  ajustes: Ajuste[];
  empirica: boolean;
  observaciones: number;
  explicacion: string;
};

export type HistoricoDestino = { decididas: number; reservadas: number };

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function estimarConversion(
  destino: Destino,
  perfil: Perfil,
  puntuacionEncaje: number | null,
  historico?: HistoricoDestino,
): Conversion {
  const observaciones = historico?.decididas ?? 0;
  const empirica = observaciones >= MINIMO_OBSERVACIONES;
  const base = empirica ? (historico as HistoricoDestino).reservadas / observaciones : BASE_SUPUESTA;

  const ajustes: Ajuste[] = [];

  // 1 · Encaje con el cliente, tal y como lo ha puntuado el motor.
  if (puntuacionEncaje !== null) {
    const factor = 0.7 + puntuacionEncaje * 0.6; // 0,70 a 1,30
    ajustes.push({
      nombre: "Encaje con el cliente",
      factor,
      porque:
        puntuacionEncaje >= 0.6
          ? "el motor lo ha puntuado alto para este perfil"
          : "el encaje con lo que pide el cliente es flojo",
    });
  }

  // 2 · Holgura de presupuesto. Lo que va justo se cae más.
  const personas = Math.max(1, perfil.adultos + perfil.edadesNinos.length);
  const porPersona = perfil.presupuestoTotal / personas;
  if (porPersona > 0) {
    const holgura = (porPersona - destino.precioDesdePp) / porPersona;
    const factor = acotar(1 + holgura * 0.6, 0.6, 1.25);
    ajustes.push({
      nombre: "Holgura de presupuesto",
      factor,
      porque:
        holgura > 0.25
          ? "queda margen sobre lo que el cliente puede gastar"
          : holgura < 0.05
            ? "el precio está pegado al techo del cliente"
            : "el precio encaja sin holgura",
    });
  }

  // 3 · Escasez real de cupo. Empuja la decisión.
  if (destino.cupo <= 8) {
    ajustes.push({
      nombre: "Cupo escaso",
      factor: 1.12,
      porque: `quedan ${destino.cupo} plazas y eso acelera la decisión`,
    });
  }

  // 4 · Vuelo largo con niños: fricción conocida aunque la regla dura no corte.
  if (perfil.edadesNinos.length > 0 && destino.horasVuelo > 8) {
    ajustes.push({
      nombre: "Vuelo largo con niños",
      factor: 0.85,
      porque: "las familias abandonan más las propuestas de vuelo muy largo",
    });
  }

  // 5 · Repetición: lo ya visitado convierte peor.
  if (perfil.destinosVisitados.includes(destino.destino)) {
    ajustes.push({
      nombre: "Destino ya visitado",
      factor: 0.7,
      porque: "el cliente ya ha estado y suele buscar algo distinto",
    });
  }

  const probabilidad = acotar(
    ajustes.reduce((p, a) => p * a.factor, base),
    0.03,
    0.6,
  );

  return {
    probabilidad,
    base,
    ajustes,
    empirica,
    observaciones,
    explicacion: empirica
      ? `Base empírica: ${Math.round(base * 100)}% de conversión real de este destino sobre ${observaciones} propuestas cerradas.`
      : `Base supuesta del ${Math.round(BASE_SUPUESTA * 100)}%: la agencia todavía no tiene histórico suficiente (${observaciones} propuestas cerradas de las ${MINIMO_OBSERVACIONES} necesarias). En cuanto lo tenga, esta base se sustituye por su tasa real sin tocar el código.`,
  };
}

/** Lee el histórico por destino. Sin base de datos, no hay histórico. */
export async function leerHistorico(): Promise<Record<string, HistoricoDestino>> {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return {};
  try {
    const r = await fetch(`${url}/rest/v1/conversion_por_destino?select=*`, {
      headers: { apikey: clave, Authorization: `Bearer ${clave}` },
      cache: "no-store",
    });
    if (!r.ok) return {};
    const filas = (await r.json()) as { destino_id: string; decididas: number; reservadas: number }[];
    return Object.fromEntries(
      filas.map((f) => [f.destino_id, { decididas: Number(f.decididas), reservadas: Number(f.reservadas) }]),
    );
  } catch {
    return {};
  }
}
