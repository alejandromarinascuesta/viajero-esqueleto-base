import type { Destino, Oportunidad } from "@/types";

/**
 * Opportunity Score: qué destinos merece la pena promover al mercado.
 *
 * Se calcula SOLO con métricas realmente disponibles. Si falta una, no se
 * inventa ni se sustituye por una media: se reparte su peso entre las que sí
 * están y **baja la confianza**. La confianza es, literalmente, la proporción
 * del peso total que se ha podido calcular con datos reales.
 *
 * Es determinista: mismas señales, mismo número. Ningún modelo generativo
 * interviene aquí.
 */
const PESOS = [
  { clave: "interes", etiqueta: "Tendencia de interés", peso: 35, origen: "Wikimedia Pageviews · 28 días" },
  { clave: "margen", etiqueta: "Atractivo económico", peso: 25, origen: "Catálogo de la agencia" },
  { clave: "disponibilidad", etiqueta: "Cupo disponible", peso: 20, origen: "Catálogo de la agencia" },
  { clave: "clima", etiqueta: "Idoneidad climática", peso: 20, origen: "Open-Meteo · archivo histórico" },
] as const;

const acotar = (v: number) => Math.min(1, Math.max(0, v));

function senal(d: Destino, metrica: string): number | null {
  const s = d.senales.find((x) => x.metrica === metrica && x.estado === "ok");
  return s?.valor ?? null;
}

/** Normaliza cada componente a 0-1. Devuelve null si no hay dato real. */
function componente(clave: string, d: Destino): number | null {
  if (clave === "interes") {
    const v = senal(d, "tendencia_interes_pct");
    // -50% -> 0 · 0% -> 0,5 · +50% -> 1
    return v === null ? null : acotar((v + 50) / 100);
  }
  if (clave === "margen") {
    // El catálogo se mueve entre 18 y 28 por ciento.
    return acotar((d.margenPct - 15) / 15);
  }
  if (clave === "disponibilidad") {
    return acotar(d.cupo / 30);
  }
  if (clave === "clima") {
    const t = senal(d, "temperatura_media");
    if (t === null) return null;
    // Confort de viaje: 24 °C es el óptimo, se penaliza al alejarse.
    return acotar(1 - Math.abs(t - 24) / 18);
  }
  return null;
}

export function opportunityScore(d: Destino): Oportunidad {
  const componentes = PESOS.map((p) => {
    const valor = componente(p.clave, d);
    return {
      clave: p.clave,
      etiqueta: p.etiqueta,
      peso: p.peso,
      valor,
      aporta: 0,
      origen: p.origen,
    };
  });

  const disponibles = componentes.filter((c) => c.valor !== null);
  const pesoDisponible = disponibles.reduce((s, c) => s + c.peso, 0);
  const pesoTotal = PESOS.reduce((s, p) => s + p.peso, 0);

  let score = 0;
  if (pesoDisponible > 0) {
    for (const c of componentes) {
      if (c.valor === null) continue;
      // Se reparte el peso entre las disponibles, no se rellena la que falta.
      c.aporta = (c.valor * c.peso * 100) / pesoDisponible;
      score += c.aporta;
    }
  }

  return {
    score: Math.round(score),
    confianza: Math.round((pesoDisponible / pesoTotal) * 100),
    componentes,
    ausentes: componentes.filter((c) => c.valor === null).map((c) => c.etiqueta),
    calculadoEn: new Date().toISOString(),
  };
}
