import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ingerirSenales, listarFichasUnificadas } from "@/lib/senales.functions";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const FUENTES = [
  {
    id: "catalogo",
    nombre: "Catálogo de la agencia",
    detalle: "interna · estructurada · manual",
    clave: false,
  },
  {
    id: "interes",
    nombre: "Interés por destino",
    detalle: "Wikipedia · vistas de página · mensual",
    clave: false,
  },
  {
    id: "clima",
    nombre: "Clima",
    detalle: "Open-Meteo · archivo histórico · estable",
    clave: false,
  },
  {
    id: "vuelos",
    nombre: "Precio de vuelo",
    detalle: "Amadeus · diseñado, requiere clave",
    clave: true,
  },
  { id: "calendario", nombre: "Calendario escolar", detalle: "estática · diseñada", clave: true },
];

export function Senales() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [orden, setOrden] = useState<"interes" | "reservas">("interes");
  const cargar = useServerFn(listarFichasUnificadas);
  const ingerir = useServerFn(ingerirSenales);
  const cliente = useQueryClient();

  const fichas = useQuery({
    queryKey: ["fichas-unificadas", mes],
    queryFn: () => cargar({ data: { mes } }),
  });

  const refrescar = useMutation({
    mutationFn: () => ingerir({ data: { mes } }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["fichas-unificadas"] }),
  });

  const filas = fichas.data ?? [];
  const conClima = filas.filter((f) => f.temperaturaMedia !== null).length;
  const conInteres = filas.filter((f) => f.tendenciaInteres !== null).length;
  const conReservas = filas.filter((f) => f.cuotaReservas !== null).length;

  const metrica = orden === "reservas" ? "cuotaReservas" : "tendenciaInteres";
  const conSenal = filas.filter((f) => f[metrica] !== null);
  const top5 = [...conSenal].sort((a, b) => (b[metrica] ?? 0) - (a[metrica] ?? 0)).slice(0, 5);
  const maxAbs = Math.max(1, ...top5.map((f) => Math.abs(f[metrica] ?? 0)));
  const unidad = orden === "reservas" ? "" : " %";

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Los 5 destinos más demandados</h2>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {(["interes", "reservas"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrden(o)}
                className={
                  orden === o
                    ? "rounded px-2 py-1 text-xs bg-muted"
                    : "rounded px-2 py-1 text-xs text-muted-foreground"
                }
              >
                {o === "interes" ? "por interés" : "por reservas"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {orden === "interes"
            ? "Atención sobre el destino: vistas de página de los últimos 3 meses frente a los 3 anteriores."
            : "Intención consumada: cuota de reservas reales desde Madrid en los sistemas de Amadeus."}
        </p>

        {top5.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {orden === "reservas"
              ? "No hay datos de reservas. Requiere las credenciales de Amadeus; sin ellas el resto del panel funciona igual."
              : "Todavía no hay señal ingerida. Pulsa «Refrescar fuentes» más abajo."}
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {top5.map((f, i) => {
              const valor = f[metrica] ?? 0;
              const ancho = Math.round((Math.abs(valor) / maxAbs) * 100);
              return (
                <li key={f.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="w-36 shrink-0 truncate text-sm">{f.destino}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={
                        valor >= 0
                          ? "block h-full bg-foreground/70"
                          : "block h-full bg-muted-foreground/40"
                      }
                      style={{ width: `${ancho}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm">
                    {orden === "interes" && valor > 0 ? "+" : ""}
                    {valor}
                    {unidad}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {f.precioDesdePp} €
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Esto ordena qué promover al mercado, no qué proponer a un cliente concreto. Son dos
          decisiones distintas: la primera es de la dirección, la segunda del agente. El panel de
          criterio comercial es la bisagra entre las dos.
        </p>
      </section>

      <section className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mes-senales">Mes de referencia</Label>
            <select
              id="mes-senales"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {i + 1} · {m}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={() => refrescar.mutate()} disabled={refrescar.isPending}>
            {refrescar.isPending ? "Ingiriendo…" : "Refrescar fuentes"}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          La ingesta es en lote y está desacoplada del consumo: el motor nunca llama a una fuente
          externa durante una recomendación, solo lee esta ficha ya cocinada.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FUENTES.map((f) => {
            const cubiertos =
              f.id === "clima"
                ? conClima
                : f.id === "interes"
                  ? conInteres
                  : f.id === "catalogo"
                    ? filas.length
                    : 0;
            return (
              <div key={f.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm">{f.nombre}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {f.clave ? "diseñada" : `${cubiertos}/${filas.length}`}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{f.detalle}</p>
              </div>
            );
          })}
        </div>

        {refrescar.data ? (
          <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
            {refrescar.data.resumen.map((r) => (
              <li key={r.fuente}>
                {r.fuente}: {r.ok} con dato, {r.fallos} sin dato · {r.ms} ms
              </li>
            ))}
          </ul>
        ) : null}
        {refrescar.error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            La ingesta ha fallado. Las señales anteriores siguen en uso y las que falten se marcan
            como no disponibles: nunca se sustituyen por un valor inventado.
          </p>
        ) : null}
      </section>

      <section className="rounded-md border border-border">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-medium">Ficha unificada de destino</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Una fila por destino y mes. Lo que aporta el catálogo, lo que aportan las fuentes
            externas, y qué falta.
          </p>
        </div>

        {fichas.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-normal">Destino</th>
                  <th className="px-4 py-2 font-normal">Tipo</th>
                  <th className="px-4 py-2 text-right font-normal">Desde</th>
                  <th className="px-4 py-2 text-right font-normal">Margen</th>
                  <th className="px-4 py-2 text-right font-normal">Temp. media</th>
                  <th className="px-4 py-2 text-right font-normal">Interés 3m</th>
                  <th className="px-4 py-2 text-right font-normal">Reservas</th>
                  <th className="px-4 py-2 font-normal">Sin dato</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <span>{f.destino}</span>
                      <span className="block text-[11px] text-muted-foreground">{f.pais}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{f.tipo}</td>
                    <td className="px-4 py-2 text-right">{f.precioDesdePp} €</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{f.margenPct} %</td>
                    <td className="px-4 py-2 text-right">
                      {f.temperaturaMedia !== null ? (
                        `${f.temperaturaMedia} °C`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.tendenciaInteres !== null ? (
                        <span>
                          {f.tendenciaInteres > 0 ? "+" : ""}
                          {f.tendenciaInteres} %
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.cuotaReservas !== null ? (
                        f.cuotaReservas
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-muted-foreground">
                      {f.fuentesFaltantes.length ? f.fuentesFaltantes.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
