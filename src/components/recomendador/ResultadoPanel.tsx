import type { Propuesta, ResultadoRecomendacion } from "@/lib/recomendador/tipos";

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function Tarjeta({ propuesta, alerta }: { propuesta: Propuesta; alerta: boolean }) {
  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{propuesta.nombre}</h3>
          <p className="text-sm text-muted-foreground">{propuesta.destino}</p>
        </div>
        {alerta ? (
          <span className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Incumple reglas duras
          </span>
        ) : null}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Precio por persona</dt>
          <dd>{euros.format(propuesta.precioPorPersona)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total del grupo</dt>
          <dd>{euros.format(propuesta.precioTotalGrupo)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Noches</dt>
          <dd>{propuesta.noches}</dd>
        </div>
      </dl>

      <ul className="mt-3 space-y-1 text-sm">
        {propuesta.motivos.map((motivo) => (
          <li key={motivo}>{motivo}</li>
        ))}
      </ul>

      {propuesta.incumplimientos.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {propuesta.incumplimientos.map((incumplimiento) => (
            <li key={incumplimiento}>{incumplimiento}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ResultadoPanel({
  resultado,
  cargando,
  error,
}: {
  resultado: ResultadoRecomendacion | null;
  cargando: boolean;
  error: string | null;
}) {
  return (
    <section className="rounded-md border border-border p-4">
      <h2 className="text-sm font-medium">Resultado</h2>

      {error ? <p className="mt-3 text-sm text-muted-foreground">{error}</p> : null}

      {cargando ? (
        <p className="mt-3 text-sm text-muted-foreground">Calculando…</p>
      ) : null}

      {!cargando && !error && !resultado ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Completa el perfil del cliente y pulsa «Recomendar».
        </p>
      ) : null}

      {resultado ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {resultado.candidatas} experiencias evaluadas · {resultado.supervivientes} superan las
            reglas duras
          </p>

          {resultado.modo === "sin_supervivientes" ? (
            <p className="rounded-md border border-border p-3 text-sm">
              Ninguna experiencia supera las reglas duras. Se muestran las dos que menos
              incumplen. Afina la búsqueda: revisa presupuesto, fechas o días disponibles.
            </p>
          ) : null}

          {resultado.propuestas.map((propuesta) => (
            <Tarjeta
              key={propuesta.id}
              propuesta={propuesta}
              alerta={resultado.modo === "sin_supervivientes"}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
