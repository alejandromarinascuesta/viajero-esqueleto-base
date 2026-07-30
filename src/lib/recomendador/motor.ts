import type { Perfil, Propuesta, ResultadoRecomendacion, Restriccion } from "./tipos";

export type ExperienciaFila = {
  id: string;
  nombre: string;
  destino: string;
  tipo: string;
  precio_desde_pp: number;
  noches: number;
  temporada_agencia: string;
  horas_vuelo: number;
  apto_ninos: string;
  intensidad: number;
  margen_pct: number;
  cupo: number;
  motivo_1: string | null;
  motivo_2: string | null;
  motivo_3: string | null;
  no_recomendado_si: string | null;
};

export type PesoFila = { clave: string; valor: number };

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const TIPOS_POR_MOTIVACION: Record<string, string[]> = {
  descanso: ["playa"],
  cultura: ["cultural", "ciudad"],
  aventura: ["aventura", "naturaleza"],
  romantico: ["playa", "ciudad"],
  celebracion: [],
};

function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mesEnTemporada(mes: number, temporada: string): boolean {
  const partes = (temporada ?? "").split("-").map((p) => Number.parseInt(p.trim(), 10));
  if (partes.length !== 2 || partes.some((p) => Number.isNaN(p))) return true;
  const [inicio, fin] = partes;
  if (inicio <= fin) return mes >= inicio && mes <= fin;
  // Temporada que cruza el fin de año, p. ej. "10-4" u "11-3".
  return mes >= inicio || mes <= fin;
}

function describirTemporada(temporada: string): string {
  const partes = (temporada ?? "").split("-").map((p) => Number.parseInt(p.trim(), 10));
  if (partes.length !== 2 || partes.some((p) => Number.isNaN(p) || p < 1 || p > 12)) {
    return temporada;
  }
  return `de ${MESES[partes[0] - 1]} a ${MESES[partes[1] - 1]}`;
}

type Evaluacion = {
  fila: ExperienciaFila;
  incumplimientos: string[];
  gravedad: number;
};

function evaluarReglasDuras(fila: ExperienciaFila, perfil: Perfil, personas: number): Evaluacion {
  const incumplimientos: string[] = [];
  let gravedad = 0;

  const limitePorPersona =
    (perfil.presupuestoTotal / personas) * (perfil.presupuestoFlexible ? 1.1 : 1);
  if (fila.precio_desde_pp > limitePorPersona) {
    const exceso = Math.round((fila.precio_desde_pp - limitePorPersona) * personas);
    incumplimientos.push(`${exceso} € por encima del presupuesto`);
    gravedad += 1;
  }

  if (fila.noches > perfil.dias) {
    incumplimientos.push(
      `${fila.noches} noches frente a ${perfil.dias} días disponibles`,
    );
    gravedad += 1;
  }

  const menorDeSeis = perfil.edadesNinos.some((edad) => edad < 6);
  if (menorDeSeis && fila.horas_vuelo > 6) {
    incumplimientos.push(`vuelo de ${fila.horas_vuelo} h con un menor de 6 años`);
    gravedad += 1;
  }

  if (!mesEnTemporada(perfil.mes, fila.temporada_agencia)) {
    incumplimientos.push(
      `fuera de temporada, disponible ${describirTemporada(fila.temporada_agencia)}`,
    );
    gravedad += 1;
  }

  const hayNinos = perfil.edadesNinos.length > 0;
  if (hayNinos && normalizarTexto(fila.apto_ninos) === "bajo") {
    incumplimientos.push("no apto para niños");
    gravedad += 1;
  }

  const noRecomendado = normalizarTexto(fila.no_recomendado_si);
  for (const restriccion of perfil.restricciones as Restriccion[]) {
    if (noRecomendado && noRecomendado.includes(normalizarTexto(restriccion))) {
      incumplimientos.push(`no recomendado si ${restriccion}`);
      gravedad += 1;
    }
  }

  if ((perfil.mes === 7 || perfil.mes === 8) && noRecomendado.includes("julio y agosto")) {
    incumplimientos.push(`no recomendado en ${MESES[perfil.mes - 1]}`);
    gravedad += 1;
  }

  if (fila.cupo === 0) {
    incumplimientos.push("sin cupo disponible");
    gravedad += 1;
  }

  return { fila, incumplimientos, gravedad };
}

