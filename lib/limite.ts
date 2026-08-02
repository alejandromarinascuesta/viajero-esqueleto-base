import { NextResponse } from "next/server";

/**
 * Limite de peticiones por origen.
 *
 * Las rutas que llaman al modelo cuestan dinero real por invocacion y estan
 * abiertas en internet. Sin un tope, una sola pestania en bucle —o alguien con
 * malas intenciones— puede vaciar el saldo en minutos.
 *
 * Es una ventana deslizante en memoria del proceso. En serverless eso significa
 * que el limite es por instancia y no es exacto: sirve para frenar abuso, no
 * para contabilidad. El limite exacto y compartido necesita almacen externo, y
 * esta declarado como pendiente.
 */

type Registro = { marcas: number[] };
const memoria = new Map<string, Registro>();

export function origen(request: Request) {
  const cabecera = request.headers.get("x-forwarded-for") ?? "";
  return cabecera.split(",")[0].trim() || "desconocido";
}

export function dentroDelLimite(clave: string, maximo: number, ventanaMs: number) {
  const ahora = Date.now();
  const registro = memoria.get(clave) ?? { marcas: [] };
  registro.marcas = registro.marcas.filter((m) => ahora - m < ventanaMs);
  if (registro.marcas.length >= maximo) {
    memoria.set(clave, registro);
    return { permitido: false, restantes: 0, esperaMs: ventanaMs - (ahora - registro.marcas[0]) };
  }
  registro.marcas.push(ahora);
  memoria.set(clave, registro);
  // Limpieza barata: evita que el mapa crezca sin fin en procesos longevos.
  if (memoria.size > 5000) memoria.clear();
  return { permitido: true, restantes: maximo - registro.marcas.length, esperaMs: 0 };
}

/** Devuelve una respuesta de rechazo lista, o null si se puede continuar. */
export function frenar(request: Request, etiqueta: string, maximo = 20, ventanaMs = 60_000) {
  const r = dentroDelLimite(`${etiqueta}:${origen(request)}`, maximo, ventanaMs);
  if (r.permitido) return null;
  return NextResponse.json(
    {
      error: {
        code: "DEMASIADAS_PETICIONES",
        message: `Demasiadas peticiones. Vuelve a intentarlo en ${Math.ceil(r.esperaMs / 1000)} segundos.`,
      },
    },
    { status: 429, headers: { "Retry-After": String(Math.ceil(r.esperaMs / 1000)) } },
  );
}
