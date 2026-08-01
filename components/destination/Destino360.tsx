"use client";

import { useEffect, useState } from "react";
import { Clapperboard, MessageSquare } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Anillo, Kpi, Panel, Vacio } from "@/components/ui";
import { accionRecomendada, pulso } from "@/lib/pulso";
import { senalMomentum, senalesActuales } from "@/lib/signals";

/** Cada fuente con su cadencia real. La frescura no es uniforme, y decirlo vale
 *  mas que fingir que todo es de hace una hora. */
const FUENTE: Record<string, { nombre: string; cadencia: string }> = {
  trends: { nombre: "Demanda · Google Trends", cadencia: "Sincronización nocturna · 4 periodos vs 4" },
  clima: { nombre: "Clima · Open-Meteo", cadencia: "archivo histórico · estable" },
  interes: { nombre: "Interés · Wikimedia", cadencia: "vistas diarias · 28 días vs 28" },
  divisa: { nombre: "Divisa · Banco Central Europeo", cadencia: "cada día laborable" },
  ine: { nombre: "Viajeros · INE", cadencia: "mensual · dos meses de retraso" },
  vuelos: { nombre: "Precio de vuelo · Amadeus", cadencia: "diaria · requiere producción" },
  reservas: { nombre: "Reservas · Amadeus", cadencia: "mensual · requiere producción" },
  eventos: { nombre: "Eventos · Ticketmaster", cadencia: "diaria · requiere clave" },
  calendario: { nombre: "Calendario escolar", cadencia: "anual" },
  catalogo: { nombre: "Catálogo de la agencia", cadencia: "interna · manual" },
};

type Clima = { estado: string; temperatura: number | null; fuente: string; observadoEn?: string | null; mensaje?: string };

