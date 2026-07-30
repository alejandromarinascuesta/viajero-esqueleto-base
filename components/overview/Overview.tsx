"use client";

import { ArrowRight } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import type { OrigenDatos } from "@/lib/data";
import { Anillo, Kpi, Panel } from "@/components/ui";

export default function Overview({
  destinos,
  origen,
  onAbrirDestino,
  onIrARadar,
}: {
  destinos: DestinoConScore[];
  origen: OrigenDatos;
  onAbrirDestino: (id: string) => void;
  onIrARadar: () => void;
}) {
  const ordenados = [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score);
  const lider = ordenados[0];
  const conSenal = destinos.filter((d) => d.oportunidad.confianza >= 50).length;
  const confianzaMedia = destinos.length
    ? Math.round(destinos.reduce((s, d) => s + d.oportunidad.confianza, 0) / destinos.length)
    : 0;
  const prioritarios = ordenados.filter((d) => d.oportunidad.score >= 55).length;

  return (
    <div className="space-y-4">
      <section
        className="grid overflow-hidden rounded-[26px] lg:grid-cols-[1.15fr_.85fr]"
        style={{
          border: "1px solid var(--line-strong)",
          background: "linear-gradient(110deg,rgba(16,42,34,.98),rgba(9,23,20,.9))",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="p-8">
          <span className="pill pill-green">PROPUESTA DE VALOR</span>
          <h2 className="mt-5 max-w-xl text-[34px] leading-[1.06] tracking-tight">
            Convierte señales de demanda en <em className="not-italic" style={{ color: "var(--green)" }}>decisiones comerciales</em> que un agente puede defender.
          </h2>
          <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-[#a8bbb3]">
            Los datos de demanda están dispersos, pero el problema real es otro: el criterio comercial vive
            en la cabeza de unos pocos agentes. Esta plataforma lo convierte en algo explícito, editable y
            medible — y lo aplica a cada cliente concreto.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={onIrARadar}>
              Ver el radar de demanda
            </button>
            {lider ? (
              <button type="button" className="btn btn-ghost" onClick={() => onAbrirDestino(lider.id)}>
                Analizar {lider.destino}
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative grid min-h-[240px] place-items-center p-6">
          {lider ? (
            <>
              <Anillo valor={lider.oportunidad.score} sub="OPPORTUNITY SCORE" />
              <p className="mt-4 text-center text-[12px] text-[var(--muted)]">
                {lider.destino} · confianza {lider.oportunidad.confianza}%
              </p>
            </>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Destinos analizados" valor={String(destinos.length)} nota="catálogo de la agencia" />
        <Kpi etiqueta="Oportunidades prioritarias" valor={String(prioritarios)} nota="score 55 o superior" tono="verde" />
        <Kpi etiqueta="Confianza media del dato" valor={`${confianzaMedia}%`} nota={`${conSenal} destinos con señal suficiente`} />
        <Kpi
          etiqueta="Última ingesta"
          valor={origen.ingestadoEn ? new Date(origen.ingestadoEn).toLocaleDateString("es-ES") : "—"}
          nota={origen.detalle}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.6fr_.9fr]">
        <Panel titulo="Las tres oportunidades principales">
          <ol className="divide-y" style={{ borderColor: "rgba(255,255,255,.055)" }}>
            {ordenados.slice(0, 3).map((d, i) => (
              <li key={d.id} className="flex items-start gap-4 py-4 first:pt-0">
                <span className="text-[11px] font-black text-[var(--dim)]">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <b className="text-[13px]">{d.destino}</b>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                    {d.motivos[0] ?? "Sin descripción en el catálogo."}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[var(--dim)]">
                    Score {d.oportunidad.score} · confianza {d.oportunidad.confianza}%
                    {d.oportunidad.ausentes.length > 0 ? ` · sin dato de ${d.oportunidad.ausentes.join(", ").toLowerCase()}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 px-3 py-2"
                  onClick={() => onAbrirDestino(d.id)}
                  aria-label={`Abrir ${d.destino}`}
                >
                  <ArrowRight size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel titulo="Estado de las fuentes">
          <ul className="space-y-2.5 text-[12px]">
            {[
              ["Catálogo de la agencia", "activa", "interna · 30 experiencias"],
              ["Clima · Open-Meteo", "activa", "archivo histórico y previsión"],
              ["Interés · Wikimedia", "activa", "vistas diarias por destino"],
              ["Reservas · Amadeus", "diseñada", "requiere entorno de producción"],
              ["Eventos · Ticketmaster", "diseñada", "clave gratuita pendiente"],
            ].map(([nombre, estado, detalle]) => (
              <li key={nombre} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{nombre}</span>
                  <span className="block text-[10px] text-[var(--dim)]">{detalle}</span>
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: estado === "activa" ? "var(--green)" : "var(--dim)" }}
                >
                  {estado === "activa" ? "● activa" : "○ diseñada"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
            Cuando una fuente no devuelve dato, la métrica queda vacía y baja la confianza. No se sustituye
            por un valor generado.
          </p>
        </Panel>
      </div>
    </div>
  );
}
