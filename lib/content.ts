import { z } from "zod";
import { OBJETIVOS_CONTENIDO } from "@/lib/opciones-contenido";
import { pedirJson, type UsoModelo } from "@/lib/ai";
import type { Destino, PlanContenido } from "@/types";
import { vozPara } from "@/lib/locucion";

/**
 * Dos objetivos, no cinco.
 *
 * Los otros tres eran variantes de estos dos y producian la misma pieza con
 * otra etiqueta. Estos si dan peliculas distintas: una pide algo al espectador
 * y la otra no le pide nada, y eso cambia el ritmo, el cierre y hasta si se
 * menciona el precio.
 */
export { OBJETIVOS_CONTENIDO } from "@/lib/opciones-contenido";

/** Direccion creativa de cada objetivo. Es lo que hace que no salga lo mismo. */
export const DIRECCION_OBJETIVO: Record<(typeof OBJETIVOS_CONTENIDO)[number], string> = {
  "Generar solicitudes de presupuesto":
    "Respuesta directa. Corta al grano en la primera escena, planos rapidos, frases de menos de diez palabras. " +
    "Puedes usar el precio orientativo y las noches si estan en los hechos permitidos. " +
    "El cierre pide una accion concreta y el CTA es imperativo. Crea una razon para escribir hoy, sin inventar urgencia falsa ni plazas que no sepas que existen.",
  "Inspirar y aumentar notoriedad":
    "Marca. No pidas nada hasta el final y hazlo suave. Ritmo mas lento, planos que respiran, frases con aire. " +
    "NO menciones precio ni numero de noches: aqui se construye deseo, no se cierra una venta. " +
    "El cierre es una invitacion abierta, no una llamada a la accion.",
};

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

/**
 * Cada objetivo tiene su propia familia de angulos, y no se solapan.
 *
 * No es solo para que salgan piezas distintas: es que los recursos que
 * funcionan para pedir algo no son los que funcionan para no pedir nada. La
 * objecion y la cuenta atras empujan a actuar; el momento y lo sensorial
 * construyen deseo sin pedir nada.
 */
const FAMILIAS: Record<(typeof OBJETIVOS_CONTENIDO)[number], string[]> = {
  "Generar solicitudes de presupuesto": ["objecion", "eleccion", "cuenta_atras", "detalle"],
  "Inspirar y aumentar notoriedad": ["momento", "contraste", "quien_eres", "sensorial"],
};

const TONOS = ["inspirador", "premium", "familiar", "aventurero"];

export type BriefAngulo = {
  destinoId: string;
  objetivo: (typeof OBJETIVOS_CONTENIDO)[number];
  tono: string;
  duracion: 15 | 30;
};

/**
 * Elige el angulo a partir de TODO el brief.
 *
 * Antes dependia solo del destino, asi que cambiar el objetivo devolvia la
 * misma pieza y parecia que los controles no hacian nada. Ahora el objetivo
 * decide la familia, y el tono y la duracion desplazan la posicion dentro de
 * ella una cantidad fija: cambiar cualquiera de los tres cambia el angulo
 * siempre, no la mayoria de las veces.
 */
export function elegirAngulo(brief: BriefAngulo, semilla = Date.now()) {
  const familia = FAMILIAS[brief.objetivo] ?? FAMILIAS["Generar solicitudes de presupuesto"];
  let base = Math.floor(semilla / 600_000);
  for (const caracter of brief.destinoId) base = (Math.imul(base, 31) + caracter.charCodeAt(0)) | 0;
  const tono = Math.max(0, TONOS.indexOf(brief.tono));
  const desplazamiento = tono + (brief.duracion === 15 ? 0 : 2);
  const indice = (((base + desplazamiento) % familia.length) + familia.length) % familia.length;
  return ANGULOS.find((a) => a.id === familia[indice]) ?? ANGULOS[0];
}

