"use client";

import { useState } from "react";
import { Activity, Compass, MessageSquare, Network, SlidersHorizontal, X } from "lucide-react";
import type { Destino, Oportunidad } from "@/types";
import type { OrigenDatos } from "@/lib/data";
import { Frescor } from "@/components/ui";
import Radar from "@/components/radar/Radar";
import Destino360 from "@/components/destination/Destino360";
import Copiloto from "@/components/copilot/Copiloto";
import CriterioComercial from "@/components/criterio/CriterioComercial";
import Arquitectura from "@/components/architecture/Arquitectura";

export type DestinoConScore = Destino & { oportunidad: Oportunidad };

// Cuatro secciones, un recorrido lineal: donde esta la oportunidad, por que,
// que le digo a este cliente, y como cambia la direccion el criterio.
// La arquitectura se explica, no se navega: vive en un panel aparte.
const VISTAS = [
  { id: "radar", nombre: "Radar de demanda", icono: Activity },
  { id: "destino", nombre: "Destino 360", icono: Compass },
  { id: "copiloto", nombre: "Copiloto", icono: MessageSquare },
  { id: "criterio", nombre: "Criterio comercial", icono: SlidersHorizontal },
] as const;

export type Vista = (typeof VISTAS)[number]["id"];

export default function Shell({
  destinos,
  origen,
  mes,
}: {
  destinos: DestinoConScore[];
  origen: OrigenDatos;
  mes: number;
}) {
  const [vista, setVista] = useState<Vista>("radar");
  const [verArquitectura, setVerArquitectura] = useState(false);
  const [seleccion, setSeleccion] = useState<string>(destinos[0]?.id ?? "");

  const abrirDestino = (id: string) => {
    setSeleccion(id);
    setVista("destino");
  };
  const abrirCopiloto = (id: string) => {
    setSeleccion(id);
    setVista("copiloto");
  };

  const activo = destinos.find((d) => d.id === seleccion) ?? destinos[0];
  const titulo = VISTAS.find((v) => v.id === vista)?.nombre ?? "";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside
        className="flex flex-col border-b p-5 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r"
        style={{ borderColor: "var(--line)", background: "rgba(6,14,12,.88)", backdropFilter: "blur(24px)" }}
      >
        <div className="flex items-center gap-3 pb-7">
          <div
            className="grid h-9 w-9 place-items-center rounded-[11px] font-black"
            style={{ background: "linear-gradient(145deg,var(--green),#56d999)", color: "#092116" }}
          >
            T
          </div>
          <div>
            <strong className="block text-[14px] tracking-tight">Travel Intelligence</strong>
            <span className="block text-[10px] text-[var(--dim)]">Plataforma de inteligencia turística</span>
          </div>
        </div>

        <nav className="grid gap-1.5 lg:flex lg:flex-col" aria-label="Secciones">
          {VISTAS.map((v) => {
            const Icono = v.icono;
            const on = vista === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                aria-current={on ? "page" : undefined}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors"
                style={{
                  background: on ? "rgba(141,245,189,.09)" : "transparent",
                  color: on ? "var(--text)" : "#8ba097",
                }}
              >
                <Icono size={16} style={{ color: on ? "var(--green)" : "#66857a" }} aria-hidden />
                {v.nombre}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden gap-3 pt-6 lg:grid">
          <button type="button" className="btn btn-ghost w-full" onClick={() => setVerArquitectura(true)}>
            <Network size={14} className="mr-1.5 inline" aria-hidden />
            Ver la arquitectura
          </button>
          <div className="subpanel p-3">
            <Frescor estado={origen.frescura} detalle={origen.detalle} />
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--dim)]">
              {origen.detalle}. Ningún indicador se rellena con valores inventados.
            </p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-12 sm:px-6 lg:px-8">
        <header className="flex h-[92px] items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[9px] font-extrabold tracking-[.16em] text-[var(--dim)]">
              AGENCIA EUROPEA · ESPACIO DE DECISIÓN COMERCIAL
            </span>
            <h1 className="mt-1.5 truncate text-[24px] tracking-tight">{titulo}</h1>
          </div>
          <Frescor estado={origen.frescura} detalle={origen.detalle} />
        </header>

        {vista === "radar" ? (
          <Radar
            destinos={destinos}
            origen={origen}
            onAbrirDestino={abrirDestino}
            onAbrirCopiloto={abrirCopiloto}
          />
        ) : null}
        {vista === "destino" && activo ? (
          <Destino360 destino={activo} destinos={destinos} mes={mes} onSeleccionar={setSeleccion} onAbrirCopiloto={abrirCopiloto} />
        ) : null}
        {vista === "copiloto" ? <Copiloto destinoSugerido={activo?.destino ?? ""} /> : null}
        {vista === "criterio" ? <CriterioComercial destinos={destinos} /> : null}
      </main>

      {verArquitectura ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-8"
          style={{ background: "rgba(0,0,0,.68)", backdropFilter: "blur(8px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Arquitectura de la plataforma"
          onClick={(e) => e.target === e.currentTarget && setVerArquitectura(false)}
          onKeyDown={(e) => e.key === "Escape" && setVerArquitectura(false)}
          tabIndex={-1}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="btn btn-ghost px-3 py-2"
                onClick={() => setVerArquitectura(false)}
                aria-label="Cerrar"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <Arquitectura origen={origen} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
