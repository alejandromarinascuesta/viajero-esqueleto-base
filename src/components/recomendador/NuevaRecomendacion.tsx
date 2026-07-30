import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PerfilForm } from "./PerfilForm";
import { ResultadoPanel } from "./ResultadoPanel";
import { listarDestinos, recomendar } from "@/lib/recomendador.functions";
import type { Perfil } from "@/lib/recomendador/tipos";

export function NuevaRecomendacion() {
  const obtenerDestinos = useServerFn(listarDestinos);
  const ejecutarRecomendacion = useServerFn(recomendar);

  const destinos = useQuery({
    queryKey: ["destinos"],
    queryFn: () => obtenerDestinos(),
  });

  const mutacion = useMutation({
    mutationFn: (perfil: Perfil) => ejecutarRecomendacion({ data: perfil }),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PerfilForm
        destinos={destinos.data ?? []}
        enviando={mutacion.isPending}
        onSubmit={(perfil) => mutacion.mutate(perfil)}
      />
      <ResultadoPanel
        resultado={mutacion.data ?? null}
        cargando={mutacion.isPending}
        error={mutacion.error ? "No se ha podido calcular la recomendación." : null}
      />
    </div>
  );
}
