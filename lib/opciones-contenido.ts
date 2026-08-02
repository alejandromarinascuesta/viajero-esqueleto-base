/**
 * Opciones del brief de contenido.
 *
 * Viven aparte de lib/content.ts a proposito: la interfaz necesita esta lista,
 * y si la importara de alli arrastraria al navegador toda la cadena del
 * servidor —cliente de modelo, registro de consumo, contexto de peticion—.
 * Constantes compartidas, sin dependencias.
 */
export const OBJETIVOS_CONTENIDO = [
  "Generar solicitudes de presupuesto",
  "Inspirar y aumentar notoriedad",
] as const;

export type ObjetivoContenido = (typeof OBJETIVOS_CONTENIDO)[number];
