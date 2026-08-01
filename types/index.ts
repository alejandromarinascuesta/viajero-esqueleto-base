/** Estado de frescura de un dato. Nunca existe el estado "inventado". */
export type Frescura =
  | "live"            // consultado en el momento
  | "fresh"           // dentro de la frecuencia esperada de la fuente
  | "official-latest" // ultima publicacion oficial disponible
  | "cached"          // observacion real guardada
  | "stale"           // la fuente no se ha actualizado en el periodo esperado
  | "unavailable";    // no existe informacion

export type Senal = {
  fuente: "catalogo" | "trends" | "interes" | "clima" | "divisa" | "ine" | "vuelos" | "reservas" | "eventos" | "calendario";
  metrica: string;
  valor: number | null;
  periodo: string;
  /**
   * ok            hay dato real
   * no_disponible la fuente cubre el destino pero no devolvio nada
   * no_aplicable  la fuente NO cubre este destino (el INE no cubre Bali)
   * obsoleta      hay dato pero fuera de su ventana de frescura
   */
  estado: "ok" | "no_disponible" | "no_aplicable" | "obsoleta";
  obtenidoEn: string | null;
};

export type Destino = {
  id: string;
  nombre: string;
  destino: string;
  pais: string;
  lat: number;
  lon: number;
  tipo: string;
  iata: string | null;
  wiki: string | null;
  enCampana: boolean;
  precioDesdePp: number;
  noches: number;
  temporada: string;
  horasVuelo: number;
  visado: string;
  aptoNinos: "alto" | "medio" | "bajo";
  intensidad: number;
  margenPct: number;
  cupo: number;
  motivos: string[];
  noRecomendadoSi: string;
  senales: Senal[];
};

/** Puntuacion de oportunidad, con su procedencia. Cada componente declara si
 *  se ha podido calcular; los que faltan no se rellenan, bajan la confianza. */
export type Oportunidad = {
  /** Ajustado por confianza: es el valor esperado, no el optimista. */
  score: number;
  /** El que saldría si todas las métricas ausentes fueran neutras. */
  scoreSinAjustar: number;
  confianza: number;
  componentes: {
    clave: string;
    etiqueta: string;
    peso: number;
    valor: number | null;
    /** false cuando la fuente no cubre este destino. No resta confianza. */
    aplica: boolean;
    aporta: number;
    origen: string;
  }[];
  ausentes: string[];
  /** Métricas que no aplican a este destino, por geografía o por moneda. */
  noAplicables: string[];
  calculadoEn: string;
};

export type Perfil = {
  adultos: number;
  edadesNinos: number[];
  presupuestoTotal: number;
  presupuestoFlexible: boolean;
  mes: number;
  dias: number;
  /** Fecha concreta de salida en ISO, si el cliente ya la tiene. El mes se
   *  deriva de ella cuando existe. */
  fechaSalida?: string | null;
  motivacion: "descanso" | "cultura" | "aventura" | "romantico" | "celebracion";
  intensidad: number;
  restricciones: string[];
  destinosVisitados: string[];
  tensionDeclarada: string;
  /** Tope derivado de una objeción explícita a un destino del catálogo. */
  precioMaximoReferenciaPp?: number | null;
  destinoReferenciaPrecio?: string | null;
};

export type Propuesta = {
  id: string;
  /** Fechas concretas del viaje, calculadas con la salida y las noches. */
  salida: string | null;
  regreso: string | null;
  nombre: string;
  destino: string;
  precioPorPersona: number;
  precioTotalGrupo: number;
  noches: number;
  motivos: string[];
  puntuacion: number | null;
  incumplimientos: string[];
};

export type Recomendacion = {
  modo: "recomendadas" | "sin_supervivientes" | "sin_opciones";
  candidatas: number;
  supervivientes: number;
  propuestas: Propuesta[];
  mensaje: string | null;
  avisos: string[];
  traza: Record<string, unknown>;
};

export type ActivoVisual = {
  id: string;
  titulo: string;
  url: string;
  miniatura: string;
  paginaFuente: string;
  autor: string;
  licencia: string;
  tipo: "imagen" | "video";
};

export type EscenaContenido = {
  titulo: string;
  textoPantalla: string;
  locucion: string;
  consultaVisual: string;
};

export type PlanContenido = {
  modo: "live-ai" | "fallback-verificado";
  destinoId: string;
  destino: string;
  creadoEn: string;
  concepto: string;
  hook: string;
  audiencia: string;
  objetivo: string;
  tono: string;
  duracion: 15 | 30;
  mezclaVisual: "video" | "mixto" | "fotos";
  escenas: EscenaContenido[];
  caption: string;
  cta: string;
  hashtags: string[];
  hechosUtilizados: string[];
  advertencias: string[];
};
