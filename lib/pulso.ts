// Lectura de la señal de demanda: de un porcentaje a algo que un comercial
// entiende de un vistazo, y a una acción concreta.
//
// Todo es determinista. El icono y el consejo salen de umbrales explícitos, no
// de una interpretación: la misma señal siempre dice lo mismo.

export type Pulso = {
  icono: string;
  etiqueta: string;
  tono: "sube" | "estable" | "baja" | "sin-dato";
};

export function pulso(tendencia: number | null): Pulso {
  if (tendencia === null) return { icono: "·", etiqueta: "sin señal", tono: "sin-dato" };
  if (tendencia >= 25) return { icono: "🔥", etiqueta: "disparado", tono: "sube" };
  if (tendencia >= 8) return { icono: "📈", etiqueta: "subiendo", tono: "sube" };
  if (tendencia > -8) return { icono: "😐", etiqueta: "estable", tono: "estable" };
  if (tendencia > -25) return { icono: "📉", etiqueta: "bajando", tono: "baja" };
  return { icono: "🥶", etiqueta: "enfriándose", tono: "baja" };
}

export type Accion = { titulo: string; detalle: string };

/**
 * Lo principal a hacer con un destino, cruzando demanda, cupo, margen y
 * temporada. El orden de las reglas es el orden de urgencia comercial.
 */
export function accionRecomendada(
  f: {
    destino: string;
    tendenciaInteres: number | null;
    cupo: number;
    margenPct: number;
    temporada: string;
    fuentesFaltantes: string[];
  },
  mes: number,
): Accion {
  const [ini, fin] = f.temporada.split("-").map(Number);
  const enTemporada =
    Number.isInteger(ini) && Number.isInteger(fin)
      ? ini <= fin
        ? mes >= ini && mes <= fin
        : mes >= ini || mes <= fin
      : true;

  if (!enTemporada) {
    return {
      titulo: "No promocionar este mes",
      detalle: `Fuera de temporada. El motor ya lo descarta para viajes en este mes, así que promocionarlo genera consultas que no se pueden cerrar.`,
    };
  }
  if (f.tendenciaInteres === null) {
    return {
      titulo: "Faltan datos de demanda",
      detalle: "Sin señal de búsquedas no hay decisión que tomar. Usa «Actualizar los datos» en el menú de la izquierda.",
    };
  }
  if (f.tendenciaInteres >= 25 && f.cupo >= 15) {
    return {
      titulo: "Empujar ahora",
      detalle: `El interés sube un ${f.tendenciaInteres} % y quedan ${f.cupo} plazas. Es el momento de meterlo en campaña antes de que suba el precio del vuelo.`,
    };
  }
  if (f.tendenciaInteres >= 25 && f.cupo < 15) {
    return {
      titulo: "Subir precio antes que promocionar",
      detalle: `Sube un ${f.tendenciaInteres} % pero solo quedan ${f.cupo} plazas. Promocionarlo más regala margen: la demanda ya está.`,
    };
  }
  if (f.tendenciaInteres <= -25 && f.cupo >= 15) {
    return {
      titulo: "Revisar precio o retirar de campaña",
      detalle: `Cae un ${Math.abs(f.tendenciaInteres)} % y quedan ${f.cupo} plazas sin vender. O se ajusta el precio o se deja de invertir en él.`,
    };
  }
  if (f.cupo <= 8) {
    return {
      titulo: "Liquidar cupo",
      detalle: `Quedan ${f.cupo} plazas. Sube el peso de «liquidar cupo» en criterio comercial para que el motor lo priorice en las recomendaciones.`,
    };
  }
  if (f.margenPct >= 25) {
    return {
      titulo: "Buen candidato para campaña",
      detalle: `Demanda ${f.tendenciaInteres >= 0 ? "sostenida" : "algo floja"} y un ${f.margenPct} % de margen. Es donde más renta cada venta.`,
    };
  }
  return {
    titulo: "Mantener",
    detalle: `Sin señal de urgencia: demanda ${f.tendenciaInteres >= 0 ? "estable" : "algo a la baja"} y cupo holgado. No requiere acción.`,
  };
}
