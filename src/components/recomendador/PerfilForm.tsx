import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MOTIVACIONES,
  RESTRICCIONES,
  type Motivacion,
  type Perfil,
  type Restriccion,
} from "@/lib/recomendador/tipos";

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

export function PerfilForm({
  destinos,
  enviando,
  onSubmit,
}: {
  destinos: string[];
  enviando: boolean;
  onSubmit: (perfil: Perfil) => void;
}) {
  const [adultos, setAdultos] = useState(2);
  const [edadesNinos, setEdadesNinos] = useState<number[]>([]);
  const [presupuestoTotal, setPresupuestoTotal] = useState(3000);
  const [presupuestoFlexible, setPresupuestoFlexible] = useState(false);
  const [mes, setMes] = useState(7);
  const [dias, setDias] = useState(7);
  const [motivacion, setMotivacion] = useState<Motivacion>("descanso");
  const [intensidad, setIntensidad] = useState(3);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [destinosVisitados, setDestinosVisitados] = useState<string[]>([]);
  const [tensionDeclarada, setTensionDeclarada] = useState("");

  const cambiarNumeroNinos = (cantidad: number) => {
    const total = Math.max(0, Math.min(10, cantidad));
    setEdadesNinos((previas) =>
      Array.from({ length: total }, (_, indice) => previas[indice] ?? 0),
    );
  };

  const alternar = <T,>(lista: T[], valor: T): T[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  return (
    <form
      className="space-y-5 rounded-md border border-border p-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        onSubmit({
          adultos,
          edadesNinos,
          presupuestoTotal,
          presupuestoFlexible,
          mes,
          dias,
          motivacion,
          intensidad,
          restricciones,
          destinosVisitados,
          tensionDeclarada,
        });
      }}
    >
      <h2 className="text-sm font-medium">Perfil del cliente</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adultos">Adultos</Label>
          <Input
            id="adultos"
            type="number"
            min={1}
            value={adultos}
            onChange={(e) => setAdultos(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ninos">Niños</Label>
          <Input
            id="ninos"
            type="number"
            min={0}
            value={edadesNinos.length}
            onChange={(e) => cambiarNumeroNinos(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {edadesNinos.length > 0 ? (
        <div className="space-y-1.5">
          <Label>Edad de cada niño</Label>
          <div className="grid grid-cols-4 gap-2">
            {edadesNinos.map((edad, indice) => (
              <Input
                key={indice}
                type="number"
                min={0}
                max={17}
                aria-label={`Edad del niño ${indice + 1}`}
                value={edad}
                onChange={(e) =>
                  setEdadesNinos((previas) =>
                    previas.map((v, i) => (i === indice ? Number(e.target.value) || 0 : v)),
                  )
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="presupuesto">Presupuesto total (€)</Label>
          <Input
            id="presupuesto"
            type="number"
            min={0}
            step={100}
            value={presupuestoTotal}
            onChange={(e) => setPresupuestoTotal(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dias">Días disponibles</Label>
          <Input
            id="dias"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="flexible"
          checked={presupuestoFlexible}
          onCheckedChange={(valor) => setPresupuestoFlexible(valor === true)}
        />
        <Label htmlFor="flexible" className="font-normal">
          Presupuesto flexible (+10 %)
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mes">Mes del viaje</Label>
          <select
            id="mes"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
          >
            {MESES.map((nombre, indice) => (
              <option key={nombre} value={indice + 1}>
                {indice + 1} · {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motivacion">Motivación</Label>
          <select
            id="motivacion"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={motivacion}
            onChange={(e) => setMotivacion(e.target.value as Motivacion)}
          >
            {MOTIVACIONES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="intensidad">Intensidad deseada (1-5)</Label>
        <Input
          id="intensidad"
          type="number"
          min={1}
          max={5}
          value={intensidad}
          onChange={(e) =>
            setIntensidad(Math.min(5, Math.max(1, Number(e.target.value) || 1)))
          }
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm">Restricciones</legend>
        {RESTRICCIONES.map((opcion) => (
          <div key={opcion.valor} className="flex items-center gap-2">
            <Checkbox
              id={`restriccion-${opcion.valor}`}
              checked={restricciones.includes(opcion.valor)}
              onCheckedChange={() =>
                setRestricciones((previas) => alternar(previas, opcion.valor))
              }
            />
            <Label htmlFor={`restriccion-${opcion.valor}`} className="font-normal">
              {opcion.etiqueta}
            </Label>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm">Destinos ya visitados</legend>
        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-border p-2">
          {destinos.map((destino) => (
            <div key={destino} className="flex items-center gap-2">
              <Checkbox
                id={`destino-${destino}`}
                checked={destinosVisitados.includes(destino)}
                onCheckedChange={() =>
                  setDestinosVisitados((previas) => alternar(previas, destino))
                }
              />
              <Label htmlFor={`destino-${destino}`} className="font-normal">
                {destino}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="tension">Tensión declarada</Label>
        <Textarea
          id="tension"
          rows={3}
          value={tensionDeclarada}
          onChange={(e) => setTensionDeclarada(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Calculando…" : "Recomendar"}
      </Button>
    </form>
  );
}
