// Verificación del argumento redactado por el modelo.
//
// Decirle al modelo "no inventes" no basta: hay que comprobarlo. Este módulo
// es lo que permite que la traza afirme «campos inventados: 0» como un hecho
// medido y no como una promesa.
//
// Si la verificación falla, quien llama NO muestra el argumento: cae a los
// tres motivos del catálogo. Mismo principio que la ingesta — un hueco nunca
// se rellena con un supuesto.

export type ResultadoVerificacion = {
  valido: boolean;
  camposCitados: string[];
  camposInexistentes: string[];
  numerosInventados: string[];
};

/** Todos los números que aparecen en un texto, normalizados. */
function numerosDe(texto: string): string[] {
  const encontrados = texto.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return encontrados.map(normalizarNumero).filter((n) => n.length > 0);
}

function normalizarNumero(bruto: string): string {
  // "3.200" -> "3200" · "3,5" -> "3.5" · "26" -> "26"
  let s = bruto.replace(/\.(?=\d{3}\b)/g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

/** Números presentes en los valores de la ficha, incluidos los de sus textos. */
function numerosDeFicha(ficha: Record<string, unknown>): Set<string> {
  const salida = new Set<string>();
  for (const valor of Object.values(ficha)) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "number") {
      salida.add(String(valor));
      // El precio total del grupo es un múltiplo legítimo del precio por persona.
      for (const factor of [2, 3, 4, 5, 6, 7, 8]) salida.add(String(valor * factor));
      continue;
    }
    for (const n of numerosDe(String(valor))) salida.add(n);
  }
  return salida;
}

export function verificarArgumento(
  argumento: string[],
  camposCitados: string[],
  ficha: Record<string, unknown>,
): ResultadoVerificacion {
  const camposDisponibles = new Set(Object.keys(ficha));
  const camposInexistentes = camposCitados.filter((c) => !camposDisponibles.has(c));

  const permitidos = numerosDeFicha(ficha);
  const numerosInventados: string[] = [];
  for (const frase of argumento) {
    for (const n of numerosDe(frase)) {
      // Los ordinales bajos (una hora, dos días) no son datos de ficha.
      if (Number(n) <= 12 && !n.includes(".")) continue;
      if (!permitidos.has(n)) numerosInventados.push(n);
    }
  }

  return {
    valido: camposInexistentes.length === 0 && numerosInventados.length === 0,
    camposCitados,
    camposInexistentes,
    numerosInventados: Array.from(new Set(numerosInventados)),
  };
}
