import type { Destino, Senal } from "@/types";

/**
 * Supabase puede devolver varias observaciones de una misma métrica y no
 * garantiza el orden. La selección nunca debe depender del primer elemento.
 */
function fechaComparable(senal: Senal): number {
  const obtenida = senal.obtenidoEn ? Date.parse(senal.obtenidoEn) : Number.NaN;
  if (Number.isFinite(obtenida)) return obtenida;

  const fechaPeriodo = /^\d{4}-\d{2}-\d{2}/.test(senal.periodo)
    ? senal.periodo.slice(0, 10)
    : /^\d{4}-\d{2}/.test(senal.periodo)
      ? `${senal.periodo.slice(0, 7)}-01`
      : "";
  const periodo = fechaPeriodo ? Date.parse(`${fechaPeriodo}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(periodo) ? periodo : 0;
}

export function senalMasReciente(
  senales: Senal[],
  metrica: string,
  fuente?: Senal["fuente"],
): Senal | null {
  return (
    senales
      .filter(
        (senal) =>
          senal.metrica === metrica &&
          (!fuente || senal.fuente === fuente) &&
          senal.estado === "ok" &&
          senal.valor !== null,
      )
      .sort((a, b) => fechaComparable(b) - fechaComparable(a))[0] ?? null
  );
}

/** Trends mide intención de búsqueda; Wikimedia solo es respaldo de atención. */
export function senalMomentum(destino: Pick<Destino, "senales">): Senal | null {
  return (
    senalMasReciente(destino.senales, "momentum_busquedas_pct", "trends") ??
    senalMasReciente(destino.senales, "tendencia_interes_pct", "interes")
  );
}

/** Una observación actual por fuente y métrica para las vistas de producto. */
export function senalesActuales(senales: Senal[]): Senal[] {
  const grupos = new Map<string, Senal[]>();
  for (const senal of senales) {
    const clave = `${senal.fuente}:${senal.metrica}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), senal]);
  }

  return [...grupos.values()]
    .map((grupo) => grupo.sort((a, b) => fechaComparable(b) - fechaComparable(a))[0])
    .sort((a, b) => fechaComparable(b) - fechaComparable(a));
}

export function etiquetaFuenteMomentum(senal: Senal | null): string {
  if (!senal) return "Sin señal de demanda";
  return senal.fuente === "trends" ? "Google Trends" : "Wikimedia";
}
