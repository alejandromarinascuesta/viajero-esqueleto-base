import type { Destino } from "@/types";

const norm = (valor: string) =>
  valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type TopePrecioReferenciado = {
  destino: string;
  precioMaximoPp: number;
  evidencia: string;
};

/**
 * Convierte una objeción comparativa ("Ibiza me parece muy caro") en un tope
 * trazable usando el precio del catálogo. El texto solo identifica la
 * objeción; la cifra nunca la calcula un modelo generativo.
 */
export function detectarTopePrecioReferenciado(
  notas: string,
  destinos: Destino[],
): TopePrecioReferenciado | null {
  const frases = notas.split(/[.!?;\n]+/).map((frase) => frase.trim()).filter(Boolean);
  const patronPrecio = /\b(muy caro|muy cara|demasiado caro|demasiado cara|se (?:me|nos) va de precio|descartad[oa] por precio|no pagaria|no pagaría)\b/i;

  for (const frase of frases) {
    if (!patronPrecio.test(frase)) continue;
    const normalizada = norm(frase);
    const destino = destinos
      .filter((candidato) => normalizada.includes(norm(candidato.destino)))
      .sort((a, b) => b.destino.length - a.destino.length)[0];
    if (!destino) continue;
    return {
      destino: destino.destino,
      precioMaximoPp: destino.precioDesdePp,
      evidencia: frase,
    };
  }
  return null;
}
