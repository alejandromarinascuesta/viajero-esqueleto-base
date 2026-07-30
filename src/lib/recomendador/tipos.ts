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

export const CLAVES_PESOS = [
  "encaje_cliente",
  "demanda",
  "margen",
  "campana",
  "cupo",
] as const;

export type ClavePeso = (typeof CLAVES_PESOS)[number];

export const ETIQUETAS_PESOS: Record<ClavePeso, string> = {
  encaje_cliente: "Encaje con el cliente",
  demanda: "Demanda",
  margen: "Margen",
  campana: "Campaña",
  cupo: "Cupo",
};

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

export type PeticionRecomendacion = {
  perfil: Perfil;
  excluidos: string[];
  afinar: string;
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
  modo: "recomendadas" | "sin_supervivientes" | "sin_opciones";
  candidatas: number;
  supervivientes: number;
  propuestas: Propuesta[];
  mensaje: string | null;
  avisos: string[];
  recomendacionId?: number | null;
};

export type VetoFila = {
  id: number;
  destino_id: string | null;
  mes: number | null;
  motivo: string | null;
  activo: boolean | null;
};
