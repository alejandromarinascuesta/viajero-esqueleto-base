import type { Perfil, Propuesta, ResultadoRecomendacion, Restriccion, VetoFila } from "./tipos";

export type ExperienciaFila = {
  id: string;
  nombre: string;
  destino: string;
  tipo: string;
  precio_desde_pp: number;
  noches: number;
  temporada_agencia: string;
  horas_vuelo: number;
  visado: string;
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

export type OpcionesRecomendacion = {
  vetos: VetoFila[];
  campanas: string[];
  excluidos: string[];
  afinar: string;
  hoy?: Date;
};

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

/**
 * Ante la duda, la regla dura descarta: un campo mal formado devuelve false.
 */
export function mesEnTemporada(
  mes: number,
  temporada: string,
  avisar?: (aviso: string) => void,
): boolean {
  const partes = (temporada ?? "").split("-").map((p) => Number.parseInt(p.trim(), 10));
  const valido =
    partes.length === 2 && partes.every((p) => Number.isInteger(p) && p >= 1 && p <= 12);
  if (!valido) {
    avisar?.(`temporada_agencia mal formada: «${temporada ?? ""}»`);
    return false;
  }
  const [inicio, fin] = partes;
  if (inicio <= fin) return mes >= inicio && mes <= fin;
  // Temporada que cruza el fin de año, p. ej. "10-4" u "11-3".
  return mes >= inicio || mes <= fin;
}

function describirTemporada(temporada: string): string {
  const partes = (temporada ?? "").split("-").map((p) => Number.parseInt(p.trim(), 10));
  if (partes.length !== 2 || partes.some((p) => Number.isNaN(p) || p < 1 || p > 12)) {
    return "sin temporada válida en ficha";
  }
  return `de ${MESES[partes[0] - 1]} a ${MESES[partes[1] - 1]}`;
}

export function diasHastaMes(mes: number, hoy: Date): number {
  const anio =
    mes > hoy.getMonth() + 1
      ? hoy.getFullYear()
      : hoy.getFullYear() + (mes === hoy.getMonth() + 1 ? 0 : 1);
  const objetivo = new Date(Date.UTC(anio, mes - 1, 1));
  const referencia = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  return Math.round((objetivo.getTime() - referencia.getTime()) / 86400000);
}

type Evaluacion = {
  fila: ExperienciaFila;
  relajables: string[];
  inviolables: string[];
  excesoPresupuesto: number;
};

function evaluarReglasDuras(
  fila: ExperienciaFila,
  perfil: Perfil,
  personas: number,
  opciones: OpcionesRecomendacion,
  avisar: (aviso: string) => void,
): Evaluacion {
  const relajables: string[] = [];
  const inviolables: string[] = [];

  // RELAJABLES ---------------------------------------------------------
  const limitePorPersona =
    (perfil.presupuestoTotal / personas) * (perfil.presupuestoFlexible ? 1.1 : 1);
  let excesoPresupuesto = 0;
  if (fila.precio_desde_pp > limitePorPersona) {
    excesoPresupuesto = Math.round((fila.precio_desde_pp - limitePorPersona) * personas);
    relajables.push(`${excesoPresupuesto} € por encima del presupuesto`);
  }

  if (fila.noches > perfil.dias) {
    relajables.push(`${fila.noches} noches frente a ${perfil.dias} días disponibles`);
  }

  if (!mesEnTemporada(perfil.mes, fila.temporada_agencia, avisar)) {
    relajables.push(`fuera de temporada, disponible ${describirTemporada(fila.temporada_agencia)}`);
  }

  // Calidad de la experiencia, no seguridad: si el cliente insiste, el agente
  // debe poder proponerlo con el aviso visible.
  const noRecomendado = normalizarTexto(fila.no_recomendado_si);
  if ((perfil.mes === 7 || perfil.mes === 8) && noRecomendado.includes("julio y agosto")) {
    relajables.push(`no recomendado en ${MESES[perfil.mes - 1]} por calidad de la experiencia`);
  }

  // INVIOLABLES --------------------------------------------------------
  const menorDeSeis = perfil.edadesNinos.some((edad) => edad < 6);
  if (menorDeSeis && fila.horas_vuelo > 6) {
    inviolables.push(`vuelo de ${fila.horas_vuelo} h con un menor de 6 años`);
  }

  if (perfil.restricciones.includes("no vuelos largos") && fila.horas_vuelo > 4) {
    inviolables.push(`vuelo de ${fila.horas_vuelo} h con la restricción «no vuelos largos»`);
  }

  for (const restriccion of perfil.restricciones as Restriccion[]) {
    if (restriccion === "no vuelos largos") continue;
    if (noRecomendado && noRecomendado.includes(normalizarTexto(restriccion))) {
      inviolables.push(`no recomendado si ${restriccion}`);
    }
  }

  const hayNinos = perfil.edadesNinos.length > 0;
  if (hayNinos && normalizarTexto(fila.apto_ninos) === "bajo") {
    inviolables.push("no apto para niños");
  }

  if (fila.cupo === 0) {
    inviolables.push("sin cupo disponible");
  }

  if (normalizarTexto(fila.visado) === "si") {
    const dias = diasHastaMes(perfil.mes, opciones.hoy ?? new Date());
    if (dias < 30) {
      inviolables.push(`trámite de visado: solo faltan ${dias} días para el mes del viaje`);
    }
  }

  const veto = opciones.vetos.find(
    (v) =>
      v.activo !== false &&
      v.destino_id === fila.id &&
      (v.mes === null || v.mes === undefined || v.mes === perfil.mes),
  );
  if (veto) {
    inviolables.push(`vetado por criterio comercial${veto.motivo ? `: ${veto.motivo}` : ""}`);
  }

  return { fila, relajables, inviolables, excesoPresupuesto };
}

function acotar(valor: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, valor));
}

