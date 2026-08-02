import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto por peticion.
 *
 * El registro de consumo tiene que saber a quien atribuir cada llamada, pero
 * las funciones que llaman al modelo estan varias capas por debajo de la ruta
 * y pasarles el actor a mano ensuciaria todas las firmas. Una variable de
 * modulo tampoco vale: dos peticiones simultaneas en la misma instancia se
 * pisarian. AsyncLocalStorage da un contexto que viaja con la peticion.
 */
const almacen = new AsyncLocalStorage<{ actor: string }>();

/**
 * Hoy no hay autenticacion, asi que el actor es un identificador de navegador
 * que genera el cliente y viaja en una cabecera. No es una identidad: es un
 * marcador estable que permite ver el gasto separado por quien lo genera.
 * Cuando exista SSO, aqui entra el usuario real y no cambia nada mas.
 */
export function actorDe(request: Request) {
  const cabecera = request.headers.get("x-agente") ?? "";
  const limpio = cabecera.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return limpio || "anonimo";
}

export function conActor<T>(actor: string, tarea: () => Promise<T>) {
  return almacen.run({ actor }, tarea);
}

export function actorActual() {
  return almacen.getStore()?.actor ?? "anonimo";
}