export default function Destino360({
  destino,
  destinos,
  mes,
  onSeleccionar,
  onAbrirCopiloto,
  onAbrirContenido,
}: {
  destino: DestinoConScore;
  destinos: DestinoConScore[];
  mes: number;
  onSeleccionar: (id: string) => void;
  onAbrirCopiloto: (id: string) => void;
  onAbrirContenido: (id: string) => void;
}) {
  // El estado de carga se DERIVA de si lo que hay guardado corresponde al
  // destino abierto. Asi no hace falta un segundo estado que mantener en
  // sincronia, y no se puede quedar colgado en «cargando».
  const [climaDe, setClimaDe] = useState<{ id: string; datos: Clima | null } | null>(null);
  const cargandoClima = climaDe?.id !== destino.id;
  const clima = climaDe?.id === destino.id ? climaDe.datos : null;

  useEffect(() => {
    const control = new AbortController();

    async function cargarClima(id: string) {
      try {
        const r = await fetch(`/api/weather?destinationId=${encodeURIComponent(id)}`, {
          signal: control.signal,
        });
        const d = (await r.json()) as Clima;
        if (!control.signal.aborted) setClimaDe({ id, datos: d });
      } catch {
        // Si la consulta falla o se cancela al cambiar de destino, la tarjeta
        // muestra «sin dato». No se inventa una temperatura.
        if (!control.signal.aborted) setClimaDe({ id, datos: null });
      }
    }

    void cargarClima(destino.id);
    return () => control.abort();
  }, [destino.id]);

  const interes = senalMomentum(destino)?.valor ?? null;
  const p = pulso(interes);
  const accion = accionRecomendada(
    {
      destino: destino.destino,
      tendenciaInteres: interes,
      cupo: destino.cupo,
      margenPct: destino.margenPct,
      temporada: destino.temporada,
      fuentesFaltantes: destino.oportunidad.ausentes,
    },
    mes,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel titulo="Catálogo">
        <ul className="max-h-[600px] space-y-1 overflow-y-auto pr-1">
          {destinos.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSeleccionar(d.id)}
                aria-current={d.id === destino.id ? "true" : undefined}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                style={{
                  background: d.id === destino.id ? "rgba(141,245,189,.045)" : "transparent",
                  border: `1px solid ${d.id === destino.id ? "var(--line-strong)" : "transparent"}`,
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{d.destino}</span>
                  <span className="block text-[10px] text-[var(--dim)]">{d.pais}</span>
                </span>
                <span className="shrink-0 text-[15px] font-black" style={{ color: "var(--green)" }}>
                  {d.oportunidad.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="min-w-0 space-y-4">
        <Panel>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_auto]">
            <div className="min-w-0">
              <span className="pill pill-green">{p.icono} {p.etiqueta}</span>
              <h2 className="mt-3 text-[30px] tracking-tight">{destino.destino}</h2>
              <p className="mt-1 text-[12px] text-[var(--dim)]">{destino.nombre} · {destino.pais}</p>
              <div className="mt-4 rounded-r-xl border-l-2 p-4" style={{ borderColor: "var(--green)", background: "rgba(141,245,189,.035)" }}>
                <p className="text-[13px] font-semibold">{accion.titulo}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">{accion.detalle}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => onAbrirCopiloto(destino.id)}>
                  <MessageSquare size={14} className="mr-1.5 inline" aria-hidden />
                  Preparar propuesta
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => onAbrirContenido(destino.id)}>
                  <Clapperboard size={14} className="mr-1.5 inline" aria-hidden />
                  Crear vídeo social
                </button>
              </div>
            </div>
            <div className="grid place-items-center">
              <Anillo valor={destino.oportunidad.score} sub="OPPORTUNITY SCORE" />
              <p className="mt-3 text-[11px] text-[var(--dim)]">confianza {destino.oportunidad.confianza}%</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi etiqueta="Desde, por persona" valor={`${destino.precioDesdePp} €`} nota={`${destino.noches} noches`} />
          <Kpi etiqueta="Margen" valor={`${destino.margenPct}%`} nota="catálogo de la agencia" />
          <Kpi etiqueta="Cupo" valor={`${destino.cupo}`} nota="plazas disponibles" />
          <Kpi
            etiqueta="Clima ahora"
            valor={cargandoClima ? "…" : clima?.temperatura != null ? `${clima.temperatura} °C` : "sin dato"}
            nota={cargandoClima ? "consultando" : (clima?.fuente ?? "Open-Meteo")}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel titulo="Cómo se calcula el Opportunity Score">
            <ul className="space-y-3">
              {destino.oportunidad.componentes.map((c) => (
                <li key={c.clave}>
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span>
                      {c.etiqueta} <span className="text-[var(--dim)]">· peso {c.peso}%</span>
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        color: !c.aplica
                          ? "var(--dim)"
                          : c.valor === null
                            ? "var(--orange)"
                            : "var(--green)",
                      }}
                    >
                      {!c.aplica ? "no aplica" : c.valor === null ? "sin dato" : `+${Math.round(c.aporta)}`}
                    </span>
                  </div>
                  <div className="bar mt-1.5"><i style={{ width: `${c.valor === null ? 0 : Math.round(c.valor * 100)}%` }} /></div>
                  <p className="mt-1 text-[10px] text-[var(--dim)]">{c.origen}</p>
                </li>
              ))}
            </ul>
            {destino.oportunidad.noAplicables.length > 0 ? (
              <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
                No aplica a este destino: {destino.oportunidad.noAplicables.join(", ").toLowerCase()}. Una
                fuente que no cubre un destino no es un dato que falte, así que <b>no le resta confianza</b>.
              </p>
            ) : null}
            {destino.oportunidad.ausentes.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--orange)" }}>
                  Sin dato de {destino.oportunidad.ausentes.join(", ").toLowerCase()}. Su peso se reparte
                  entre las métricas disponibles y la confianza baja a {destino.oportunidad.confianza}%. No
                  se rellena con un valor estimado.
                </p>
                <p className="text-[11px] leading-relaxed text-[var(--dim)]">
                  Con las métricas disponibles saldría <b>{destino.oportunidad.scoreSinAjustar}</b>, pero se
                  publica <b>{destino.oportunidad.score}</b>: el score va ajustado por confianza para que la
                  falta de datos nunca premie a un destino.
                </p>
              </div>
            ) : null}
          </Panel>

          <div className="space-y-3">
            <Panel titulo="Por qué se vende">
              {destino.motivos.length === 0 ? (
                <Vacio mensaje="El catálogo no tiene motivos escritos para esta experiencia." />
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {destino.motivos.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span style={{ color: "var(--green)" }} aria-hidden>·</span>
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel titulo="Procedencia del dato">
              <ul className="space-y-2 text-[11px]">
                {senalesActuales(destino.senales).map((s) => (
                  <li key={`${s.fuente}-${s.metrica}`} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-[var(--muted)]">
                      {FUENTE[s.fuente]?.nombre ?? s.fuente}
                      <span className="block text-[10px] text-[var(--dim)]">
                        {FUENTE[s.fuente]?.cadencia ?? s.metrica}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-right"
                      style={{ color: s.estado === "ok" ? "var(--green)" : "var(--dim)" }}
                    >
                      {s.estado === "ok" ? String(s.valor) : "sin dato"}
                      <span className="block text-[10px] text-[var(--dim)]">
                        {s.obtenidoEn ? new Date(s.obtenidoEn).toLocaleDateString("es-ES") : "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--dim)]">
                Restricciones del catálogo: {destino.noRecomendadoSi || "ninguna"}. Temporada {destino.temporada}.
                Vuelo {destino.horasVuelo} h. Apto para niños: {destino.aptoNinos}.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
