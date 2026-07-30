import { PESOS_POR_DEFECTO, type Criterio, type Pesos, type Veto } from "@/lib/motor";

/**
 * El criterio comercial de la agencia: cuánto pesa cada factor, qué destinos
 * están en campaña y cuáles están vetados.
 *
 * Es lo que convierte un algoritmo en una plataforma. Sin esto, los pesos
 * serían una decisión del desarrollador cableada en el código; con esto, la
 * dirección cambia lo que proponen todos los agentes sin tocar nada.
 *
 * Se persiste en la base de datos si está configurada. Si no, la plataforma
 * funciona igual con los valores por defecto y lo indica.
 */

export const CLAVES_PESOS = ["encaje_cliente", "demanda", "margen", "campana", "cupo"] as const;

export const ETIQUETAS: Record<keyof Pesos, { nombre: string; explica: string }> = {
  encaje_cliente: {
    nombre: "Encaje con el cliente",
    explica: "Cuánto manda lo que le va bien a este cliente concreto frente a lo que interesa vender.",
  },
  demanda: {
    nombre: "Demanda del destino",
    explica: "Cuánto empuja que el destino esté captando atención ahora mismo.",
  },
  margen: {
    nombre: "Margen",
    explica: "Cuánto prioriza lo que más deja por reserva.",
  },
  campana: {
    nombre: "Destinos de campaña",
    explica: "Cuánto suben los destinos que la dirección ha marcado este trimestre.",
  },
  cupo: {
    nombre: "Liquidar cupo",
    explica: "Cuánto prioriza vaciar las plazas que quedan sin vender.",
  },
};

function credenciales() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && clave ? { url, cabeceras: { apikey: clave, Authorization: `Bearer ${clave}` } } : null;
}

export type CriterioGuardado = Criterio & { persistido: boolean };

export async function leerCriterio(): Promise<CriterioGuardado> {
  const base: CriterioGuardado = {
    pesos: { ...PESOS_POR_DEFECTO },
    campanas: [],
    vetos: [],
    persistido: false,
  };
  const c = credenciales();
  if (!c) return base;

  try {
    const [pesosRes, vetosRes] = await Promise.all([
      fetch(`${c.url}/rest/v1/pesos?select=clave,valor`, { headers: c.cabeceras, cache: "no-store" }),
      fetch(`${c.url}/rest/v1/vetos?select=destino_id,mes,motivo,activo`, { headers: c.cabeceras, cache: "no-store" }),
    ]);
    if (!pesosRes.ok) return base;

    const filas = (await pesosRes.json()) as { clave: string; valor: number }[];
    const pesos = { ...PESOS_POR_DEFECTO } as Pesos;
    for (const f of filas) {
      if ((CLAVES_PESOS as readonly string[]).includes(f.clave)) {
        pesos[f.clave as keyof Pesos] = Math.min(5, Math.max(1, Number(f.valor)));
      }
    }

    let vetos: Veto[] = [];
    if (vetosRes.ok) {
      const v = (await vetosRes.json()) as { destino_id: string; mes: number | null; motivo: string; activo: boolean }[];
      vetos = v
        .filter((x) => x.activo !== false)
        .map((x) => ({ destinoId: x.destino_id, mes: x.mes, motivo: x.motivo ?? "" }));
    }

    return { pesos, campanas: [], vetos, persistido: true };
  } catch {
    return base;
  }
}

export async function guardarPesos(pesos: Pesos): Promise<boolean> {
  const c = credenciales();
  if (!c) return false;
  try {
    const r = await fetch(`${c.url}/rest/v1/pesos`, {
      method: "POST",
      headers: {
        ...c.cabeceras,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(
        CLAVES_PESOS.map((clave) => ({
          clave,
          valor: Math.min(5, Math.max(1, Math.round(pesos[clave]))),
          editado_en: new Date().toISOString(),
        })),
      ),
    });
    return r.ok;
  } catch {
    return false;
  }
}