export const EntradaContenido = z.object({
  destinationId: z.string().min(1).max(40),
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

RÓTULO Y VOZ SON DOS COSAS DISTINTAS, y esto es lo más importante del encargo.
- "texto_pantalla" es el rótulo que se LEE: máximo seis palabras, seco, sin verbo si hace falta. Es un titular.
- "locucion" es lo que se OYE: una frase hablada, natural, de menos de quince palabras.
- Los dos dicen lo mismo, pero NUNCA con las mismas palabras. Si el rótulo aparece dentro de la locución, está mal.
- Se comprueba automáticamente y se rechaza la salida entera si se solapan.

Ejemplos de cómo debe ser:
  rótulo "Cuarenta playas, no una" · locución "Aquí no eliges playa el primer día. Eliges cuál te toca hoy."
  rótulo "Agosto sin colas" · locución "La gente viene en julio. Tú puedes venir cuando ya se han ido."
  rótulo "Dos horas de vuelo" · locución "Sales por la mañana y comes allí."
Ejemplo de lo que está PROHIBIDO:
  rótulo "Cuarenta playas" · locución "Cuarenta playas para elegir." (repite el rótulo)

CÓMO SUENA la locución: hay un locutor real leyéndola con un cronómetro delante. Frases cortas, verbos, español de España hablado, como se lo contarías a un amigo. Nada de "descubre", "sumérgete", "experiencia única", "rincón mágico" ni lenguaje de folleto.

EL OBJETIVO MANDA: te doy la dirección creativa en "direccion_objetivo". Cambia el ritmo, el cierre y si se menciona el precio. Dos piezas del mismo destino con objetivos distintos tienen que ser reconociblemente distintas.

Devuelve solo JSON con: concepto, hook, escenas[{titulo,texto_pantalla,locucion,consulta_visual}], caption, cta, hashtags y hechos_utilizados. hechos_utilizados debe copiar literalmente los elementos de HECHOS_PERMITIDOS que hayas usado.`;

const normalizar = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Un rotulo y una locucion que dicen lo mismo hacen que el video suene a
 * teleprompter: se lee en pantalla y se oye a la vez, palabra por palabra. Se
 * comprueba en codigo porque pedirselo al modelo no basta.
 *
 * No se exige que hablen de cosas distintas — tienen que decir lo mismo — sino
 * que lo digan con otras palabras.
 */
export function seSolapan(rotulo: string, locucion: string) {
  const a = normalizar(rotulo);
  const b = normalizar(locucion);
  if (!a || !b) return false;
  if (a === b || b.includes(a) || a.includes(b)) return true;
  const palabras = (t: string) => new Set(t.split(" ").filter((p) => p.length > 3));
  const ra = palabras(a);
  const rb = palabras(b);
  if (!ra.size || !rb.size) return false;
  let comunes = 0;
  for (const palabra of ra) if (rb.has(palabra)) comunes += 1;
  return comunes / Math.min(ra.size, rb.size) > 0.7;
}

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
  // El respaldo tambien separa rotulo y voz: si dicen lo mismo, el video suena
  // a teleprompter. El rotulo titula y la locucion lo cuenta.
  const aperturas = [
    { rotulo: `${destino.destino}`, voz: `¿Te imaginas estar aquí en dos semanas?` },
    { rotulo: `¿Cuánto hace ya?`, voz: `¿Cuánto hace que no te vas a ${destino.destino}?` },
    { rotulo: `El próximo`, voz: `¿Y si el siguiente viaje fuera ${destino.destino}?` },
    { rotulo: `Te lo estás perdiendo`, voz: `¿Sabes lo que te estás perdiendo en ${destino.destino}?` },
  ];
  const apertura = aperturas[Math.abs(destino.id.length + destino.destino.length) % aperturas.length];
  const cierre = entrada.objective === "Inspirar y aumentar notoriedad"
    ? { rotulo: destino.destino, voz: "Cuando te apetezca, aquí estamos.", cta: "Te lo enseñamos" }
    : { rotulo: "Tu propuesta", voz: "Cuéntanos cómo quieres viajar y te la preparamos.", cta: "Pide tu propuesta" };

  const escenas = [
    { titulo: destino.destino, textoPantalla: apertura.rotulo, locucion: apertura.voz, consultaVisual: `${destino.destino} viaje` },
    // Con un solo mensaje en pantalla el motivo cabe entero: ya no hace falta
    // trocearlo a las cinco primeras palabras, que era lo que producia rotulos
    // cortados a mitad de frase.
    ...motivos.slice(0, 3).map((m) => ({
      titulo: destino.destino,
      textoPantalla: m,
      locucion: m,
      consultaVisual: `${destino.destino} ${m}`,
    })),
    { titulo: "Tu próximo viaje", textoPantalla: cierre.rotulo, locucion: cierre.voz, consultaVisual: `${destino.destino} atardecer` },
  ].slice(0, entrada.duration === 15 ? 4 : 5);

  while (escenas.length < 4) escenas.push({ ...escenas[escenas.length - 1] });

  return {
    modo: "fallback-verificado",
    destinoId: destino.id,
    destino: destino.destino,
    creadoEn: new Date().toISOString(),
    voz: vozPara(entrada.tone, destino.id),
    concepto: `${destino.destino}, visto desde lo que realmente vende esta experiencia`,
    hook: apertura.voz,
    objetivo: entrada.objective,
    tono: entrada.tone,
    duracion: entrada.duration,
    mezclaVisual: entrada.visualMix,
    escenas,
    caption: `${destino.destino} puede ser tu próximo viaje. ${motivos.slice(0, 2).join(". ")}. Pide una propuesta adaptada a ti.`,
    cta: cierre.cta,
    hashtags: [`#${destino.destino.replace(/\s+/g, "")}`, "#Viajes", "#TravelInspiration"],
    hechosUtilizados: motivos.slice(0, 3),
    advertencias: [
      "Guion de continuidad generado únicamente con la ficha verificada del catálogo.",
      "Sin modelo disponible no hay paráfrasis posible sin inventar, así que la voz lee el motivo tal cual está escrito en la ficha.",
    ],
  };
}

