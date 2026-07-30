import { createFileRoute } from "@tanstack/react-router";

import { CriterioComercial } from "@/components/recomendador/CriterioComercial";
import { NuevaRecomendacion } from "@/components/recomendador/NuevaRecomendacion";
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <h1 className="text-base font-medium tracking-tight">
            Recomendador · herramienta interna
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Tabs defaultValue="nueva" className="w-full">
          <TabsList>
            <TabsTrigger value="nueva">Nueva recomendación</TabsTrigger>
            <TabsTrigger value="criterio">Criterio comercial</TabsTrigger>
          </TabsList>
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
