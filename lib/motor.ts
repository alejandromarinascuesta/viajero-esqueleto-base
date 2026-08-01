import type { Destino, Perfil, Propuesta, Recomendacion } from "@/types";
import { senalMomentum } from "@/lib/signals";

/**
 * Motor de recomendación. Determinista de principio a fin.
 *
 * El principio que ordena todo el sistema: la IA nunca decide. Aquí descarta el
 * código y ordenan los pesos que configura la agencia. El modelo de lenguaje
 * solo interviene antes (leer texto libre) y después (redactar el argumento).
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const TIPOS_POR_MOTIVACION: Record<string, string[]> = {
  descanso: ["playa"],
  cultura: ["cultural", "ciudad"],
  aventura: ["aventura", "naturaleza"],
  romantico: ["playa", "ciudad"],
  celebracion: ["ciudad", "playa"],
};

export const PESOS_POR_DEFECTO = {
  encaje_cliente: 5,
  demanda: 2,
  margen: 3,
  campana: 2,
  cupo: 1,
} as const;

export type Pesos = Record<keyof typeof PESOS_POR_DEFECTO, number>;

const norm = (v: string | null | undefined) =>
  (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function mesEnTemporada(mes: number, temporada: string): boolean {
  const [ini, fin] = (temporada ?? "").split("-").map((p) => Number.parseInt(p, 10));
  // Ante un campo mal formado, la regla dura descarta. No se deja pasar.
  if (!Number.isInteger(ini) || !Number.isInteger(fin)) return false;
  return ini <= fin ? mes >= ini && mes <= fin : mes >= ini || mes <= fin;
}

function describirTemporada(t: string): string {
  const [a, b] = (t ?? "").split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || a > 12 || b < 1 || b > 12) return t;
  return `de ${MESES[a - 1]} a ${MESES[b - 1]}`;
}

type Evaluacion = { destino: Destino; relajables: string[]; inviolables: string[]; exceso: number };

/**
 * Dos niveles de regla dura, y la distinción importa:
 *
 *   RELAJABLES  protegen la calidad de la experiencia. Si no hay alternativa,
 *               pueden proponerse avisando y diciendo por cuánto se pasan.
 *   INVIOLABLES protegen al cliente o a la operación. No aparecen nunca.
 *
 * Pasarse 50 € del presupuesto no puede pesar lo mismo que un vuelo de diez
 * horas con un bebé.
 */
export type Veto = { destinoId: string; mes: number | null; motivo: string };

export function evaluarReglas(
  d: Destino,
  p: Perfil,
  personas: number,
  vetos: Veto[] = [],
): Evaluacion {
  const relajables: string[] = [];
  const inviolables: string[] = [];
  const veto = norm(d.noRecomendadoSi);

  // --- relajables ---
  const topePorPersona = (p.presupuestoTotal / personas) * (p.presupuestoFlexible ? 1.1 : 1);
  let exceso = 0;
  if (d.precioDesdePp > topePorPersona) {
    exceso = Math.round((d.precioDesdePp - topePorPersona) * personas);
    relajables.push(`${exceso} € por encima del presupuesto`);
  }
  if (d.noches > p.dias) relajables.push(`${d.noches} noches frente a ${p.dias} días disponibles`);
  if (!mesEnTemporada(p.mes, d.temporada))
    relajables.push(`fuera de temporada, disponible ${describirTemporada(d.temporada)}`);
  if (veto.includes("julio y agosto") && (p.mes === 7 || p.mes === 8))
    relajables.push(`no recomendado en ${MESES[p.mes - 1]} por calidad de la experiencia`);

  // --- inviolables ---
  const menorDeSeis = p.edadesNinos.some((e) => e < 6);
  if (menorDeSeis && d.horasVuelo > 6)
    inviolables.push(`vuelo de ${d.horasVuelo} h con un menor de 6 años`);
  if (p.restricciones.includes("no vuelos largos") && d.horasVuelo > 4)
    inviolables.push(`vuelo de ${d.horasVuelo} h con la restricción «no vuelos largos»`);
  for (const r of p.restricciones) {
    if (r === "no vuelos largos") continue;
    if (veto && veto.includes(norm(r))) inviolables.push(`no recomendado si ${r}`);
  }
  if (p.edadesNinos.length > 0 && norm(d.aptoNinos) === "bajo") inviolables.push("no apto para niños");
  if (
    p.precioMaximoReferenciaPp &&
    d.precioDesdePp >= p.precioMaximoReferenciaPp
  ) {
    inviolables.push(
      `${d.precioDesdePp} € por persona: el cliente ya considera caro ${p.destinoReferenciaPrecio ?? "un destino"} desde ${p.precioMaximoReferenciaPp} €`,
    );
  }
  if (d.cupo === 0) inviolables.push("sin cupo disponible");
  if (norm(d.visado) === "si" && diasHastaMes(p.mes) < 30)
    inviolables.push(`trámite de visado: quedan ${diasHastaMes(p.mes)} días`);

  // Veto comercial de la direccion. No se relaja: si la agencia ha decidido no
  // vender un destino, el agente no puede saltarselo.
  for (const v of vetos) {
    if (v.destinoId !== d.id) continue;
    if (v.mes !== null && v.mes !== p.mes) continue;
    inviolables.push(`veto comercial${v.motivo ? `: ${v.motivo}` : ""}`);
  }

  return { destino: d, relajables, inviolables, exceso };
}

