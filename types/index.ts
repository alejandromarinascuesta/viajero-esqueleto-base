/** Estado de frescura de un dato. Nunca existe el estado "inventado". */
export type Frescura =
  | "live"            // consultado en el momento
  | "fresh"           // dentro de la frecuencia esperada de la fuente
  | "official-latest" // ultima publicacion oficial disponible
  | "cached"          // observacion real guardada
  | "stale"           // la fuente no se ha actualizado en el periodo esperado
  | "unavailable";    // no existe informacion

export type Senal = {
  fuente: "catalogo" | "interes" | "clima" | "divisa" | "vuelos" | "reservas" | "eventos" | "calendario";
  metrica: string;
  valor: number | null;
  periodo: string;
  estado: "ok" | "no_disponible" | "obsoleta";
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
    aporta: number;
    origen: string;
  }[];
  ausentes: string[];
  calculadoEn: string;
};

export type Perfil = {
  adultos: number;
  edadesNinos: number[];
  presupuestoTotal: number;
  presupuestoFlexible: boolean;
  mes: number;
  dias: number;
  motivacion: "descanso" | "cultura" | "aventura" | "romantico" | "celebracion";
  intensidad: number;
  restricciones: string[];
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

export type Recomendacion = {
  modo: "recomendadas" | "sin_supervivientes" | "sin_opciones";
  candidatas: number;
  supervivientes: number;
  propuestas: Propuesta[];
  mensaje: string | null;
  avisos: string[];
  traza: Record<string, unknown>;
};