function normalizarEntre(valor: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return acotar((valor - min) / (max - min));
}

type Ajuste = { barato: boolean; vueloCorto: boolean; corto: boolean; suave: boolean };

export function interpretarAfinar(texto: string): Ajuste {
  const t = normalizarTexto(texto);
  return {
    barato: /barat|economic|precio|ajustad/.test(t),
    vueloCorto: /vuelo (mas )?cort|menos vuelo|cerca|proxim/.test(t),
    corto: /menos noches|viaje (mas )?cort|menos dias/.test(t),
    suave: /suave|tranquil|menos intens|relaj/.test(t),
  };
}

function puntuar(
  fila: ExperienciaFila,
  perfil: Perfil,
  pesos: Record<string, number>,
  rangos: {
    margen: { min: number; max: number };
    cupo: { min: number; max: number };
    precio: { min: number; max: number };
    vuelo: { min: number; max: number };
    noches: { min: number; max: number };
  },
  campanas: string[],
  ajuste: Ajuste,
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
    margen: normalizarEntre(fila.margen_pct, rangos.margen.min, rangos.margen.max),
    campana: campanas.includes(fila.id) ? 1 : 0,
    cupo: 1 - normalizarEntre(fila.cupo, rangos.cupo.min, rangos.cupo.max),
  };

  const total = Object.values(pesos).reduce((suma, valor) => suma + valor, 0) || 1;
  let puntuacion = Object.entries(factores).reduce(
    (suma, [clave, factor]) => suma + factor * ((pesos[clave] ?? 0) / total),
    0,
  );

  // Afinado del agente: reordena sin saltarse ninguna regla dura.
  if (ajuste.barato) {
    puntuacion +=
      0.25 * (1 - normalizarEntre(fila.precio_desde_pp, rangos.precio.min, rangos.precio.max));
  }
  if (ajuste.vueloCorto) {
    puntuacion +=
      0.25 * (1 - normalizarEntre(fila.horas_vuelo, rangos.vuelo.min, rangos.vuelo.max));
  }
  if (ajuste.corto) {
    puntuacion += 0.15 * (1 - normalizarEntre(fila.noches, rangos.noches.min, rangos.noches.max));
  }
  if (ajuste.suave) {
    puntuacion += 0.15 * (1 - acotar((fila.intensidad - 1) / 4));
  }

  return puntuacion;
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
    motivos: [fila.motivo_1, fila.motivo_2, fila.motivo_3].filter((motivo): motivo is string =>
      Boolean(motivo && motivo.trim()),
    ),
    puntuacion,
    incumplimientos,
  };
}

