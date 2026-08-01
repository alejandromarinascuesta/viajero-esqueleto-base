"use client";

import { ArrowRight, Clapperboard, MessageSquare } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import type { OrigenDatos } from "@/lib/data";
import { Kpi, Panel, Vacio } from "@/components/ui";
import { pulso } from "@/lib/pulso";
import { etiquetaFuenteMomentum, senalMomentum } from "@/lib/signals";

const interesDe = (d: DestinoConScore) => senalMomentum(d)?.valor ?? null;

export default function Radar({
  destinos,
  origen,
  onAbrirDestino,
  onAbrirCopiloto,
  onAbrirContenido,
}: {
  destinos: DestinoConScore[];
  origen: OrigenDatos;
  onAbrirDestino: (id: string) => void;
  onAbrirCopiloto: (id: string) => void;
  onAbrirContenido: (id: string) => void;
}) {
  const filas = [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score).slice(0, 5);
  const lider = filas[0];
  const confianzaMedia = filas.length
    ? Math.round(filas.reduce((s, d) => s + d.oportunidad.confianza, 0) / filas.length)
    : 0;
  const conTrends = filas.filter((d) => senalMomentum(d)?.fuente === "trends").length;

  return (
    <div className="space-y-4">
      <section
        className="flex flex-col justify-between gap-5 rounded-[22px] p-5 md:flex-row md:items-center"
        style={{
          border: "1px solid var(--line-strong)",
          background: "linear-gradient(110deg,rgba(16,42,34,.98),rgba(9,23,20,.9))",
          boxShadow: "var(--shadow)",
        }}
      >
        <div>
          <span className="pill pill-green">QUÉ VENDER AHORA</span>
          <h2 className="mt-3 max-w-2xl text-[25px] leading-tight tracking-tight">
            Las cinco oportunidades que merece la pena activar.
          </h2>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            La plataforma analiza todo el catálogo, pero la demo solo enseña lo importante.
          </p>
        </div>
        {lider ? (
          <button
            type="button"
            className="flex min-w-[260px] items-center justify-between gap-4 rounded-2xl p-4 text-left"
            style={{ background: "rgba(141,245,189,.07)" }}
            onClick={() => onAbrirDestino(lider.id)}
          >
            <span>
              <span className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--green)]">Líder actual</span>
              <strong className="mt-1 block text-[20px]">{lider.destino}</strong>
              <span className="text-[11px] text-[var(--muted)]">Score {lider.oportunidad.score} · confianza {lider.oportunidad.confianza}%</span>
            </span>
            <ArrowRight size={17} className="text-[var(--green)]" aria-hidden />
          </button>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi etiqueta="Prioridades visibles" valor={String(filas.length)} nota={`de ${destinos.length} destinos analizados`} />
        <Kpi etiqueta="Líder" valor={lider?.destino ?? "—"} nota={lider ? `score ${lider.oportunidad.score}` : "sin datos"} tono="verde" />
        <Kpi etiqueta="Confianza media" valor={`${confianzaMedia}%`} nota={`${conTrends} con Google Trends · ${origen.frescura}`} />
      </div>

      <Panel titulo="Top 5 de oportunidades" extra={<span className="pill pill-line">Actualización automática</span>}>
        {filas.length === 0 ? <Vacio mensaje="Todavía no hay oportunidades disponibles." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-[13px]">
              <caption className="sr-only">Cinco mejores destinos por oportunidad comercial</caption>
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-[.08em] text-[var(--dim)]">
                  <th className="px-3 pb-3 font-normal">Destino</th>
                  <th className="px-3 pb-3 font-normal">Demanda</th>
                  <th className="px-3 pb-3 font-normal">Score</th>
                  <th className="px-3 pb-3 text-right font-normal">Margen</th>
                  <th className="pb-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((d, indice) => {
                  const interes = interesDe(d);
                  const fuente = senalMomentum(d);
                  const estado = pulso(interes);
                  return (
                    <tr key={d.id} className="border-t" style={{ borderColor: "rgba(255,255,255,.055)" }}>
                      <th scope="row" className="px-3 py-3 text-left font-normal">
                        <button type="button" className="flex items-center gap-3 text-left" onClick={() => onAbrirDestino(d.id)}>
                          <span className="grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold" style={{ background: "rgba(141,245,189,.08)", color: "var(--green)" }}>{indice + 1}</span>
                          <span><span className="block font-semibold">{d.destino}</span><span className="block text-[10px] text-[var(--dim)]">{d.pais} · {d.tipo}</span></span>
                        </button>
                      </th>
                      <td className="px-3 py-3">
                        <span className="mr-1.5" aria-hidden>{estado.icono}</span>
                        {interes === null ? <span className="text-[var(--dim)]">Sin señal</span> : (
                          <><span className="tabular-nums">{interes > 0 ? "+" : ""}{interes}%</span><span className="block text-[10px] text-[var(--dim)]">{etiquetaFuenteMomentum(fuente)}</span></>
                        )}
                      </td>
                      <td className="px-3 py-3"><strong className="tabular-nums">{d.oportunidad.score}</strong><span className="ml-2 text-[10px] text-[var(--dim)]">{d.oportunidad.confianza}% conf.</span></td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.margenPct}%</td>
                      <td className="py-3 pr-1">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" className="btn btn-ghost px-2.5 py-1.5" onClick={() => onAbrirCopiloto(d.id)} aria-label={`Recomendar ${d.destino}`}><MessageSquare size={13} aria-hidden /></button>
                          <button type="button" className="btn btn-ghost px-2.5 py-1.5" onClick={() => onAbrirContenido(d.id)} aria-label={`Crear contenido de ${d.destino}`}><Clapperboard size={13} aria-hidden /></button>
                          <button type="button" className="btn btn-primary px-3 py-1.5 text-[11px]" onClick={() => onAbrirDestino(d.id)}>Ver</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

