"use client";

/**
 * Lectura segura de una respuesta de la API.
 *
 * Cuando una funcion del servidor agota su tiempo, la plataforma devuelve una
 * pagina de error en texto, no JSON. Hacer `.json()` sobre eso reventaba con
 * «Unexpected token 'A'», que no le dice nada a nadie. Aqui se detecta y se
 * traduce a algo accionable.
 */
export async function leerJson<T>(r: Response): Promise<T> {
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    const texto = (await r.text()).slice(0, 200);
    if (r.status === 504 || /timeout|timed out/i.test(texto)) {
      throw new Error(
        "La operación ha tardado más de lo permitido y el servidor la ha cortado. Vuelve a intentarlo.",
      );
    }
    throw new Error(
      r.ok ? "El servidor ha devuelto una respuesta inesperada." : `El servidor ha respondido ${r.status}.`,
    );
  }
  const datos = (await r.json()) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(datos.error?.message ?? `El servidor ha respondido ${r.status}.`);
  return datos;
}
