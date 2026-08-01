"use client";

import type { DestinoConScore } from "@/components/layout/Shell";
import { senalMasReciente, senalMomentum } from "@/lib/signals";

/**
 * La explicacion del score, en castellano y sin jerga.
 *
 * Un agente no confia en un numero que no entiende, y un director no aprueba un
 * criterio que no puede auditar. Asi que el score no se enseña solo: se enseña
 * de que esta hecho, de donde sale cada parte y que pasa cuando algo falta.
 */

/** Traduce cada componente a una frase con el dato crudo, no con el normalizado. */
function frase(clave: string, d: DestinoConScore): string {
  if (clave === "momentum") {
    const s = senalMomentum(d);
    if (s?.valor === null || s?.valor === undefined) return "No hay dato de búsquedas.";
    const signo = s.valor > 0 ? "han subido" : s.valor < 0 ? "han bajado" : "están planas";
    return `Las búsquedas ${signo} un ${Math.abs(s.valor)} % en las últimas cuatro semanas.`;
  }
  if (clave === "volumen") {
    const s = senalMasReciente(d.senales, "volumen_atencion_dia");
    if (!s || s.valor === null) return "No hay dato de cuánta gente lo mira.";
    return `Lo consultan unas ${Math.round(s.valor).toLocaleString("es-ES")} personas al día.`;
  }
  if (clave === "margen") return `La agencia gana un ${d.margenPct} % en cada venta.`;
  if (clave === "disponibilidad") {
    if (d.cupo === 0) return "No queda ninguna plaza.";
    return `Quedan ${d.cupo} plazas por vender.`;
  }
  if (clave === "clima") {
    const s = senalMasReciente(d.senales, "temperatura_media");
    if (!s || s.valor === null) return "No hay dato de temperatura.";
    return `Hace una media de ${Math.round(s.valor)} °C, y lo ideal para viajar son 24 °C.`;
  }
  return "";
}

/** Cuánto de bien sale parado, dicho como lo diría una persona. */
function juicio(valor: number) {
  if (valor >= 0.75) return { texto: "muy bien", color: "var(--green)" };
  if (valor >= 0.5) return { texto: "bien", color: "var(--green)" };
  if (valor >= 0.25) return { texto: "regular", color: "var(--text)" };
  return { texto: "flojo", color: "#FF9868" };
}

export default function PorQue({ destino }: { destino: DestinoConScore }) {
  const { componentes, score, scoreSinAjustar, confianza, noAplicables } = destino.oportunidad;
  const sinDato = componentes.filter((c) => c.aplica && c.valor === null);

  return (
    <div className="space-y-4 rounded-2xl p-4" style={{ background: "rgba(141,245,189,.04)", border: "1px solid var(--line)" }}>
      <p className="text-[13px] leading-relaxed">
        <b>{destino.destino} saca {score} puntos sobre 100.</b>{" "}
        Ese número sale de sumar cinco cosas, cada una con el peso que le ha dado la dirección.
      </p>

      <ul className="space-y-2.5">
        {componentes.map((c) => {
          const nota = c.valor === null ? null : juicio(c.valor);
          return (
            <li key={c.clave} className="grid gap-1.5 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4">
              <div>
                <b className="block text-[12px]">{c.etiqueta}</b>
                <span className="text-[10px] text-[var(--dim)]">vale {c.peso} de los 100 puntos</span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 min-w-[70px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.09)" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.round((c.valor ?? 0) * 100)}%`,
                        background: c.valor === null ? "transparent" : nota?.color ?? "var(--green)",
                      }}
                    />
                  </span>
                  <span className="w-[58px] shrink-0 text-right text-[11px]" style={{ color: nota?.color ?? "var(--dim)" }}>
                    {c.valor === null ? (c.aplica ? "sin dato" : "no aplica") : nota?.texto}
                  </span>
                </div>
                <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted)]">{frase(c.clave, destino)}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--dim)]">Fuente: {c.origen}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 border-t pt-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--line)" }}>
        {sinDato.length ? (
          <p>
            <b style={{ color: "#FF9868" }}>Falta un dato.</b>{" "}
            No hemos podido medir {sinDato.map((c) => c.etiqueta.toLowerCase()).join(" ni ")}.
            No nos lo inventamos: repartimos su peso entre lo que sí tenemos y bajamos la confianza
            al {confianza} %. Por eso el score baja de {scoreSinAjustar} a {score}.
          </p>
        ) : (
          <p><b style={{ color: "var(--green)" }}>Están las cinco medidas.</b> Confianza del {confianza} %, que es el máximo.</p>
        )}
        {noAplicables.length ? (
          <p className="text-[var(--muted)]">
            <b>{noAplicables.join(" y ")}</b> no aplica aquí: la fuente no cubre este destino.
            Eso no es un dato que falte, así que no resta confianza ni penaliza.
          </p>
        ) : null}
      </div>
    </div>
  );
}