function acotar(valor: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, valor));
}

function normalizarEntre(valor: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return acotar((valor - min) / (max - min));
}

function puntuar(
  fila: ExperienciaFila,
  perfil: Perfil,
  pesos: Record<string, number>,
  rangoMargen: { min: number; max: number },
  rangoCupo: { min: number; max: number },
): number {
  const tiposValidos = TIPOS_POR_MOTIVACION[perfil.motivacion] ?? [];
  let encaje = 0;
  if (tiposValidos.includes(normalizarTexto(fila.tipo))) encaje += 0.5;

  const intensidadExperiencia = acotar(fila.intensidad, 1, 5);
  encaje += 0.3 * (1 - Math.abs(intensidadExperiencia - perfil.intensidad) / 4);

  if (perfil.edadesNinos.length > 0 && normalizarTexto(fila.apto_ninos) === "alto") {
    encaje += 0.2;
  }
  if (perfil.destinosVisitados.includes(fila.destino)) encaje -= 0.3;

  const factores: Record<string, number> = {
    encaje_cliente: acotar(encaje),
    demanda: 0.5,
    margen: normalizarEntre(fila.margen_pct, rangoMargen.min, rangoMargen.max),
    campana: 0,
    cupo: 1 - normalizarEntre(fila.cupo, rangoCupo.min, rangoCupo.max),
  };

  const total = Object.values(pesos).reduce((suma, valor) => suma + valor, 0) || 1;
  return Object.entries(factores).reduce(
    (suma, [clave, factor]) => suma + factor * ((pesos[clave] ?? 0) / total),
    0,
  );
}

function aPropuesta(
  fila: ExperienciaFila,
  personas: number,
  puntuacion: number | null,
  incumplimientos: string[],
): Propuesta {
  return {
    id: fila.id,
    nombre: fila.nombre,
    destino: fila.destino,
    precioPorPersona: fila.precio_desde_pp,
    precioTotalGrupo: fila.precio_desde_pp * personas,
    noches: fila.noches,
    motivos: [fila.motivo_1, fila.motivo_2, fila.motivo_3].filter(
      (motivo): motivo is string => Boolean(motivo && motivo.trim()),
    ),
    puntuacion,
    incumplimientos,
  };
}

export function calcularRecomendacion(
  experiencias: ExperienciaFila[],
  filasPesos: PesoFila[],
  perfil: Perfil,
): ResultadoRecomendacion {
  const personas = Math.max(1, perfil.adultos + perfil.edadesNinos.length);
  const pesos = Object.fromEntries(filasPesos.map((p) => [p.clave, p.valor]));

  const evaluaciones = experiencias.map((fila) => evaluarReglasDuras(fila, perfil, personas));
  const supervivientes = evaluaciones.filter((e) => e.incumplimientos.length === 0);

  if (supervivientes.length === 0) {
    const menosGraves = [...evaluaciones]
      .sort((a, b) => a.gravedad - b.gravedad || a.fila.precio_desde_pp - b.fila.precio_desde_pp)
      .slice(0, 2);
    return {
      modo: "sin_supervivientes",
      candidatas: experiencias.length,
      supervivientes: 0,
      propuestas: menosGraves.map((e) => aPropuesta(e.fila, personas, null, e.incumplimientos)),
    };
  }

  const margenes = experiencias.map((f) => f.margen_pct);
  const cupos = experiencias.map((f) => f.cupo);
  const rangoMargen = { min: Math.min(...margenes), max: Math.max(...margenes) };
  const rangoCupo = { min: Math.min(...cupos), max: Math.max(...cupos) };

  const ordenadas = supervivientes
    .map((e) => ({
      fila: e.fila,
      puntuacion: puntuar(e.fila, perfil, pesos, rangoMargen, rangoCupo),
    }))
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, 2);

  return {
    modo: "recomendadas",
    candidatas: experiencias.length,
    supervivientes: supervivientes.length,
    propuestas: ordenadas.map((e) => aPropuesta(e.fila, personas, e.puntuacion, [])),
  };
}
