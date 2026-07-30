"use client";

import { useEffect, useMemo, useState } from "react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Panel, Vacio } from "@/components/ui";
import { CLAVES_PESOS, ETIQUETAS } from "@/lib/criterio";
import { PESOS_POR_DEFECTO, puntuar, type Pesos, type Veto } from "@/lib/motor";
import type { Perfil } from "@/types";

/**
 * Aquí es donde esto deja de ser un algoritmo y pasa a ser una plataforma: el
 * criterio comercial de la agencia se vuelve una palanca de la dirección, no
 * una decisión cableada en el código.
 */

// Cliente de referencia para previsualizar el efecto de mover los pesos. No
// interviene en las recomendaciones reales: solo sirve para ver el cambio.
const CLIENTE_MUESTRA: Perfil = {
  adultos: 2, edadesNinos: [], presupuestoTotal: 4000, presupuestoFlexible: false,
  mes: new Date().getMonth() + 1, dias: 7, motivacion: "descanso", intensidad: 2,
  restricciones: [], destinosVisitados: [], tensionDeclarada: "",
};

export default function CriterioComercial({ destinos }: { destinos: DestinoConScore[] }) {
  const [pesos, setPesos] = useState<Pesos>({ ...PESOS_POR_DEFECTO });
  const [campanas, setCampanas] = useState<string[]>([]);
  const [vetos, setVetos] = useState<Veto[]>([]);
  const [persistido, setPersistido] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const control = new AbortController();
    async function cargar() {
      try {
        const r = await fetch("/api/criterio", { signal: control.signal });
        const d = (await r.json()) as { pesos: Pesos; campanas: string[]; vetos: Veto[]; persistido: boolean };
        if (control.signal.aborted) return;
        setPesos(d.pesos);
        setCampanas(d.campanas ?? []);
        setVetos(d.vetos ?? []);
        setPersistido(d.persistido);
      } catch {
        if (!control.signal.aborted) setPersistido(false);
      }
    }
    void cargar();
    return () => control.abort();
  }, []);

  // El efecto de mover una palanca se ve al instante, sin guardar nada.
  const orden = useMemo(() => {
    const margenes = destinos.map((d) => d.margenPct);
    const rango = {
      margenMin: Math.min(...margenes),
      margenMax: Math.max(...margenes),
      cupoMax: Math.max(...destinos.map((d) => d.cupo)),
    };
    const vetados = new Set(
      vetos.filter((v) => v.mes === null || v.mes === CLIENTE_MUESTRA.mes).map((v) => v.destinoId),
    );
    return destinos
      .filter((d) => !vetados.has(d.id))
      .map((d) => ({ d, p: puntuar(d, CLIENTE_MUESTRA, pesos, rango, campanas) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 5);
  }, [destinos, pesos, campanas, vetos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? destinos.filter((d) => d.destino.toLowerCase().includes(q)) : destinos;
  }, [destinos, busqueda]);

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/criterio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pesos),
      });
      const d = (await r.json()) as { guardado: boolean; mensaje: string; error?: { message: string } };
      setAviso(d.error?.message ?? d.mensaje);
      if (d.guardado) setPersistido(true);
    } catch {
      setAviso("No se ha podido guardar. Los cambios siguen aplicados en esta sesión.");
    } finally {
      setGuardando(false);
    }
  }

  const alternar = (id: string, lista: string[], set: (v: string[]) => void) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const vetado = (id: string) => vetos.some((v) => v.destinoId === id && v.mes === null);

  const alternarVeto = (id: string) =>
    setVetos(
      vetado(id)
        ? vetos.filter((v) => !(v.destinoId === id && v.mes === null))
        : [...vetos, { destinoId: id, mes: null, motivo: "veto de la dirección" }],
    );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-4">
        <Panel
          titulo="Qué pesa en cada recomendación"
          extra={
            <button type="button" className="btn btn-primary px-4 py-2 text-[12px]" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar criterio"}
            </button>
          }
        >
          <p className="mb-5 text-[12px] leading-relaxed text-[var(--muted)]">
            Del 1 al 5, como se lo explicarías a alguien de tu equipo. Al guardar, los cuarenta agentes
            recomiendan con este criterio el mismo día, sin tocar código y sin volver a explicarlo persona
            por persona.
          </p>

          <div className="space-y-5">
            {CLAVES_PESOS.map((clave) => (
              <div key={clave}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={`peso-${clave}`} className="text-[13px]">
                    {ETIQUETAS[clave].nombre}
                  </label>
                  <span className="tabular-nums text-[13px]" style={{ color: "var(--green)" }}>
                    {pesos[clave]}
                  </span>
                </div>
                <input
                  id={`peso-${clave}`}
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={pesos[clave]}
                  onChange={(e) => setPesos({ ...pesos, [clave]: Number(e.target.value) })}
                  className="mt-2 w-full"
                  style={{ accentColor: "var(--green)" }}
                />
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--dim)]">{ETIQUETAS[clave].explica}</p>
              </div>
            ))}
          </div>

          {aviso ? <p className="subpanel mt-5 p-3 text-[12px]">{aviso}</p> : null}
          {persistido === false ? (
            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--orange)" }}>
              Sin base de datos configurada los cambios se aplican en esta sesión pero no se guardan.
            </p>
          ) : null}
        </Panel>

        <Panel
          titulo="Campañas y vetos"
          extra={
            <label className="relative">
              <span className="sr-only">Buscar destino</span>
              <input
                className="field w-40 text-[12px]"
                placeholder="Buscar destino"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          }
        >
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--muted)]">
            Una <b>campaña</b> sube el destino en el orden. Un <b>veto</b> lo retira: es una regla
            inviolable, así que el agente no puede saltárselo aunque el cliente insista.
          </p>

          {filtrados.length === 0 ? (
            <Vacio mensaje="Ningún destino con ese nombre." />
          ) : (
            <ul className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
              {filtrados.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.018)" }}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{d.destino}</span>
                    <span className="block text-[10px] text-[var(--dim)]">{d.pais} · margen {d.margenPct}% · {d.cupo} plazas</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
                      aria-pressed={campanas.includes(d.id)}
                      onClick={() => alternar(d.id, campanas, setCampanas)}
                      style={campanas.includes(d.id) ? { borderColor: "var(--line-strong)", color: "var(--green)" } : undefined}
                    >
                      Campaña
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
                      aria-pressed={vetado(d.id)}
                      onClick={() => alternarVeto(d.id)}
                      style={vetado(d.id) ? { borderColor: "var(--red)", color: "var(--red)" } : undefined}
                    >
                      Vetar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel titulo="Efecto en el orden, ahora mismo">
        <p className="mb-4 text-[12px] leading-relaxed text-[var(--muted)]">
          Qué propondría el motor a un cliente de referencia —pareja, 4.000 €, siete noches, descanso— con
          el criterio que tienes puesto. Se recalcula al mover cualquier palanca, antes de guardar.
        </p>
        <ol className="space-y-2">
          {orden.map(({ d, p }, i) => (
            <li key={d.id} className="flex items-center gap-3">
              <span className="w-4 text-[11px] text-[var(--dim)]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{d.destino}</span>
                <span className="block text-[10px] text-[var(--dim)]">
                  margen {d.margenPct}% · {d.cupo} plazas
                  {campanas.includes(d.id) ? " · en campaña" : ""}
                </span>
              </span>
              <span className="bar w-16"><i style={{ width: `${Math.round(p * 100)}%` }} /></span>
            </li>
          ))}
        </ol>
        {vetos.length > 0 ? (
          <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--red)" }}>
            {vetos.length} destino{vetos.length === 1 ? "" : "s"} vetado{vetos.length === 1 ? "" : "s"}: no
            aparecen en ninguna recomendación.
          </p>
        ) : null}
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
          Los pesos ordenan lo que ya ha sobrevivido a las reglas duras. Nunca las anulan: subir el margen
          al máximo no hace que el sistema proponga un vuelo de diez horas a una familia con un bebé.
        </p>
      </Panel>
    </div>
  );
}
