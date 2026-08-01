/**
 * Importador de exportaciones reales de Google Trends.
 *
 * Por que un importador de CSV y no una API: la API oficial de Trends esta en
 * acceso alfa restringido, y los intermediarios que la revenden son de pago. El
 * CSV que exportas desde la interfaz es EL MISMO DATO, solo que la ingesta es
 * manual hasta que concedan el acceso. Sigue sin haber nada inventado.
 *
 * LA TRAMPA QUE HAY QUE EVITAR: Trends normaliza de 0 a 100 dentro de cada
 * consulta, y solo permite comparar cinco terminos a la vez. Un 100 en una
 * exportacion y un 100 en otra NO valen lo mismo. Por eso solo se guarda el
 * MOMENTUM —la variacion de las ultimas cuatro semanas frente a las cuatro
 * anteriores—, que si es comparable entre exportaciones porque es un cociente
 * dentro de una misma serie.
 */

export type SerieTrends = {
  termino: string;
  puntos: { fecha: string; valor: number }[];
  momentum: number | null;
  semanas: number;
  motivo: string | null;
};

export type ResultadoTrends = {
  series: SerieTrends[];
  cabeceraDetectada: string | null;
  error: string | null;
};

/** Trends antepone lineas de contexto antes de la tabla real. */
function lineasUtiles(csv: string): string[] {
  return csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^categor[íi]a\s*:/i.test(l));
}

function partirCsv(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (const c of linea) {
    if (c === '"') entreComillas = !entreComillas;
    else if (c === "," && !entreComillas) {
      campos.push(actual);
      actual = "";
    } else actual += c;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

/** "viajar a Mallorca: (España)" -> "viajar a Mallorca" */
export function limpiarTermino(bruto: string): string {
  return bruto
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/:\s*\([^)]*\)\s*$/, "")
    .trim();
}

export function parsearTrends(csv: string): ResultadoTrends {
  const lineas = lineasUtiles(csv);
  if (lineas.length < 2) {
    return { series: [], cabeceraDetectada: null, error: "El archivo no tiene cabecera y datos." };
  }

  // La cabecera es la primera linea cuya primera celda es Semana, Mes, Dia o Time.
  const indiceCabecera = lineas.findIndex((l) =>
    /^(semana|mes|d[íi]a|day|week|month|time)\b/i.test(partirCsv(l)[0] ?? ""),
  );
  if (indiceCabecera === -1) {
    return {
      series: [],
      cabeceraDetectada: null,
      error:
        "No he encontrado la cabecera. Exporta desde «Interés a lo largo del tiempo» en Google Trends.",
    };
  }

  const cabecera = partirCsv(lineas[indiceCabecera]);
  const terminos = cabecera.slice(1).map(limpiarTermino).filter(Boolean);
  if (terminos.length === 0) {
    return { series: [], cabeceraDetectada: cabecera[0], error: "La cabecera no tiene términos." };
  }

  const puntosPorTermino: { fecha: string; valor: number }[][] = terminos.map(() => []);
  for (const linea of lineas.slice(indiceCabecera + 1)) {
    const celdas = partirCsv(linea);
    if (celdas.length < 2) continue;
    const fecha = celdas[0];
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(fecha)) continue;
    terminos.forEach((_, i) => {
      // Trends usa "<1" para valores por debajo del umbral.
      const bruto = (celdas[i + 1] ?? "").replace("<", "").replace("%", "");
      const valor = Number(bruto);
      if (Number.isFinite(valor)) puntosPorTermino[i].push({ fecha, valor });
    });
  }

  const series: SerieTrends[] = terminos.map((termino, i) => {
    const puntos = puntosPorTermino[i];
    if (puntos.length < 8) {
      return {
        termino, puntos, momentum: null, semanas: puntos.length,
        motivo: `solo ${puntos.length} puntos: hacen falta al menos 8 para comparar cuatro contra cuatro`,
      };
    }
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const recientes = media(puntos.slice(-4).map((p) => p.valor));
    const previos = media(puntos.slice(-8, -4).map((p) => p.valor));
    if (previos === 0) {
      return { termino, puntos, momentum: null, semanas: puntos.length, motivo: "ventana previa a cero" };
    }
    return {
      termino,
      puntos,
      momentum: Math.round(((recientes - previos) / previos) * 1000) / 10,
      semanas: puntos.length,
      motivo: null,
    };
  });

  return { series, cabeceraDetectada: cabecera[0], error: null };
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Empareja cada termino con un destino del catalogo. Se exige que el nombre del
 * destino aparezca en el termino: "viajar a Mallorca" casa con Mallorca, pero
 * "viajar barato" no casa con nada y se declara sin emparejar.
 */
export function emparejar(
  series: SerieTrends[],
  destinos: { id: string; destino: string }[],
): { serie: SerieTrends; destinoId: string | null }[] {
  return series.map((serie) => {
    const t = norm(serie.termino);
    const encontrado = destinos
      .filter((d) => t.includes(norm(d.destino)))
      .sort((a, b) => b.destino.length - a.destino.length)[0];
    return { serie, destinoId: encontrado?.id ?? null };
  });
}
