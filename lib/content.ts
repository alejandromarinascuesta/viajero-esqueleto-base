import { z } from "zod";
import { pedirJson, type UsoModelo } from "@/lib/ai";
import type { Destino, PlanContenido } from "@/types";

export const AUDIENCIAS_CONTENIDO = [
  "Parejas de 30 a 45 años",
  "Familias con niños",
  "Viajeros premium",
  "Jóvenes de 20 a 30 años",
  "Mayores de 55 años",
  "Grupos de amigos",
] as const;

export const OBJETIVOS_CONTENIDO = [
  "Generar solicitudes de presupuesto",
  "Inspirar y aumentar notoriedad",
  "Promocionar una oferta concreta",
  "Captar nuevos seguidores",
  "Reactivar clientes de la agencia",
] as const;

export const EntradaContenido = z.object({
  destinationId: z.string().min(1).max(40),
  audience: z.enum(AUDIENCIAS_CONTENIDO),
  objective: z.enum(OBJETIVOS_CONTENIDO),
  tone: z.enum(["inspirador", "premium", "familiar", "aventurero"]),
  duration: z.union([z.literal(15), z.literal(30)]),
  visualMix: z.enum(["video", "mixto", "fotos"]),
});

const SalidaModelo = z.object({
  concepto: z.string().min(8).max(160),
  hook: z.string().min(5).max(90),
  escenas: z.array(z.object({
    titulo: z.string().min(2).max(60),
    texto_pantalla: z.string().min(2).max(70),
    locucion: z.string().min(3).max(180),
    consulta_visual: z.string().min(2).max(100),
  })).min(4).max(6),
  caption: z.string().min(20).max(600),
  cta: z.string().min(3).max(80),
  hashtags: z.array(z.string().min(2).max(35)).min(3).max(8),
  hechos_utilizados: z.array(z.string().min(2).max(220)).max(8),
});

const INSTRUCCION = `Eres el director creativo de una agencia de viajes europea. Genera un guion vertical 9:16 muy visual para TikTok e Instagram Reels.

REGLA ABSOLUTA: solo puedes afirmar hechos incluidos literalmente en HECHOS_PERMITIDOS. No inventes monumentos, playas concretas, distancias, temperaturas, premios, servicios ni cifras. Las consultas visuales pueden contener el nombre del destino y conceptos presentes en esos hechos. No prometas disponibilidad ni precio cerrado.

El video tiene que despertar deseo de viajar: hook inmediato, escenas cortas, lenguaje natural de España y cierre comercial. Nada de frases vacías como "una experiencia inolvidable". Devuelve solo JSON con: concepto, hook, escenas[{titulo,texto_pantalla,locucion,consulta_visual}], caption, cta, hashtags y hechos_utilizados. hechos_utilizados debe copiar literalmente los elementos de HECHOS_PERMITIDOS que hayas usado.`;

function limpiarHashtag(valor: string) {
  const limpio = valor.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return limpio ? `#${limpio}` : "";
}

function hechos(destino: Destino) {
  return [
    `Destino: ${destino.destino}`,
    `País: ${destino.pais}`,
    `Tipo de experiencia: ${destino.tipo}`,
    `Precio orientativo desde ${destino.precioDesdePp} euros por persona`,
    `${destino.noches} noches`,
    ...destino.motivos,
  ].filter(Boolean);
}

export function contenidoFallback(
  destino: Destino,
  entrada: z.infer<typeof EntradaContenido>,
): PlanContenido {
  const motivos = destino.motivos.length ? destino.motivos : [`Experiencia de tipo ${destino.tipo}`];
  const escenas = [
    { titulo: destino.destino, textoPantalla: `¿Y si tu próximo viaje fuera ${destino.destino}?`, locucion: `Hay destinos que se miran. ${destino.destino} se vive.`, consultaVisual: `${destino.destino} viaje` },
    ...motivos.slice(0, 3).map((m) => ({ titulo: destino.destino, textoPantalla: m, locucion: m, consultaVisual: `${destino.destino} ${m}` })),
    { titulo: "Tu próximo viaje", textoPantalla: `Pide tu propuesta para ${destino.destino}`, locucion: `Cuéntanos cómo quieres viajar y preparamos tu propuesta para ${destino.destino}.`, consultaVisual: `${destino.destino} atardecer` },
  ].slice(0, entrada.duration === 15 ? 4 : 6);

  while (escenas.length < 4) escenas.push({ ...escenas[escenas.length - 1] });

  return {
    modo: "fallback-verificado",
    destinoId: destino.id,
    destino: destino.destino,
    creadoEn: new Date().toISOString(),
    concepto: `${destino.destino}, visto desde lo que realmente vende esta experiencia`,
    hook: `¿Y si tu próximo viaje fuera ${destino.destino}?`,
    audiencia: entrada.audience,
    objetivo: entrada.objective,
    tono: entrada.tone,
    duracion: entrada.duration,
    mezclaVisual: entrada.visualMix,
    escenas,
    caption: `${destino.destino} puede ser tu próximo viaje. ${motivos.slice(0, 2).join(". ")}. Pide una propuesta adaptada a ti.`,
    cta: "Pide tu propuesta",
    hashtags: [`#${destino.destino.replace(/\s+/g, "")}`, "#Viajes", "#TravelInspiration"],
    hechosUtilizados: motivos.slice(0, 3),
    advertencias: ["Guion de continuidad generado únicamente con la ficha verificada del catálogo."],
  };
}

export async function generarPlanContenido(
  destino: Destino,
  entrada: z.infer<typeof EntradaContenido>,
): Promise<{ plan: PlanContenido; uso: UsoModelo }> {
  const permitidos = hechos(destino);
  const contexto = JSON.stringify({
    canal: "TikTok e Instagram Reels",
    formato: "vertical 9:16",
    duracion_segundos: entrada.duration,
    audiencia: entrada.audience,
    objetivo: entrada.objective,
    tono: entrada.tone,
    HECHOS_PERMITIDOS: permitidos,
  });
  const respuesta = await pedirJson<unknown>(INSTRUCCION, contexto, 0.55);
  const validada = SalidaModelo.safeParse(respuesta.datos);
  if (!validada.success) return { plan: contenidoFallback(destino, entrada), uso: respuesta.uso };

  const usadosValidos = validada.data.hechos_utilizados.every((h) => permitidos.includes(h));
  if (!usadosValidos) {
    return {
      plan: { ...contenidoFallback(destino, entrada), advertencias: ["La salida del modelo citó hechos fuera de la ficha y fue sustituida automáticamente."] },
      uso: { ...respuesta.uso, ok: false, error: "hechos no verificables" },
    };
  }

  return {
    plan: {
      modo: "live-ai",
      destinoId: destino.id,
      destino: destino.destino,
      creadoEn: new Date().toISOString(),
      concepto: validada.data.concepto,
      hook: validada.data.hook,
      audiencia: entrada.audience,
      objetivo: entrada.objective,
      tono: entrada.tone,
      duracion: entrada.duration,
      mezclaVisual: entrada.visualMix,
      escenas: validada.data.escenas.map((e) => ({
        titulo: e.titulo,
        textoPantalla: e.texto_pantalla,
        locucion: e.locucion,
        consultaVisual: e.consulta_visual,
      })),
      caption: validada.data.caption,
      cta: validada.data.cta,
      hashtags: validada.data.hashtags.map(limpiarHashtag).filter(Boolean),
      hechosUtilizados: validada.data.hechos_utilizados,
      advertencias: ["Revisión humana obligatoria antes de publicar."],
    },
    uso: respuesta.uso,
  };
}
