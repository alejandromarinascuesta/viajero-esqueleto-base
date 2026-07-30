import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Propuesta, ResultadoRecomendacion } from "@/lib/recomendador/tipos";

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function Tarjeta({
  propuesta,
  alerta,
  onDescartar,
}: {
  propuesta: Propuesta;
  alerta: boolean;
  onDescartar: (motivo: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{propuesta.nombre}</h3>
          <p className="text-sm text-muted-foreground">{propuesta.destino}</p>
        </div>
        {alerta ? (
          <span className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Incumple reglas relajables
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
        {propuesta.motivos.map((motivoFicha) => (
          <li key={motivoFicha}>{motivoFicha}</li>
        ))}
      </ul>

      {propuesta.incumplimientos.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {propuesta.incumplimientos.map((incumplimiento) => (
            <li key={incumplimiento}>{incumplimiento}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t border-border pt-3">
        {abierto ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (!motivo.trim()) return;
              onDescartar(motivo.trim());
              setAbierto(false);
              setMotivo("");
            }}
          >
            <Input
              autoFocus
              placeholder="Motivo del descarte"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <Button type="submit" size="sm" variant="secondary">
              Confirmar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(true)}>
            Descartar
          </Button>
        )}
      </div>
    </article>
  );
}

export function ResultadoPanel({
  resultado,
  cargando,
  error,
  excluidos,
  onDescartar,
  onReiniciar,
}: {
  resultado: ResultadoRecomendacion | null;
  cargando: boolean;
  error: string | null;
  excluidos: string[];
  onDescartar: (id: string, motivo: string) => void;
  onReiniciar: () => void;
}) {
  return (
    <section className="rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium">Resultado</h2>
        {excluidos.length > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={onReiniciar}>
            Recuperar {excluidos.length} descartada(s)
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-muted-foreground">{error}</p> : null}

      {cargando ? <p className="mt-3 text-sm text-muted-foreground">Calculando…</p> : null}

      {!cargando && !error && !resultado ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Completa el perfil del cliente y pulsa «Recomendar».
        </p>
      ) : null}

      {resultado && !cargando ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {resultado.candidatas} experiencias evaluadas · {resultado.supervivientes} superan las
            reglas duras
          </p>

          {resultado.mensaje ? (
            <p className="rounded-md border border-border p-3 text-sm">{resultado.mensaje}</p>
          ) : null}

          {resultado.modo === "sin_supervivientes" ? (
            <p className="text-sm text-muted-foreground">
              Afina la búsqueda: revisa presupuesto, fechas o días disponibles.
            </p>
          ) : null}

          {resultado.avisos.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {resultado.avisos.map((aviso) => (
                <li key={aviso}>Aviso: {aviso}</li>
              ))}
            </ul>
          ) : null}

          {resultado.propuestas.map((propuesta) => (
            <Tarjeta
              key={propuesta.id}
              propuesta={propuesta}
              alerta={resultado.modo === "sin_supervivientes"}
              onDescartar={(motivo) => onDescartar(propuesta.id, motivo)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
