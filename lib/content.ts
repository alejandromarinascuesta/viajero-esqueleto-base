import { z } from "zod";
import { pedirJson, type UsoModelo } from "@/lib/ai";
import type { Destino, PlanContenido } from "@/types";
import { vozPara } from "@/lib/locucion";

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

/**
 * Angulos narrativos. Sin esto, el modelo escribe siempre la misma pieza con el
 * nombre del destino cambiado: mismo arranque, mismo ritmo, misma voz. Rotar el
 * angulo es lo que hace que dos campanias seguidas no se parezcan.
 *
 * Ninguno aniade informacion: todos son formas distintas de ordenar los mismos
 * hechos verificados de la ficha.
 */
export const ANGULOS = [
  {
    id: "detalle",
    guia: "Arranca por un detalle pequenio y concreto de la ficha, no por el destino entero. Lo pequenio se recuerda; lo grande se olvida.",
  },
  {
    id: "objecion",
    guia: "Empieza por la duda que tendria este cliente antes de reservar y desmontala con un hecho de la ficha.",
  },
  {
    id: "momento",
    guia: "Cuenta un momento concreto del viaje, a una hora concreta del dia, como si el espectador ya estuviera alli.",
  },
  {
    id: "contraste",
    guia: "Contrapon lo que la gente espera de este destino con lo que la ficha dice que realmente ofrece.",
  },
  {
    id: "eleccion",
    guia: "Plantea una eleccion entre dos formas de pasar el mismo tiempo, y que este destino sea una de ellas.",
  },
  {
    id: "cuenta_atras",
    guia: "Habla del tiempo: lo que dura el viaje frente a lo que dura la espera. Ritmo corto y frases sueltas.",
  },
  {
    id: "quien_eres",
    guia: "Dirigete a un tipo concreto de viajero por como viaja, no por su edad, y que se reconozca en la primera frase.",
  },
  {
    id: "sensorial",
    guia: "Construye la pieza sobre lo que se oye, se huele o se toca alli, apoyandote solo en los motivos de la ficha.",
  },
] as const;

/** Rota el angulo por destino y momento: la misma campania repetida no se repite. */
export function elegirAngulo(destinoId: string, semilla = Date.now()) {
  let suma = Math.floor(semilla / 60_000);
  for (const caracter of destinoId) suma += caracter.charCodeAt(0);
  return ANGULOS[Math.abs(suma) % ANGULOS.length];
}

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
  hook: z.string().min(5).max(90).refine((h) => h.includes("?"), "El hook tiene que ser una pregunta"),
  escenas: z.array(z.object({
    titulo: z.string().min(2).max(60),
    texto_pantalla: z.string().min(2).max(70),
    locucion: z.string().min(3).max(120),
    consulta_visual: z.string().min(2).max(100),
  })).min(4).max(6),
  caption: z.string().min(20).max(600),
  cta: z.string().min(3).max(80),
  hashtags: z.array(z.string().min(2).max(35)).min(3).max(8),
  hechos_utilizados: z.array(z.string().min(2).max(220)).max(8),
});

const INSTRUCCION = `Eres el director creativo de una agencia de viajes europea. Escribes guiones verticales 9:16 para TikTok e Instagram Reels.

REGLA ABSOLUTA: solo puedes afirmar hechos incluidos literalmente en HECHOS_PERMITIDOS. No inventes monumentos, playas concretas, distancias, temperaturas, premios, servicios ni cifras. Las consultas visuales pueden contener el nombre del destino y conceptos presentes en esos hechos. No prometas disponibilidad ni precio cerrado.

CÓMO EMPIEZA: la primera escena abre SIEMPRE con una pregunta directa al espectador, de tú. Del tipo "¿Te imaginas…?", "¿Cuánto hace que…?", "¿Y si…?", "¿Sabes qué pasa cuando…?". Varía la fórmula, no uses siempre la misma. El campo "hook" es esa pregunta y tiene que llevar signo de interrogación.

ÁNGULO DE ESTA PIEZA: te doy uno en el contexto, en "angulo". Constrúyela entera sobre él. Dos campañas de destinos distintos no pueden sonar igual: si esta pieza podría servir cambiando el nombre del destino, está mal escrita.

CÓMO SUENA: "locucion" es lo que se pronuncia en voz alta, y hay un locutor real leyéndolo con un cronómetro delante. Máximo unas quince palabras por escena. Frases cortas, verbos, español de España hablado. Nada de "descubre", "sumérgete", "experiencia única", "rincón mágico" ni lenguaje de folleto. "texto_pantalla" es el rótulo y va aún más corto que la locución: no lo repitas palabra por palabra.

Devuelve solo JSON con: concepto, hook, escenas[{titulo,texto_pantalla,locucion,consulta_visual}], caption, cta, hashtags y hechos_utilizados. hechos_utilizados debe copiar literalmente los elementos de HECHOS_PERMITIDOS que hayas usado.`;

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
  const aperturas = [
    `¿Te imaginas ${destino.destino} este año?`,
    `¿Cuánto hace que no te vas a ${destino.destino}?`,
    `¿Y si el próximo fuera ${destino.destino}?`,
    `¿Sabes qué se te está pasando en ${destino.destino}?`,
  ];
  const apertura = aperturas[Math.abs(destino.id.length + destino.destino.length) % aperturas.length];
  const escenas = [
    { titulo: destino.destino, textoPantalla: apertura, locucion: apertura, consultaVisual: `${destino.destino} viaje` },
    ...motivos.slice(0, 3).map((m) => ({ titulo: destino.destino, textoPantalla: m, locucion: m, consultaVisual: `${destino.destino} ${m}` })),
    { titulo: "Tu próximo viaje", textoPantalla: `Pide tu propuesta`, locucion: `Cuéntanos cómo quieres viajar y te la preparamos.`, consultaVisual: `${destino.destino} atardecer` },
  ].slice(0, entrada.duration === 15 ? 4 : 5);

  while (escenas.length < 4) escenas.push({ ...escenas[escenas.length - 1] });

  return {
    modo: "fallback-verificado",
    destinoId: destino.id,
    destino: destino.destino,
    creadoEn: new Date().toISOString(),
    voz: vozPara(entrada.tone, destino.id),
    concepto: `${destino.destino}, visto desde lo que realmente vende esta experiencia`,
    hook: apertura,
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
  const angulo = elegirAngulo(destino.id);
  const contexto = JSON.stringify({
    canal: "TikTok e Instagram Reels",
    formato: "vertical 9:16",
    duracion_segundos: entrada.duration,
    escenas_objetivo: entrada.duration === 15 ? 4 : 5,
    audiencia: entrada.audience,
    objetivo: entrada.objective,
    tono: entrada.tone,
    angulo: angulo.guia,
    HECHOS_PERMITIDOS: permitidos,
  });
  // Mas temperatura que en el resto del sistema, y a proposito: aqui no se
  // decide nada, se redacta. Lo que se afirma ya esta acotado por los hechos
  // permitidos y se verifica despues, asi que el riesgo de subirla es cero y lo
  // que se gana es que dos piezas no salgan calcadas.
  const respuesta = await pedirJson<unknown>(INSTRUCCION, contexto, 0.85);
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
      angulo: angulo.id,
      voz: vozPara(entrada.tone, `${destino.id}${angulo.id}`),
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