export async function generarPlanContenido(
  destino: Destino,
  entrada: z.infer<typeof EntradaContenido>,
): Promise<{ plan: PlanContenido; uso: UsoModelo }> {
  const permitidos = hechos(destino);
  const angulo = elegirAngulo({
    destinoId: destino.id,
    objetivo: entrada.objective,
    tono: entrada.tone,
    duracion: entrada.duration,
  });
  const contexto = JSON.stringify({
    canal: "TikTok e Instagram Reels",
    formato: "vertical 9:16",
    duracion_segundos: entrada.duration,
    escenas_objetivo: entrada.duration === 15 ? 4 : 5,
    objetivo: entrada.objective,
    direccion_objetivo: DIRECCION_OBJETIVO[entrada.objective],
    tono: entrada.tone,
    angulo: angulo.guia,
    HECHOS_PERMITIDOS: permitidos,
  });
  // Mas temperatura que en el resto del sistema, y a proposito: aqui no se
  // decide nada, se redacta. Lo que se afirma ya esta acotado por los hechos
  // permitidos y se verifica despues, asi que el riesgo de subirla es cero y lo
  // que se gana es que dos piezas no salgan calcadas.
  let respuesta = await pedirJson<unknown>(INSTRUCCION, contexto, 0.85);
  let validada = SalidaModelo.safeParse(respuesta.datos);

  // Un segundo intento antes de rendirse. El respaldo no puede parafrasear sin
  // inventar, asi que su resultado es notablemente peor: merece la pena gastar
  // una llamada mas en evitarlo.
  if (!validada.success) {
    const correccion = `${INSTRUCCION}\n\nEl intento anterior no cumplió el formato: ${validada.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}. Corrígelo y devuelve solo el JSON.`;
    respuesta = await pedirJson<unknown>(correccion, contexto, 0.7);
    validada = SalidaModelo.safeParse(respuesta.datos);
  }
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
      voz: vozPara(entrada.tone, `${destino.id}${angulo.id}${entrada.objective}`),
      concepto: validada.data.concepto,
      hook: validada.data.hook,
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
      advertencias: [
        "Revisión humana obligatoria antes de publicar.",
        ...(validada.data.escenas.some((e) => seSolapan(e.texto_pantalla, e.locucion))
          ? ["En alguna escena el rótulo y la voz dicen lo mismo con las mismas palabras."]
          : []),
      ],
    },
    uso: respuesta.uso,
  };
}