function rango(valores: number[]): { min: number; max: number } {
  if (valores.length === 0) return { min: 0, max: 1 };
  return { min: Math.min(...valores), max: Math.max(...valores) };
}

export function calcularRecomendacion(
  todas: ExperienciaFila[],
  filasPesos: PesoFila[],
  perfil: Perfil,
  opciones: OpcionesRecomendacion,
): ResultadoRecomendacion {
  const personas = Math.max(1, perfil.adultos + perfil.edadesNinos.length);
  const pesos = Object.fromEntries(filasPesos.map((p) => [p.clave, p.valor]));
  const avisos: string[] = [];
  const avisar = (aviso: string) => {
    if (!avisos.includes(aviso)) avisos.push(aviso);
    console.warn(`[recomendador] ${aviso}`);
  };

  const experiencias = todas.filter((f) => !opciones.excluidos.includes(f.id));

  const evaluaciones = experiencias.map((fila) =>
    evaluarReglasDuras(fila, perfil, personas, opciones, avisar),
  );
  const supervivientes = evaluaciones.filter(
    (e) => e.relajables.length === 0 && e.inviolables.length === 0,
  );

  if (supervivientes.length === 0) {
    // Solo se pueden proponer experiencias que incumplan reglas relajables.
    const admisibles = evaluaciones
      .filter((e) => e.inviolables.length === 0)
      .sort(
        (a, b) =>
          a.excesoPresupuesto - b.excesoPresupuesto ||
          a.relajables.length - b.relajables.length ||
          a.fila.precio_desde_pp - b.fila.precio_desde_pp,
      );

    if (admisibles.length === 0) {
      return {
        modo: "sin_opciones",
        candidatas: experiencias.length,
        supervivientes: 0,
        propuestas: [],
        mensaje:
          "No hay ninguna opción admisible: todas las experiencias del catálogo incumplen alguna regla inviolable (restricciones declaradas del cliente, vuelo largo con menor de 6 años, veto comercial, trámite de visado o falta de cupo). Estas reglas no se pueden relajar.",
        avisos,
      };
    }

    return {
      modo: "sin_supervivientes",
      candidatas: experiencias.length,
      supervivientes: 0,
      propuestas: admisibles
        .slice(0, 2)
        .map((e) => aPropuesta(e.fila, personas, null, e.relajables)),
      mensaje:
        "Ninguna experiencia cumple todas las reglas. Se muestran las que menos se pasan, solo con incumplimientos relajables (presupuesto, noches o temporada).",
      avisos,
    };
  }

  const rangos = {
    margen: rango(experiencias.map((f) => f.margen_pct)),
    cupo: rango(experiencias.map((f) => f.cupo)),
    precio: rango(experiencias.map((f) => f.precio_desde_pp)),
    vuelo: rango(experiencias.map((f) => f.horas_vuelo)),
    noches: rango(experiencias.map((f) => f.noches)),
  };
  const ajuste = interpretarAfinar(opciones.afinar);

  const ordenadas = supervivientes
    .map((e) => ({
      fila: e.fila,
      puntuacion: puntuar(e.fila, perfil, pesos, rangos, opciones.campanas, ajuste),
    }))
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, 2);

  return {
    modo: "recomendadas",
    candidatas: experiencias.length,
    supervivientes: supervivientes.length,
    propuestas: ordenadas.map((e) => aPropuesta(e.fila, personas, e.puntuacion, [])),
    mensaje: null,
    avisos,
  };
}
