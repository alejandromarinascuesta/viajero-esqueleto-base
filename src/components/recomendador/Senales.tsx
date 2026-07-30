import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { accionRecomendada, pulso } from "@/lib/recomendador/temperatura";
import { ingerirSenales, listarFichasUnificadas } from "@/lib/senales.functions";
import type { FichaUnificada } from "@/lib/senales.functions";

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
  { id: "catalogo", nombre: "Catálogo de la agencia", detalle: "interna · manual", activa: true },
  {
    id: "interes",
    nombre: "Interés por destino",
    detalle: "Wikipedia · vistas diarias",
    activa: true,
  },
  { id: "clima", nombre: "Clima", detalle: "Open-Meteo · histórico", activa: true },
  {
    id: "reservas",
    nombre: "Reservas reales",
    detalle: "Amadeus · solo periodos históricos en pruebas",
    activa: false,
  },
  {
    id: "vuelos",
    nombre: "Precio de vuelo",
    detalle: "Amadeus · requiere producción",
    activa: false,
  },
  { id: "calendario", nombre: "Calendario escolar", detalle: "estática · diseñada", activa: false },
];

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function Senales() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [abierta, setAbierta] = useState<FichaUnificada | null>(null);
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
  const conSenal = filas.filter((f) => f.tendenciaInteres !== null);
  const suben = conSenal.filter((f) => (f.tendenciaInteres ?? 0) >= 8).length;
  const bajan = conSenal.filter((f) => (f.tendenciaInteres ?? 0) <= -8).length;
  const ordenadas = [...conSenal].sort(
    (a, b) => (b.tendenciaInteres ?? 0) - (a.tendenciaInteres ?? 0),
  );
  const sinSenal = filas.filter((f) => f.tendenciaInteres === null);
  const maxAbs = Math.max(1, ...conSenal.map((f) => Math.abs(f.tendenciaInteres ?? 0)));

  return (
    <div className="space-y-4">
      {/* Cabecera: estado de un vistazo */}
      <section className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Dato valor={String(filas.length)} etiqueta="destinos" />
            <Dato valor={`🔥 ${suben}`} etiqueta="suben" />
            <Dato valor={`🥶 ${bajan}`} etiqueta="bajan" />
            <Dato valor={`${conSenal.length}/${filas.length}`} etiqueta="con señal" />
          </div>
          <div className="flex shrink-0 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mes-senales" className="text-xs">
                Mes
              </Label>
              <select
                id="mes-senales"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={() => refrescar.mutate()} disabled={refrescar.isPending}>
              {refrescar.isPending ? "Ingiriendo…" : "Refrescar fuentes"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FUENTES.map((f) => (
            <span
              key={f.id}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground"
              title={f.detalle}
            >
              {f.activa ? "●" : "○"} {f.nombre}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ● activa · ○ diseñada, no conectada. La ingesta es en lote: el motor nunca llama a una
          fuente externa durante una recomendación.
        </p>

        {refrescar.data ? (
          <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
            {refrescar.data.resumen.map((r) => (
              <li key={r.fuente}>
                {r.fuente}: {r.ok} con dato, {r.fallos} sin dato · {r.ms} ms
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Ranking */}
      {ordenadas.length > 0 ? (
        <section className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium">Los 5 que más suben</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Interés de los últimos 28 días frente a los 28 anteriores. Esto ordena qué promover al
            mercado, no qué proponer a un cliente concreto.
          </p>
          <ol className="mt-3 space-y-2">
            {ordenadas.slice(0, 5).map((f, i) => {
              const p = pulso(f.tendenciaInteres);
              return (
                <li
                  key={f.id}
                  className="grid grid-cols-[1rem_1.5rem_minmax(6rem,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <span className="text-base leading-none">{p.icono}</span>
                  <span className="truncate text-sm">{f.destino}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-foreground/70"
                      style={{
                        width: `${Math.round((Math.abs(f.tendenciaInteres ?? 0) / maxAbs) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {(f.tendenciaInteres ?? 0) > 0 ? "+" : ""}
                    {f.tendenciaInteres} %
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* Tarjetas por destino */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Catálogo por demanda</h2>
          <span className="text-xs text-muted-foreground">
            pulsa un destino para ver qué hacer con él
          </span>
        </div>

        {fichas.isPending ? (
          <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            Cargando…
          </p>
        ) : null}

        {[...ordenadas, ...sinSenal].map((f) => {
          const p = pulso(f.tendenciaInteres);
          const accion = accionRecomendada(f, mes);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setAbierta(f)}
              className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md border border-border p-3 text-left transition-colors hover:border-foreground/40 md:grid-cols-[2rem_minmax(9rem,14rem)_7rem_minmax(0,1fr)_7rem]"
            >
              <span className="text-center text-xl leading-none">{p.icono}</span>

              <span className="min-w-0">
                <span className="block truncate text-sm">{f.destino}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {f.pais} · {f.tipo}
                </span>
              </span>

              <span className="text-right text-sm tabular-nums md:text-left">
                {f.tendenciaInteres !== null ? (
                  <>
                    {f.tendenciaInteres > 0 ? "+" : ""}
                    {f.tendenciaInteres} %
                  </>
                ) : (
                  <span className="text-muted-foreground">sin señal</span>
                )}
                <span className="block text-[11px] text-muted-foreground">{p.etiqueta}</span>
              </span>

              <span className="col-span-3 min-w-0 md:col-span-1">
                <span className="block truncate text-sm">{accion.titulo}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {accion.detalle}
                </span>
              </span>

              <span className="col-span-3 text-right md:col-span-1">
                <span className="text-sm tabular-nums">{euros.format(f.precioDesdePp)}</span>
                <span className="ml-2 text-[11px] text-muted-foreground md:ml-0 md:block">
                  {f.temperaturaMedia !== null ? `${f.temperaturaMedia} °C` : "—"}
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <DetalleDestino ficha={abierta} mes={mes} onCerrar={() => setAbierta(null)} />
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div>
      <div className="text-xl">{valor}</div>
      <div className="text-[11px] text-muted-foreground">{etiqueta}</div>
    </div>
  );
}

function DetalleDestino({
  ficha,
  mes,
  onCerrar,
}: {
  ficha: FichaUnificada | null;
  mes: number;
  onCerrar: () => void;
}) {
  return (
    <Dialog open={ficha !== null} onOpenChange={(v) => (!v ? onCerrar() : undefined)}>
      <DialogContent className="max-w-lg">
        {ficha ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{pulso(ficha.tendenciaInteres).icono}</span>
                <span>{ficha.destino}</span>
              </DialogTitle>
              <DialogDescription>
                {ficha.nombre} · {ficha.pais}
              </DialogDescription>
            </DialogHeader>

            {(() => {
              const a = accionRecomendada(ficha, mes);
              return (
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.detalle}</p>
                </div>
              );
            })()}

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <Campo k="Desde" v={euros.format(ficha.precioDesdePp)} />
              <Campo k="Noches" v={String(ficha.noches)} />
              <Campo k="Cupo" v={`${ficha.cupo} plazas`} />
              <Campo k="Margen" v={`${ficha.margenPct} %`} />
              <Campo k="Vuelo" v={`${ficha.horasVuelo} h`} />
              <Campo k="Temporada" v={ficha.temporada} />
            </dl>

            <div>
              <p className="text-xs font-medium">Señales externas</p>
              <dl className="mt-1 grid grid-cols-3 gap-3 text-sm">
                <Campo
                  k="Interés 28d"
                  v={
                    ficha.tendenciaInteres !== null
                      ? `${ficha.tendenciaInteres > 0 ? "+" : ""}${ficha.tendenciaInteres} %`
                      : "sin dato"
                  }
                />
                <Campo
                  k="Temperatura"
                  v={ficha.temperaturaMedia !== null ? `${ficha.temperaturaMedia} °C` : "sin dato"}
                />
                <Campo
                  k="Reservas"
                  v={ficha.cuotaReservas !== null ? String(ficha.cuotaReservas) : "sin dato"}
                />
              </dl>
            </div>

            {ficha.frescura.length > 0 ? (
              <div>
                <p className="text-xs font-medium">Procedencia</p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {ficha.frescura.map((s) => (
                    <li key={s.fuente}>
                      {s.fuente}: {s.estado}
                      {s.obtenido ? ` · ${new Date(s.obtenido).toLocaleString("es-ES")}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ficha.fuentesFaltantes.length > 0 ? (
              <div>
                <Badge variant="outline" className="w-fit text-[10px]">
                  sin dato de: {ficha.fuentesFaltantes.join(", ")}
                </Badge>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Un hueco nunca se rellena con un valor inventado: se marca, y el peso de esa señal
                  baja en la puntuación.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Campo({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
