import type { Destino, Oportunidad } from "@/types";
import { senalMasReciente, senalMomentum } from "@/lib/signals";

/**
 * Opportunity Score: qué destinos merece la pena promover al mercado.
 *
 * Cinco reglas que lo gobiernan:
 *
 * 1. Solo se calcula con métricas REALMENTE disponibles. Nada se rellena con
 *    una media, una estimación ni un valor generado.
 * 2. Momentum y volumen son cosas distintas. Un +40 % sobre doscientas visitas
 *    no vale lo mismo que un +40 % sobre doscientas mil, y por eso el volumen
 *    absoluto entra con su propio peso.
 * 3. Si una fuente NO CUBRE un destino —el INE no cubre Bali—, eso no es un
 *    dato que falte: es una métrica que no aplica, y no puede restar confianza.
 * 4. Si una fuente sí cubre el destino y no devolvió dato, su peso se reparte y
 *    la confianza baja.
 * 5. El score publicado va ajustado por confianza. Sin ese ajuste, repartir el
 *    peso de una métrica ausente premiaría al destino por no tener datos.
 *
 * Es determinista: mismas señales, mismo número. Ningún modelo generativo
 * interviene aquí.
 */

const PESOS = [
  { clave: "momentum", etiqueta: "Momentum de búsquedas", peso: 35, origen: "Google Trends si está importado; Wikimedia como respaldo" },
  { clave: "volumen", etiqueta: "Volumen de atención", peso: 20, origen: "Wikimedia · visitas medias al día" },
  { clave: "margen", etiqueta: "Atractivo económico", peso: 20, origen: "Catálogo de la agencia" },
  { clave: "disponibilidad", etiqueta: "Cupo disponible", peso: 15, origen: "Catálogo de la agencia" },
  { clave: "clima", etiqueta: "Idoneidad climática", peso: 10, origen: "Open-Meteo · archivo histórico" },
] as const;

const acotar = (v: number) => Math.min(1, Math.max(0, v));

function senal(d: Destino, metrica: string): { valor: number | null; aplica: boolean } {
  const actual = senalMasReciente(d.senales, metrica);
  if (actual) return { valor: actual.valor, aplica: true };

  const candidatas = d.senales.filter((x) => x.metrica === metrica);
  if (candidatas.length > 0 && candidatas.every((x) => x.estado === "no_aplicable")) {
    return { valor: null, aplica: false };
  }
  return { valor: null, aplica: true };
}

function componente(clave: string, d: Destino): { valor: number | null; aplica: boolean; origen?: string } {
  if (clave === "momentum") {
    // Trends mide intencion de viaje; Wikipedia mide atencion. Cuando hay
    // Trends manda Trends, y si no se usa Wikipedia como respaldo declarado.
    const elegida = senalMomentum(d);
    // -50 % -> 0 · 0 % -> 0,5 · +50 % -> 1
    return {
      valor: elegida?.valor === null || elegida?.valor === undefined
        ? null
        : acotar((elegida.valor + 50) / 100),
      aplica: true,
      origen: elegida
        ? elegida.fuente === "trends"
          ? `Google Trends · exportación real · ${elegida.periodo}`
          : `Wikimedia Pageviews · respaldo de atención · ${elegida.periodo}`
        : "Google Trends si está importado; Wikimedia como respaldo",
    };
  }
  if (clave === "volumen") {
    const { valor, aplica } = senal(d, "volumen_atencion_dia");
    if (valor === null) return { valor: null, aplica };
    // Escala logarítmica: entre 100 y 100.000 visitas al día hay tres órdenes
    // de magnitud, y una escala lineal aplastaría todo lo que no sea Nueva York.
    return { valor: acotar((Math.log10(Math.max(1, valor)) - 2) / 3), aplica };
  }
  if (clave === "margen") return { valor: acotar((d.margenPct - 15) / 15), aplica: true };
  if (clave === "disponibilidad") return { valor: acotar(d.cupo / 30), aplica: true };
  if (clave === "clima") {
    const { valor, aplica } = senal(d, "temperatura_media");
    if (valor === null) return { valor: null, aplica };
    // 24 °C como óptimo de confort; se penaliza al alejarse.
    return { valor: acotar(1 - Math.abs(valor - 24) / 18), aplica };
  }
  return { valor: null, aplica: true };
}

export function opportunityScore(d: Destino): Oportunidad {
  const componentes = PESOS.map((p) => {
    const { valor, aplica, origen } = componente(p.clave, d);
    return { clave: p.clave, etiqueta: p.etiqueta, peso: p.peso, valor, aplica, aporta: 0, origen: origen ?? p.origen };
  });

  // Las que no aplican salen del denominador: no penalizan.
  const aplicables = componentes.filter((c) => c.aplica);
  const disponibles = aplicables.filter((c) => c.valor !== null);
  const pesoAplicable = aplicables.reduce((s, c) => s + c.peso, 0);
  const pesoDisponible = disponibles.reduce((s, c) => s + c.peso, 0);

  let score = 0;
  if (pesoDisponible > 0) {
    for (const c of componentes) {
      if (c.valor === null) continue;
      c.aporta = (c.valor * c.peso * 100) / pesoDisponible;
      score += c.aporta;
    }
  }

  const confianza = pesoAplicable > 0 ? pesoDisponible / pesoAplicable : 0;
  // Ajuste conservador: con confianza total no penaliza; con la mitad de las
  // métricas el score baja un 25 %.
  const ajustado = score * (0.5 + 0.5 * confianza);

  return {
    score: Math.round(ajustado),
    scoreSinAjustar: Math.round(score),
    confianza: Math.round(confianza * 100),
    componentes,
    ausentes: componentes.filter((c) => c.aplica && c.valor === null).map((c) => c.etiqueta),
    noAplicables: componentes.filter((c) => !c.aplica).map((c) => c.etiqueta),
    calculadoEn: new Date().toISOString(),
  };
}
