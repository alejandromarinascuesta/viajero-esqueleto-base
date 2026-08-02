"use client";

import { Fragment, useState } from "react";
import { ArrowRight, ChevronDown, Clapperboard, HelpCircle, MessageSquare } from "lucide-react";
import PorQue from "@/components/radar/PorQue";
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
  // Se enseña el catálogo entero. Recortarlo a cinco escondía el trabajo: lo
  // valioso no es que haya un top, es que hay un orden y se puede auditar.
  const filas = [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score);
  const ACTIVABLES = 5;
  const [abierto, setAbierto] = useState<string | null>(null);
  const [criterio, setCriterio] = useState(false);
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
            Todo el catálogo, ordenado por dónde merece la pena empujar.
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--muted)]">
            Las {ACTIVABLES} primeras son las que se pueden convertir en campaña. Pincha en cualquiera
            para ver de dónde sale su puntuación.
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
        <Kpi etiqueta="Destinos analizados" valor={String(filas.length)} nota={`${ACTIVABLES} activables para contenido`} />
        <Kpi etiqueta="Líder" valor={lider?.destino ?? "—"} nota={lider ? `score ${lider.oportunidad.score}` : "sin datos"} tono="verde" />
        <Kpi etiqueta="Confianza media" valor={`${confianzaMedia}%`} nota={`${conTrends} con Google Trends · ${origen.frescura}`} />
      </div>

      <section className="panel p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-4 text-left"
          onClick={() => setCriterio(!criterio)}
          aria-expanded={criterio}
        >
          <span className="flex items-center gap-2.5">
            <HelpCircle size={16} className="shrink-0 text-[var(--green)]" aria-hidden />
            <span>
              <b className="block text-[13px]">¿Cómo se decide este orden?</b>
              <span className="block text-[11px] text-[var(--muted)]">Cinco medidas, ningún criterio oculto y ninguna decisión de la IA.</span>
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-[var(--dim)]" style={{ transform: criterio ? "rotate(180deg)" : undefined }} aria-hidden />
        </button>
        {criterio ? (
          <div className="space-y-3 border-t px-4 pb-4 pt-4 text-[12px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
            <p className="text-[var(--muted)]">
              Cada destino empieza con 100 puntos por repartir. Estas cinco medidas se los van llevando,
              y lo que suman es su puntuación. Este reparto mide la oportunidad de mercado y es fijo.
              Lo que la dirección sí ajusta, en Ajustes de dirección, es el criterio con el que se
              recomienda a un cliente concreto: son dos preguntas distintas y por eso dos fórmulas.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                ["35", "Cuánto se busca ahora", "Si las búsquedas del destino suben, es que la gente lo está pensando. Es la medida que más pesa."],
                ["20", "Cuánta gente lo mira", "Un +40 % sobre doscientas personas no es lo mismo que sobre doscientas mil. El tamaño cuenta aparte."],
                ["20", "Lo que gana la agencia", "De poco sirve vender mucho de lo que deja poco margen."],
                ["15", "Plazas que quedan", "Empujar lo que ya está lleno es gastar dinero en decepcionar clientes."],
                ["10", "Si el tiempo acompaña", "La temperatura media frente a los 24 °C que la mayoría considera ideales."],
              ].map(([peso, titulo, texto]) => (
                <li key={titulo} className="subpanel flex gap-3 p-3">
                  <b className="shrink-0 text-[17px] tabular-nums text-[var(--green)]">{peso}</b>
                  <span>
                    <b className="block text-[12px]">{titulo}</b>
                    <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{texto}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="subpanel space-y-2 p-3 text-[11px]">
              <p><b className="text-[var(--green)]">Si falta una medida, no se inventa.</b> Su peso se reparte entre las que sí tenemos y la confianza baja. La puntuación baja con ella: un destino no puede subir por no tener datos.</p>
              <p><b>Si una fuente no llega hasta ahí, no cuenta.</b> El INE no mide hoteles en Maldivas. Eso no es un dato que falte, así que ni penaliza ni baja la confianza.</p>
              <p className="text-[var(--dim)]">Es una fórmula fija: con las mismas señales sale siempre el mismo número. Aquí no interviene ningún modelo de lenguaje.</p>
            </div>
          </div>
        ) : null}
      </section>

      <Panel titulo={`Catálogo ordenado · ${filas.length} destinos`} extra={<span className="pill pill-line">Actualización automática</span>}>
        {filas.length === 0 ? <Vacio mensaje="Todavía no hay oportunidades disponibles." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-[13px]">
              <caption className="sr-only">Catálogo ordenado por oportunidad comercial</caption>
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
                  const activable = indice < ACTIVABLES;
                  const expandido = abierto === d.id;
                  return (
                    <Fragment key={d.id}>
                    <tr className="border-t" style={{ borderColor: "rgba(255,255,255,.055)", opacity: activable ? 1 : .72 }}>
                      <th scope="row" className="px-3 py-3 text-left font-normal">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => setAbierto(expandido ? null : d.id)}
                          aria-expanded={expandido}
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold" style={{ background: activable ? "rgba(141,245,189,.12)" : "rgba(255,255,255,.05)", color: activable ? "var(--green)" : "var(--dim)" }}>{indice + 1}</span>
                          <span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              {d.destino}
                              <ChevronDown size={13} className="text-[var(--dim)]" style={{ transform: expandido ? "rotate(180deg)" : undefined }} aria-hidden />
                            </span>
                            <span className="block text-[10px] text-[var(--dim)]">{d.pais} · {d.tipo}{activable ? " · activable" : ""}</span>
                          </span>
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
                          <button
                            type="button"
                            className="btn btn-ghost px-2.5 py-1.5"
                            disabled={!activable}
                            title={activable ? `Crear contenido de ${d.destino}` : `${d.destino} está fuera del top ${ACTIVABLES}: todavía no se produce contenido para él`}
                            onClick={() => onAbrirContenido(d.id)}
                            aria-label={`Crear contenido de ${d.destino}`}
                          ><Clapperboard size={13} aria-hidden /></button>
                          <button type="button" className="btn btn-primary px-3 py-1.5 text-[11px]" onClick={() => onAbrirDestino(d.id)}>Ver</button>
                        </div>
                      </td>
                    </tr>
                    {expandido ? (
                      <tr style={{ background: "rgba(0,0,0,.16)" }}>
                        <td colSpan={5} className="px-3 pb-4">
                          <PorQue destino={d} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" className="btn btn-ghost px-3 py-1.5 text-[11px]" onClick={() => onAbrirDestino(d.id)}>Ver la ficha completa</button>
                            <button type="button" className="btn btn-ghost px-3 py-1.5 text-[11px]" onClick={() => onAbrirCopiloto(d.id)}>Recomendárselo a un cliente</button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
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

