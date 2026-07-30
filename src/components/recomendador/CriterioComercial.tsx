import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  crearVeto,
  guardarPesos,
  listarCatalogo,
  marcarCampana,
  obtenerCriterio,
  retirarVeto,
} from "@/lib/recomendador.functions";
import { CLAVES_PESOS, ETIQUETAS_PESOS, type ClavePeso } from "@/lib/recomendador/tipos";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function CriterioComercial() {
  const cliente = useQueryClient();
  const leerCriterio = useServerFn(obtenerCriterio);
  const leerCatalogo = useServerFn(listarCatalogo);
  const escribirPesos = useServerFn(guardarPesos);
  const alternarCampana = useServerFn(marcarCampana);
  const anadirVeto = useServerFn(crearVeto);
  const quitarVeto = useServerFn(retirarVeto);

  const criterio = useQuery({ queryKey: ["criterio"], queryFn: () => leerCriterio() });
  const catalogo = useQuery({ queryKey: ["catalogo"], queryFn: () => leerCatalogo() });

  const [pesos, setPesos] = useState<Record<ClavePeso, number> | null>(null);
  const [vetoDestino, setVetoDestino] = useState("");
  const [vetoMes, setVetoMes] = useState<string>("0");
  const [vetoMotivo, setVetoMotivo] = useState("");

  useEffect(() => {
    if (criterio.data && !pesos) setPesos(criterio.data.pesos);
  }, [criterio.data, pesos]);

  const invalidar = () => {
    cliente.invalidateQueries({ queryKey: ["criterio"] });
  };

  const mutarPesos = useMutation({
    mutationFn: (valores: Record<string, number>) => escribirPesos({ data: valores }),
    onSuccess: invalidar,
  });
  const mutarCampana = useMutation({
    mutationFn: (variables: { experienciaId: string; activa: boolean }) =>
      alternarCampana({ data: variables }),
    onSuccess: invalidar,
  });
  const mutarVeto = useMutation({
    mutationFn: (variables: { destinoId: string; mes: number | null; motivo: string }) =>
      anadirVeto({ data: variables }),
    onSuccess: () => {
      setVetoDestino("");
      setVetoMes("0");
      setVetoMotivo("");
      invalidar();
    },
  });
  const mutarRetirada = useMutation({
    mutationFn: (id: number) => quitarVeto({ data: { id } }),
    onSuccess: invalidar,
  });

  if (!pesos || !criterio.data) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando criterio comercial…</p>;
  }

  const suma = CLAVES_PESOS.reduce((total, clave) => total + (pesos[clave] ?? 0), 0);
  const campanas = criterio.data.campanas;
  const experiencias = catalogo.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <section className="space-y-4 rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Pesos de puntuación</h2>
          <span className="text-sm text-muted-foreground">
            Cada peso de 1 (poco) a 5 (mucho) · suma {suma}
          </span>
        </div>

        {CLAVES_PESOS.map((clave) => (
          <div key={clave} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`peso-${clave}`}>{ETIQUETAS_PESOS[clave]}</Label>
              <span className="text-sm tabular-nums">{pesos[clave]}</span>
            </div>
            <Slider
              id={`peso-${clave}`}
              min={1}
              max={5}
              step={1}
              value={[pesos[clave]]}
              onValueChange={([valor]) => setPesos({ ...pesos, [clave]: valor })}
            />
          </div>
        ))}

        <Button
          type="button"
          disabled={mutarPesos.isPending}
          onClick={() => mutarPesos.mutate(pesos)}
        >
          {mutarPesos.isPending ? "Guardando…" : "Guardar pesos"}
        </Button>
      </section>

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Catálogo y campañas</h2>
        <p className="text-xs text-muted-foreground">
          Los destinos marcados como «de campaña» reciben el factor campaña a 1 en la puntuación.
        </p>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {experiencias.map((experiencia) => (
            <li key={experiencia.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`campana-${experiencia.id}`}
                checked={campanas.includes(experiencia.id)}
                onCheckedChange={(valor) =>
                  mutarCampana.mutate({ experienciaId: experiencia.id, activa: valor === true })
                }
              />
              <Label htmlFor={`campana-${experiencia.id}`} className="font-normal">
                {experiencia.nombre} · {experiencia.destino} ({experiencia.pais})
              </Label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">Vetos</h2>
        <form
          className="grid gap-2 md:grid-cols-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!vetoDestino) return;
            mutarVeto.mutate({
              destinoId: vetoDestino,
              mes: vetoMes === "0" ? null : Number(vetoMes),
              motivo: vetoMotivo,
            });
          }}
        >
          <select
            aria-label="Destino vetado"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={vetoDestino}
            onChange={(e) => setVetoDestino(e.target.value)}
          >
            <option value="">Selecciona experiencia</option>
            {experiencias.map((experiencia) => (
              <option key={experiencia.id} value={experiencia.id}>
                {experiencia.nombre} · {experiencia.destino}
              </option>
            ))}
          </select>
          <select
            aria-label="Mes vetado"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={vetoMes}
            onChange={(e) => setVetoMes(e.target.value)}
          >
            <option value="0">Todos los meses</option>
            {MESES.map((nombre, indice) => (
              <option key={nombre} value={indice + 1}>
                {nombre}
              </option>
            ))}
          </select>
          <Input
            placeholder="Motivo"
            value={vetoMotivo}
            onChange={(e) => setVetoMotivo(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={mutarVeto.isPending}>
            Añadir veto
          </Button>
        </form>

        {criterio.data.vetos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay vetos activos.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {criterio.data.vetos.map((veto) => {
              const experiencia = experiencias.find((e) => e.id === veto.destino_id);
              return (
                <li
                  key={veto.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-1 last:border-b-0"
                >
                  <span>
                    {experiencia
                      ? `${experiencia.nombre} · ${experiencia.destino}`
                      : veto.destino_id}
                    {" · "}
                    {veto.mes ? MESES[veto.mes - 1] : "todos los meses"}
                    {veto.motivo ? ` · ${veto.motivo}` : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => mutarRetirada.mutate(veto.id)}
                  >
                    Retirar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