function diasHastaMes(mes: number, hoy = new Date()): number {
  const mesActual = hoy.getUTCMonth() + 1;
  const anio = mes > mesActual ? hoy.getUTCFullYear() : hoy.getUTCFullYear() + (mes === mesActual ? 0 : 1);
  const objetivo = Date.UTC(anio, mes - 1, 1);
  return Math.round((objetivo - hoy.getTime()) / 86400000);
}

const acotar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function puntuar(
  d: Destino,
  p: Perfil,
  pesos: Pesos,
  rango: { margenMin: number; margenMax: number; cupoMax: number },
  campanas: string[] = [],
) {
  const tipos = TIPOS_POR_MOTIVACION[p.motivacion] ?? [];
  let encaje = 0;
  if (tipos.includes(norm(d.tipo))) encaje += 0.5;
  encaje += 0.3 * (1 - Math.abs(acotar(d.intensidad, 1, 5) - p.intensidad) / 4);
  if (p.edadesNinos.length > 0 && norm(d.aptoNinos) === "alto") encaje += 0.2;
  if (p.destinosVisitados.includes(d.destino)) encaje -= 0.3;

  const interes = senalMomentum(d)?.valor;
  const factores: Record<keyof Pesos, number> = {
    encaje_cliente: acotar(encaje),
    // Sin señal de demanda el factor es neutro, no cero: no penaliza al destino
    // por un fallo de una fuente externa.
    demanda: interes == null ? 0.5 : acotar((interes + 50) / 100),
    margen: rango.margenMax === rango.margenMin ? 0.5 : acotar((d.margenPct - rango.margenMin) / (rango.margenMax - rango.margenMin)),
    campana: campanas.includes(d.id) ? 1 : 0,
    cupo: 1 - acotar(d.cupo / Math.max(1, rango.cupoMax)),
  };

  const total = Object.values(pesos).reduce((s, v) => s + v, 0) || 1;
  return (Object.keys(factores) as (keyof Pesos)[]).reduce(
    (s, k) => s + factores[k] * (pesos[k] / total),
    0,
  );
}

function fechas(salida: string | null, noches: number) {
  if (!salida) return { salida: null, regreso: null };
  const ida = new Date(salida);
  if (Number.isNaN(ida.getTime())) return { salida: null, regreso: null };
  const vuelta = new Date(ida);
  vuelta.setUTCDate(vuelta.getUTCDate() + noches);
  return { salida: ida.toISOString().slice(0, 10), regreso: vuelta.toISOString().slice(0, 10) };
}

