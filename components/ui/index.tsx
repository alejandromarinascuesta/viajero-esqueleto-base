"use client";

import type { ReactNode } from "react";
import type { Frescura } from "@/types";
import { ETIQUETA_FRESCURA } from "@/lib/data";

export function Kpi({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: "verde" }) {
  return (
    <article className="panel px-5 py-4">
      <span className="block text-[11px] text-[var(--dim)]">{etiqueta}</span>
      <strong className="mt-2 block text-2xl tracking-tight" style={tono === "verde" ? { color: "var(--green)" } : undefined}>
        {valor}
      </strong>
      {nota ? <small className="mt-1 block text-[11px] text-[var(--dim)]">{nota}</small> : null}
    </article>
  );
}

export function Frescor({ estado, detalle }: { estado: Frescura; detalle?: string }) {
  const vivo = estado === "live" || estado === "fresh";
  return (
    <span className="pill pill-line" title={detalle}>
      <span
        className="inline-block h-[7px] w-[7px] rounded-full"
        style={{
          background: vivo ? "var(--green)" : estado === "unavailable" ? "var(--red)" : "var(--orange)",
          boxShadow: vivo ? "0 0 0 4px rgba(141,245,189,.08)" : undefined,
        }}
      />
      {ETIQUETA_FRESCURA[estado]}
    </span>
  );
}

export function Anillo({ valor, sub }: { valor: number; sub: string }) {
  return (
    <div
      className="relative grid h-[124px] w-[124px] place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--green) ${valor}%, rgba(255,255,255,.06) 0)` }}
      role="img"
      aria-label={`${sub}: ${valor} sobre 100`}
    >
      <div className="absolute inset-2 rounded-full" style={{ background: "#0e1c19" }} />
      <div className="relative text-center">
        <b className="block text-3xl leading-none">{valor}</b>
        <span className="text-[8px] tracking-[.14em] text-[var(--dim)]">{sub}</span>
      </div>
    </div>
  );
}

export function Panel({ titulo, extra, children }: { titulo?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel p-5">
      {titulo ? (
        <header className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-[15px] tracking-tight">{titulo}</h3>
          {extra}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <p className="subpanel p-4 text-[13px] text-[var(--muted)]">{mensaje}</p>
  );
}
