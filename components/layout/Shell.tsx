"use client";

import { useState } from "react";
import { Activity, ArrowLeft, Clapperboard, MapPin, MessageSquare, Network, SlidersHorizontal, X } from "lucide-react";
import type { Destino, Oportunidad } from "@/types";
import type { OrigenDatos } from "@/lib/data";
import { Frescor } from "@/components/ui";
import Radar from "@/components/radar/Radar";
import Destino360 from "@/components/destination/Destino360";
import Copiloto from "@/components/copilot/Copiloto";
import CriterioComercial from "@/components/criterio/CriterioComercial";
import Sincronizar from "@/components/ui/Sincronizar";
import Arquitectura from "@/components/architecture/Arquitectura";
import ContentStudio from "@/components/content/ContentStudio";

export type DestinoConScore = Destino & { oportunidad: Oportunidad };

// Cuatro secciones, un recorrido lineal: donde esta la oportunidad, por que,
// que le digo a este cliente, y como cambia la direccion el criterio.
// La arquitectura se explica, no se navega: vive en un panel aparte.
// Un solo menú, un solo estilo, siempre visible. Antes había tres mecanismos
// distintos para llegar a cinco sitios, y dos de ellos desaparecían en
// pantallas estrechas: nadie descubría media aplicación.
const VISTAS = [
  { id: "radar", nombre: "Radar", icono: Activity, pista: "Dónde vender ahora" },
  { id: "destino", nombre: "Destino 360", icono: MapPin, pista: "De dónde sale cada dato" },
  { id: "copiloto", nombre: "Copiloto", icono: MessageSquare, pista: "Preparar una propuesta" },
  { id: "contenido", nombre: "Content Studio", icono: Clapperboard, pista: "Vídeo vertical para redes" },
  { id: "criterio", nombre: "Ajustes de dirección", icono: SlidersHorizontal, pista: "El criterio comercial" },
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
  const [seleccion, setSeleccion] = useState<string>(
    () => [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score)[0]?.id ?? "",
  );
  const destinosContenido = [...destinos]
    .sort((a, b) => b.oportunidad.score - a.oportunidad.score)
    .slice(0, 5);

  const abrirDestino = (id: string) => {
    setSeleccion(id);
    setVista("destino");
  };
  const abrirCopiloto = (id: string) => {
    setSeleccion(id);
    setVista("copiloto");
  };
  const abrirContenido = (id: string) => {
    setSeleccion(destinosContenido.some((d) => d.id === id) ? id : destinosContenido[0]?.id ?? id);
    setVista("contenido");
  };

  const activo = destinos.find((d) => d.id === seleccion) ?? destinos[0];
  const titulo = vista === "destino"
    ? activo?.destino ?? "Destino"
    : vista === "criterio"
      ? "Ajustes de dirección"
      : VISTAS.find((v) => v.id === vista)?.nombre ?? "";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside
        className="flex flex-col border-b p-5 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r"
        style={{ borderColor: "var(--line)", background: "rgba(6,14,12,.88)", backdropFilter: "blur(24px)" }}
      >
        <div className="flex items-center gap-3 pb-5">
          <div
            className="grid h-9 w-9 place-items-center rounded-[11px] font-black"
            style={{ background: "linear-gradient(145deg,var(--green),#56d999)", color: "#092116" }}
          >
            T
          </div>
          <div>
            <strong className="block text-[14px] tracking-tight">Destination Pulse</strong>
            <span className="block text-[10px] text-[var(--dim)]">Decisión comercial</span>
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
                className="flex items-start gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors"
                style={{
                  background: on ? "rgba(141,245,189,.09)" : "transparent",
                  color: on ? "var(--text)" : "#8ba097",
                }}
              >
                <Icono size={16} className="mt-0.5 shrink-0" style={{ color: on ? "var(--green)" : "#66857a" }} aria-hidden />
                <span>
                  <span className="block">{v.nombre}</span>
                  <span className="block text-[10px] font-normal" style={{ color: on ? "var(--muted)" : "#5f7a70" }}>
                    {v.pista}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-2 pt-6">
          <Sincronizar compacto />
          <button type="button" className="btn btn-ghost w-full text-[11px]" onClick={() => setVerArquitectura(true)}>
            <Network size={13} className="mr-1.5 inline" aria-hidden />
            Cómo funciona por dentro
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-12 sm:px-6 lg:px-8">
        <header className="flex h-[72px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {vista === "destino" ? (
              <button type="button" className="btn btn-ghost px-2.5 py-2" onClick={() => setVista("radar")} aria-label="Volver al Radar">
                <ArrowLeft size={15} aria-hidden />
              </button>
            ) : null}
            <div className="min-w-0">
              {vista === "destino" ? (
                <span className="block text-[9px] font-bold tracking-[.14em] text-[var(--green)]">DESTINO 360</span>
              ) : null}
              <h1 className="truncate text-[22px] tracking-tight">{titulo}</h1>
              <span className="text-[10px] text-[var(--dim)]">
                {vista === "destino"
                  ? "De dónde sale cada número de este destino"
                  : "Señales reales · decisiones explicables"}
              </span>
            </div>
          </div>
          <Frescor estado={origen.frescura} detalle={origen.detalle} />
        </header>

        {vista === "radar" ? (
          <Radar
            destinos={destinos}
            origen={origen}
            onAbrirDestino={abrirDestino}
            onAbrirCopiloto={abrirCopiloto}
            onAbrirContenido={abrirContenido}
          />
        ) : null}
        {vista === "destino" && activo ? (
          <Destino360 destino={activo} destinos={destinos} mes={mes} onSeleccionar={setSeleccion} onAbrirCopiloto={abrirCopiloto} onAbrirContenido={abrirContenido} />
        ) : null}
        {vista === "copiloto" ? <Copiloto destinoSugerido={activo?.destino ?? ""} /> : null}
        {vista === "contenido" ? <ContentStudio destinos={destinosContenido} destinoSugerido={activo?.id ?? ""} onSeleccionar={setSeleccion} /> : null}
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

