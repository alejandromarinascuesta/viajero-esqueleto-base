import { NextResponse } from "next/server";
import { cargarDestinos } from "@/lib/data";
import { hayModelo } from "@/lib/ai";
import { hayPexels } from "@/lib/pexels";
import { hayLocucion } from "@/lib/locucion";
import { presupuestoMensual, resumen } from "@/lib/observabilidad";

export const dynamic = "force-dynamic";

export async function GET() {
  const { destinos, origen } = await cargarDestinos();
  return NextResponse.json({
    status: "ok",
    modeloLenguaje: hayModelo() ? "configurado" : "no configurado",
    bancoVisual: hayPexels() ? "Pexels" : "Wikimedia Commons (respaldo)",
    locucion: hayLocucion() ? "configurada" : "no configurada",
    observabilidad: {
      llamadasEnVentana: resumen().llamadas,
      costeAcumulado: resumen().costeTotal,
      presupuestoMensual: presupuestoMensual(),
      alerta: resumen().alerta,
    },
    origenDatos: origen.modo,
    frescura: origen.frescura,
    ingestadoEn: origen.ingestadoEn,
    destinos: destinos.length,
    fuentes: ["Catálogo de la agencia", "Google Trends vía SerpApi", "Open-Meteo", "Wikimedia Pageviews", "INE", "BCE", hayPexels() ? "Pexels" : "Wikimedia Commons"],
    timestamp: new Date().toISOString(),
  });
}
