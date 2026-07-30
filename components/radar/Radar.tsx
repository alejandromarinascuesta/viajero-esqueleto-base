"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Panel, Vacio } from "@/components/ui";
import { pulso } from "@/lib/pulso";

const FILTROS = [
  { id: "todos", nombre: "Todos" },
  { id: "prioridad", nombre: "Prioridad alta" },
  { id: "crecimiento", nombre: "Crecimiento fuerte" },
  { id: "margen", nombre: "Margen alto" },
  { id: "confianza", nombre: "Confianza alta" },
] as const;

const ORDENES = [
  { id: "score", nombre: "Opportunity Score" },
  { id: "crecimiento", nombre: "Crecimiento" },
  { id: "margen", nombre: "Margen" },
  { id: "confianza", nombre: "Confianza" },
] as const;

const interesDe = (d: DestinoConScore) =>
  d.senales.find((s) => s.metrica === "tendencia_interes_pct" && s.estado === "ok")?.valor ?? null;

export default function Radar({
  destinos,
  mes,
  onAbrirDestino,
  onAbrirCopiloto,
}: {
  destinos: DestinoConScore[];
  mes: number;
  onAbrirDestino: (id: string) => void;
  onAbrirCopiloto: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const [orden, setOrden] = useState<(typeof ORDENES)[number]["id"]>("score");

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return destinos
      .filter((d) => !q || d.destino.toLowerCase().includes(q) || d.pais.toLowerCase().includes(q))
      .filter((d) => {
        if (filtro === "prioridad") return d.oportunidad.score >= 55;
        if (filtro === "crecimiento") return (interesDe(d) ?? -999) >= 0;
        if (filtro === "margen") return d.margenPct >= 24;
        if (filtro === "confianza") return d.oportunidad.confianza >= 75;
        return true;
      })
      .sort((a, b) => {
        if (orden === "crecimiento") return (interesDe(b) ?? -999) - (interesDe(a) ?? -999);
        if (orden === "margen") return b.margenPct - a.margenPct;
        if (orden === "confianza") return b.oportunidad.confianza - a.oportunidad.confianza;
        return b.oportunidad.score - a.oportunidad.score;
      });
  }, [destinos, busqueda, filtro, orden]);

  return (
    <Panel
      titulo={`Radar de demanda · ${filas.length} de ${destinos.length} destinos`}
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Buscar destino</span>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" aria-hidden />
            <input
              className="field w-44 pl-8 text-[12px]"
              placeholder="Buscar destino"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <label className="sr-only" htmlFor="orden">Ordenar por</label>
          <select id="orden" className="field w-auto text-[12px]" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>{o.nombre}</option>
            ))}
          </select>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl p-1" style={{ border: "1px solid var(--line)" }}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
            style={{
              background: filtro === f.id ? "rgba(141,245,189,.1)" : "transparent",
              color: filtro === f.id ? "var(--green)" : "#70897e",
            }}
          >
            {f.nombre}
          </button>
        ))}
      </div>

      {filas.length === 0 ? (
        <Vacio mensaje="Ningún destino cumple ese filtro. Prueba con otro criterio." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <caption className="sr-only">Destinos ordenados por oportunidad comercial</caption>
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-[.08em] text-[var(--dim)]">
                <th scope="col" className="px-3 pb-3 font-normal">Destino</th>
                <th scope="col" className="px-3 pb-3 font-normal">Opportunity</th>
                <th scope="col" className="px-3 pb-3 font-normal">Tendencia</th>
                <th scope="col" className="px-3 pb-3 text-right font-normal">Margen</th>
                <th scope="col" className="px-3 pb-3 text-right font-normal">Confianza</th>
                <th scope="col" className="px-3 pb-3 font-normal">Recomendación</th>
                <th scope="col" className="pb-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((d) => {
                const interes = interesDe(d);
                const p = pulso(interes);
                return (
                  <tr key={d.id} className="border-t" style={{ borderColor: "rgba(255,255,255,.055)" }}>
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <span className="block">{d.destino}</span>
                      <span className="block text-[10px] text-[var(--dim)]">{d.pais} · {d.tipo}</span>
                    </th>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="bar w-12"><i style={{ width: `${d.oportunidad.score}%` }} /></div>
                        <span className="tabular-nums">{d.oportunidad.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="mr-1.5" aria-hidden>{p.icono}</span>
                      {interes === null ? (
                        <span className="text-[var(--dim)]">sin señal</span>
                      ) : (
                        <span className="tabular-nums">{interes > 0 ? "+" : ""}{interes}%</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.margenPct}%</td>
                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: d.oportunidad.confianza < 60 ? "var(--orange)" : undefined }}>
                      {d.oportunidad.confianza}%
                    </td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{p.etiqueta}</td>
                    <td className="py-3 pr-1">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => onAbrirCopiloto(d.id)}>
                          Copiloto
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost px-2.5 py-1.5"
                          onClick={() => onAbrirDestino(d.id)}
                          aria-label={`Abrir Destino 360 de ${d.destino}`}
                        >
                          <ArrowRight size={13} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
        El Opportunity Score se calcula solo con métricas realmente disponibles. Cuando falta una, su peso
        se reparte entre las demás y baja la confianza: nunca se rellena con una media ni con un valor
        generado. Mes de referencia: {mes}.
      </p>
    </Panel>
  );
}
