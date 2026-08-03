"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { leerJson } from "@/lib/respuesta";

type Resumen = { fuente: string; detalle: string; ok: number; noAplican: number; sinDato: number; motivo: string | null };

/**
 * Boton de sincronizacion.
 *
 * Antes la aplicacion decia «ejecuta la ingesta» y no ofrecia ninguna forma de
 * hacerlo: la ruta existia pero solo la llamaba el proceso nocturno. Un aviso
 * que pide algo imposible es peor que no avisar.
 */
export default function Sincronizar({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "yendo" | "hecho" | "error">("listo");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Resumen[]>([]);

  async function sincronizar() {
    setEstado("yendo");
    setMensaje("Consultando las cinco fuentes. Tarda entre veinte y cuarenta segundos…");
    setDetalle([]);
    try {
      const r = await fetch("/api/sincronizar", { method: "POST" });
      const datos = await leerJson<{ resumen?: Resumen[]; guardadas?: number }>(r);
      setEstado("hecho");
      setDetalle(datos.resumen ?? []);
      setMensaje(`${datos.guardadas ?? 0} señales guardadas. Actualizando la pantalla…`);
      router.refresh();
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : "No se ha podido sincronizar.");
    }
  }

  return (
    <div className={compacto ? "" : "space-y-2"}>
      <button
        type="button"
        className={compacto ? "btn btn-ghost px-3 py-1.5 text-[11px]" : "btn btn-primary"}
        onClick={sincronizar}
        disabled={estado === "yendo"}
      >
        {estado === "yendo"
          ? <LoaderCircle size={14} className="mr-1.5 inline animate-spin" />
          : <RefreshCw size={14} className="mr-1.5 inline" />}
        {estado === "yendo" ? "Sincronizando…" : "Actualizar los datos"}
      </button>

      {mensaje ? (
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: estado === "error" ? "#FF9868" : "var(--muted)" }}
        >
          {mensaje}
        </p>
      ) : null}

      {detalle.length ? (
        <ul className="space-y-1 text-[10px] leading-relaxed">
          {detalle.map((f) => (
            <li key={f.fuente} className="flex flex-wrap items-baseline gap-x-1.5">
              <b className="text-[var(--text)]">{f.fuente}</b>
              <span style={{ color: "var(--green)" }}>{f.ok} con dato</span>
              {f.noAplican ? <span className="text-[var(--dim)]">· {f.noAplican} no aplican</span> : null}
              {f.sinDato ? <span style={{ color: "#FF9868" }}>· {f.sinDato} sin dato</span> : null}
              {f.sinDato && f.motivo ? (
                <span className="block w-full text-[var(--dim)]">↳ {f.motivo}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