function aPropuesta(
  d: Destino,
  personas: number,
  puntuacion: number | null,
  incumplimientos: string[],
  fechaSalida: string | null = null,
): Propuesta {
  return {
    id: d.id,
    ...fechas(fechaSalida, d.noches),
    nombre: d.nombre,
    destino: d.destino,
    precioPorPersona: d.precioDesdePp,
    precioTotalGrupo: d.precioDesdePp * personas,
    noches: d.noches,
    motivos: d.motivos,
    puntuacion,
    incumplimientos,
  };
}

export type Criterio = { pesos: Pesos; campanas: string[]; vetos: Veto[] };

export function recomendar(
  destinos: Destino[],
  perfil: Perfil,
  criterio: Partial<Criterio> = {},
  excluidos: string[] = [],
): Recomendacion {
  const pesos = criterio.pesos ?? { ...PESOS_POR_DEFECTO };
  const campanas = criterio.campanas ?? [];
  const vetos = criterio.vetos ?? [];
  const personas = Math.max(1, perfil.adultos + perfil.edadesNinos.length);
  const candidatas = destinos.filter((d) => !excluidos.includes(d.id));
  const evaluaciones = candidatas.map((d) => evaluarReglas(d, perfil, personas, vetos));

  const descartadasPor: Record<string, number> = {};
  for (const e of evaluaciones) {
    for (const motivo of [...e.relajables, ...e.inviolables]) {
      const clave = motivo.split(":")[0].split(",")[0].replace(/\d+/g, "N").trim();
      descartadasPor[clave] = (descartadasPor[clave] ?? 0) + 1;
    }
  }

  const supervivientes = evaluaciones.filter((e) => e.relajables.length === 0 && e.inviolables.length === 0);
  const trazaBase = {
    candidatas: candidatas.length,
    supervivientes: supervivientes.length,
    descartadasPor,
    pesos,
    campanas,
    vetos: vetos.length,
    excluidos,
  };

  if (supervivientes.length === 0) {
    // Solo se puede proponer lo que incumple reglas relajables. Lo que rompe
    // una inviolable no aparece ni como alternativa.
    const relajablesSolo = evaluaciones
      .filter((e) => e.inviolables.length === 0)
      .sort((a, b) => a.exceso - b.exceso || a.relajables.length - b.relajables.length)
      .slice(0, 2);

    if (relajablesSolo.length === 0) {
      return {
        modo: "sin_opciones",
        candidatas: candidatas.length,
        supervivientes: 0,
        propuestas: [],
        mensaje:
          "No hay ninguna opción admisible: todas las experiencias incumplen alguna regla que no se puede relajar (vuelo largo con menores, restricciones declaradas, cupo o visado).",
        avisos: [],
        traza: trazaBase,
      };
    }
    return {
      modo: "sin_supervivientes",
      candidatas: candidatas.length,
      supervivientes: 0,
      propuestas: relajablesSolo.map((e) => aPropuesta(e.destino, personas, null, e.relajables, perfil.fechaSalida ?? null)),
      mensaje: "Ninguna opción cumple todo. Estas son las que menos incumplen, con lo que se pasan.",
      avisos: [],
      traza: trazaBase,
    };
  }

  const margenes = candidatas.map((d) => d.margenPct);
  const rango = {
    margenMin: Math.min(...margenes),
    margenMax: Math.max(...margenes),
    cupoMax: Math.max(...candidatas.map((d) => d.cupo)),
  };

  const ordenadas = supervivientes
    .map((e) => ({ destino: e.destino, puntuacion: puntuar(e.destino, perfil, pesos, rango, campanas) }))
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, 2);

  return {
    modo: "recomendadas",
    candidatas: candidatas.length,
    supervivientes: supervivientes.length,
    propuestas: ordenadas.map((o) => aPropuesta(o.destino, personas, o.puntuacion, [], perfil.fechaSalida ?? null)),
    mensaje: null,
    avisos: [],
    traza: trazaBase,
  };
}
