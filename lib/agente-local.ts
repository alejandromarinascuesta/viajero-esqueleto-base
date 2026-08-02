"use client";

/**
 * Identificador del navegador que usa el agente.
 *
 * Mientras no haya autenticacion, esto es lo que permite separar el gasto por
 * quien lo genera. Se guarda en el propio navegador y no viaja a ningun sitio
 * salvo a nuestra API, en una cabecera.
 */
const CLAVE = "destination-pulse-agente";

export function idAgente(): string {
  if (typeof window === "undefined") return "servidor";
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return guardado;
    const nuevo = `ag_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLAVE, nuevo);
    return nuevo;
  } catch {
    return "anonimo";
  }
}

/** Cabeceras para cualquier llamada a la API que cueste dinero. */
export function cabecerasAgente(extra: Record<string, string> = {}) {
  return { ...extra, "x-agente": idAgente() };
}
