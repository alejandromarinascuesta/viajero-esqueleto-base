import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Copiloto } from "@/components/recomendador/Copiloto";
import { CriterioComercial } from "@/components/recomendador/CriterioComercial";
import { NuevaRecomendacion } from "@/components/recomendador/NuevaRecomendacion";
import { Senales } from "@/components/recomendador/Senales";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recomendador · herramienta interna" },
      {
        name: "description",
        content:
          "Herramienta interna de la agencia de viajes para crear recomendaciones y gestionar criterios comerciales.",
      },
      {
        property: "og:title",
        content: "Recomendador · herramienta interna",
      },
      {
        property: "og:description",
        content:
          "Herramienta interna de la agencia de viajes para crear recomendaciones y gestionar criterios comerciales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  // Modo tecnico: apagado por defecto. Abre la traza de la orquestacion, que
  // es lo que permite explicar los servicios, como se encadenan y donde estan
  // los puntos criticos.
  const [tecnico, setTecnico] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <h1 className="text-base font-medium tracking-tight">
            Recomendador · herramienta interna
          </h1>
          <div className="flex items-center gap-2">
            <Label htmlFor="modo-tecnico" className="text-xs text-muted-foreground">
              Modo técnico
            </Label>
            <Switch id="modo-tecnico" checked={tecnico} onCheckedChange={setTecnico} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="senales" className="w-full">
          <TabsList>
            <TabsTrigger value="senales">Señales y fuentes</TabsTrigger>
            <TabsTrigger value="copiloto">Copiloto</TabsTrigger>
            <TabsTrigger value="nueva">Perfil detallado</TabsTrigger>
            <TabsTrigger value="criterio">Criterio comercial</TabsTrigger>
          </TabsList>

          <TabsContent value="senales" className="pt-4">
            <Senales />
          </TabsContent>

          <TabsContent value="copiloto" className="pt-4">
            <Copiloto tecnico={tecnico} />
          </TabsContent>

          <TabsContent value="nueva" className="pt-4">
            <NuevaRecomendacion />
          </TabsContent>

          <TabsContent value="criterio" className="pt-4">
            <CriterioComercial />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
