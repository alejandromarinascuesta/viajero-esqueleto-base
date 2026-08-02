"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";

type Resumen = { fuente: string; detalle: string; ok: number; fallos: number };

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
      const datos = (await r.json()) as {
        resumen?: Resumen[]; guardadas?: number; error?: { message: string };
      };
      if (!r.ok) throw new Error(datos.error?.message ?? "No se ha podido sincronizar.");
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
        <ul className="grid gap-1 text-[10px] text-[var(--dim)] sm:grid-cols-2">
          {detalle.map((f) => (
            <li key={f.fuente}>
              · <b className="text-[var(--text)]">{f.fuente}</b> — {f.ok} señales
              {f.fallos ? `, ${f.fallos} sin dato` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
