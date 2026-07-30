import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PerfilForm } from "./PerfilForm";
import { ResultadoPanel } from "./ResultadoPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listarDestinos, recomendar, registrarDescarte } from "@/lib/recomendador.functions";
import type { Perfil, ResultadoRecomendacion } from "@/lib/recomendador/tipos";

export function NuevaRecomendacion() {
  const obtenerDestinos = useServerFn(listarDestinos);
  const ejecutarRecomendacion = useServerFn(recomendar);
  const guardarDescarte = useServerFn(registrarDescarte);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [afinar, setAfinar] = useState("");
  const [resultado, setResultado] = useState<ResultadoRecomendacion | null>(null);
  const ultimaRecomendacion = useRef<number | null>(null);

  const destinos = useQuery({
    queryKey: ["destinos"],
    queryFn: () => obtenerDestinos(),
  });

  const mutacion = useMutation({
    mutationFn: (variables: { perfil: Perfil; excluidos: string[]; afinar: string }) =>
      ejecutarRecomendacion({ data: variables }),
    onSuccess: (datos) => {
      setResultado(datos);
      ultimaRecomendacion.current = datos.recomendacionId ?? null;
    },
  });

  const lanzar = (siguientePerfil: Perfil, siguientesExcluidos: string[], texto: string) => {
    setPerfil(siguientePerfil);
    setExcluidos(siguientesExcluidos);
    mutacion.mutate({ perfil: siguientePerfil, excluidos: siguientesExcluidos, afinar: texto });
  };

  const descartar = async (id: string, motivo: string) => {
    if (!perfil) return;
    await guardarDescarte({
      data: { recomendacionId: ultimaRecomendacion.current, destinoId: id, motivo },
    });
    lanzar(perfil, [...excluidos, id], afinar);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PerfilForm
        destinos={destinos.data ?? []}
        enviando={mutacion.isPending}
        onSubmit={(nuevoPerfil) => lanzar(nuevoPerfil, [], afinar)}
      />

      <div className="space-y-4">
        <div className="space-y-1.5 rounded-md border border-border p-4">
          <Label htmlFor="afinar">Afinar</Label>
          <div className="flex gap-2">
            <Input
              id="afinar"
              placeholder="más barato, vuelo más corto…"
              value={afinar}
              onChange={(e) => setAfinar(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!perfil || mutacion.isPending}
              onClick={() => perfil && lanzar(perfil, excluidos, afinar)}
            >
              Recalcular
            </Button>
          </div>
        </div>

        <ResultadoPanel
          resultado={resultado}
          cargando={mutacion.isPending}
          error={mutacion.error ? "No se ha podido calcular la recomendación." : null}
          excluidos={excluidos}
          onDescartar={descartar}
          onReiniciar={() => perfil && lanzar(perfil, [], afinar)}
        />
      </div>
    </div>
  );
}
