"use client";

import { useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import type { OrigenDatos } from "@/lib/data";
import { Anillo, Kpi, Panel, Vacio } from "@/components/ui";
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

const volumenDe = (d: DestinoConScore) =>
  d.senales.find((s) => s.metrica === "volumen_atencion_dia" && s.estado === "ok")?.valor ?? null;

type ImportacionTrends = {
  guardadas?: number;
  emparejados?: { termino: string; destinoId: string; momentum: number }[];
  sinDestino?: string[];
  sinMomentum?: string[];
  aviso?: string;
  error?: { message: string };
};

type Ingesta = {
  resumen?: { fuente: string; detalle: string; ok: number; fallos: number; ms: number }[];
  motivosDeFallo?: string[];
  error?: { message: string };
};

export default function Radar({
  destinos,
  mes,
  origen,
  onAbrirDestino,
  onAbrirCopiloto,
}: {
  destinos: DestinoConScore[];
  mes: number;
  origen: OrigenDatos;
  onAbrirDestino: (id: string) => void;
  onAbrirCopiloto: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [ingiriendo, setIngiriendo] = useState(false);
  const [ingesta, setIngesta] = useState<Ingesta | null>(null);
  const [csv, setCsv] = useState("");
  const [importando, setImportando] = useState(false);
  const [trends, setTrends] = useState<ImportacionTrends | null>(null);
  const [verImportador, setVerImportador] = useState(false);

  async function importarTrends() {
    setImportando(true);
    try {
      const r = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mes }),
      });
      setTrends((await r.json()) as ImportacionTrends);
    } catch {
      setTrends({ error: { message: "No se ha podido leer el archivo." } });
    } finally {
      setImportando(false);
    }
  }

  async function refrescarFuentes() {
    setIngiriendo(true);
    try {
      const r = await fetch(`/api/ingesta?mes=${mes}`, { method: "POST" });
      setIngesta((await r.json()) as Ingesta);
    } catch {
      setIngesta({ error: { message: "No se ha podido ejecutar la ingesta." } });
    } finally {
      setIngiriendo(false);
    }
  }
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

  const ordenados = [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score);
  const lider = ordenados[0];
  const prioritarios = ordenados.filter((d) => d.oportunidad.score >= 55).length;
  const confianzaMedia = destinos.length
    ? Math.round(destinos.reduce((s, d) => s + d.oportunidad.confianza, 0) / destinos.length)
    : 0;
  const conSenal = destinos.filter((d) => interesDe(d) !== null).length;

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
        <div className="p-7">
          <span className="pill pill-green">PROPUESTA DE VALOR</span>
          <h2 className="mt-4 max-w-xl text-[30px] leading-[1.08] tracking-tight">
            Convierte señales de demanda en{" "}
            <em className="not-italic" style={{ color: "var(--green)" }}>decisiones comerciales</em>{" "}
            que un agente puede defender.
          </h2>
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[#a8bbb3]">
            Los datos están dispersos, pero el problema real es otro: el criterio comercial vive en la
            cabeza de unos pocos agentes. Esta plataforma lo hace explícito, editable y medible.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={refrescarFuentes} disabled={ingiriendo}>
              <RefreshCw size={14} className="mr-1.5 inline" aria-hidden />
              {ingiriendo ? "Ingiriendo fuentes…" : "Refrescar fuentes"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setVerImportador((v) => !v)}>
              Importar Google Trends
            </button>
            {lider ? (
              <button type="button" className="btn btn-primary" onClick={() => onAbrirDestino(lider.id)}>
                Analizar {lider.destino}
              </button>
            ) : null}
          </div>
        </div>
        <div className="relative grid min-h-[210px] place-items-center p-6">
          {lider ? (
            <>
              <Anillo valor={lider.oportunidad.score} sub="OPPORTUNITY SCORE" />
              <p className="mt-3 text-center text-[12px] text-[var(--muted)]">
                {lider.destino} · confianza {lider.oportunidad.confianza}%
              </p>
            </>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Destinos analizados" valor={String(destinos.length)} nota="catálogo de la agencia" />
        <Kpi etiqueta="Oportunidades prioritarias" valor={String(prioritarios)} nota="score 55 o superior" tono="verde" />
        <Kpi etiqueta="Confianza media del dato" valor={`${confianzaMedia}%`} nota={`${conSenal} con señal de demanda`} />
        <Kpi
          etiqueta="Última ingesta"
          valor={origen.ingestadoEn ? new Date(origen.ingestadoEn).toLocaleDateString("es-ES") : "—"}
          nota={origen.detalle}
        />
      </div>

      {verImportador ? (
        <section className="panel p-5">
          <h2 className="text-[15px] tracking-tight">Importar Google Trends</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
            En <b>trends.google.es</b>, compara hasta cinco términos del tipo «viajar a Mallorca», elige
            España y los últimos 12 meses, y descarga el CSV de <b>Interés a lo largo del tiempo</b>. Pega
            aquí su contenido.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">
            Solo se guarda el <b>momentum</b>, no el valor absoluto: Trends normaliza de 0 a 100 dentro de
            cada consulta, así que dos exportaciones no son comparables entre sí. La variación dentro de una
            misma serie sí lo es.
          </p>

          <label className="sr-only" htmlFor="csv-trends">Contenido del CSV</label>
          <textarea
            id="csv-trends"
            className="field mt-3 min-h-[120px] resize-y font-mono text-[11px]"
            placeholder={"Categoría: Todas las categorías\n\nSemana,viajar a Mallorca: (España),...\n2026-05-03,40,..."}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--dim)]">
              Dato real exportado por ti. La API oficial de Trends está en acceso restringido.
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importando || csv.trim().length < 10}
              onClick={importarTrends}
            >
              {importando ? "Importando…" : "Importar"}
            </button>
          </div>

          {trends ? (
            <div className="subpanel mt-3 p-4 text-[12px]">
              {trends.error ? (
                <p className="text-[var(--muted)]">{trends.error.message}</p>
              ) : (
                <>
                  <p>
                    <b>{trends.guardadas ?? 0}</b> series guardadas.
                  </p>
                  {trends.emparejados?.length ? (
                    <ul className="mt-2 space-y-0.5 text-[var(--muted)]">
                      {trends.emparejados.map((e) => (
                        <li key={e.termino}>
                          {e.termino} → {e.destinoId} ·{" "}
                          <span style={{ color: e.momentum >= 0 ? "var(--green)" : "var(--orange)" }}>
                            {e.momentum > 0 ? "+" : ""}
                            {e.momentum}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {trends.sinDestino?.length ? (
                    <p className="mt-2 text-[11px]" style={{ color: "var(--orange)" }}>
                      Sin destino en el catálogo: {trends.sinDestino.join(", ")}
                    </p>
                  ) : null}
                  {trends.sinMomentum?.length ? (
                    <p className="mt-1 text-[11px] text-[var(--dim)]">
                      Sin momentum: {trends.sinMomentum.join(" · ")}
                    </p>
                  ) : null}
                  {trends.aviso ? <p className="mt-2 text-[11px] text-[var(--dim)]">{trends.aviso}</p> : null}
                  {trends.guardadas ? (
                    <p className="mt-2 text-[11px] text-[var(--dim)]">Recarga la página para verlo en el radar.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {ingesta ? (
        <div className="subpanel p-4">
          {ingesta.error ? (
            <p className="text-[12px] text-[var(--muted)]">{ingesta.error.message}</p>
          ) : (
            <>
              <ul className="space-y-1 text-[12px]">
                {ingesta.resumen?.map((r) => (
                  <li key={r.fuente}>
                    <b>{r.fuente}</b> · {r.detalle} — {r.ok} con dato, {r.fallos} sin dato · {r.ms} ms
                  </li>
                ))}
              </ul>
              {ingesta.motivosDeFallo && ingesta.motivosDeFallo.length > 0 ? (
                <p className="mt-2 text-[11px] text-[var(--dim)]">
                  Motivos: {ingesta.motivosDeFallo.join(" · ")}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-[var(--dim)]">
                Recarga la página para ver los datos nuevos.
              </p>
            </>
          )}
        </div>
      ) : null}

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
                        <>
                          <span className="tabular-nums">{interes > 0 ? "+" : ""}{interes}%</span>
                          {volumenDe(d) !== null ? (
                            <span className="block text-[10px] text-[var(--dim)]">
                              {Intl.NumberFormat("es-ES").format(volumenDe(d)!)} visitas/día
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.margenPct}%</td>
                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: d.oportunidad.confianza < 60 ? "var(--orange)" : undefined }}>
                      {d.oportunidad.confianza}%
                    </td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                      {d.oportunidad.ausentes.length > 0 ? (
                        <span style={{ color: "var(--orange)" }}>
                          faltan {d.oportunidad.ausentes.length} métrica
                          {d.oportunidad.ausentes.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        `${p.etiqueta} · dato completo`
                      )}
                    </td>
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
        El Opportunity Score se calcula solo con métricas realmente disponibles, y va <b>ajustado por
        confianza</b>: repartir el peso de una métrica ausente no puede premiar a un destino por no tener
        datos. Nunca se rellena con una media ni con un valor generado. Mes de referencia: {mes}.
      </p>
    </Panel>
    </div>
  );
}
