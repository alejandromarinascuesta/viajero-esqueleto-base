export type Motivacion = "descanso" | "cultura" | "aventura" | "romantico" | "celebracion";

export const MOTIVACIONES: { valor: Motivacion; etiqueta: string }[] = [
  { valor: "descanso", etiqueta: "Descanso" },
  { valor: "cultura", etiqueta: "Cultura" },
  { valor: "aventura", etiqueta: "Aventura" },
  { valor: "romantico", etiqueta: "Romántico" },
  { valor: "celebracion", etiqueta: "Celebración" },
];

export type Restriccion = "movilidad reducida" | "no vuelos largos" | "presupuesto ajustado";

export const RESTRICCIONES: { valor: Restriccion; etiqueta: string }[] = [
  { valor: "movilidad reducida", etiqueta: "Movilidad reducida" },
  { valor: "no vuelos largos", etiqueta: "No vuelos largos" },
  { valor: "presupuesto ajustado", etiqueta: "Presupuesto ajustado" },
];

export type Perfil = {
  adultos: number;
  edadesNinos: number[];
  presupuestoTotal: number;
  presupuestoFlexible: boolean;
  mes: number;
  dias: number;
  motivacion: Motivacion;
  intensidad: number;
  restricciones: Restriccion[];
  destinosVisitados: string[];
  tensionDeclarada: string;
};

export type Propuesta = {
  id: string;
  nombre: string;
  destino: string;
  precioPorPersona: number;
  precioTotalGrupo: number;
  noches: number;
  motivos: string[];
  puntuacion: number | null;
  incumplimientos: string[];
};

export type ResultadoRecomendacion = {
  modo: "recomendadas" | "sin_supervivientes";
  candidatas: number;
  supervivientes: number;
  propuestas: Propuesta[];
};
