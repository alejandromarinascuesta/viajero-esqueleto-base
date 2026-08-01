import type { ActivoVisual, PlanContenido } from "@/types";

/**
 * Montaje de la pieza vertical en el navegador.
 *
 * Se dibuja escena a escena sobre un canvas 720x1280 y se graba con
 * MediaRecorder. No hay servidor de render: para una demo es la opcion mas
 * rapida y la que menos piezas moviles tiene. En produccion esto se sustituye
 * por un render en servidor (Shotstack o Remotion) por dos razones — control del
 * codec y no depender del portatil de quien lo genera.
 */

const ANCHO = 720;
const ALTO = 1280;
const FPS = 30;

/** Margen de seguridad: TikTok e Instagram tapan estas franjas con su interfaz. */
const SEGURO_SUP = 220;
const SEGURO_INF = 330;
const MARGEN = 56;

export type ResultadoVideo = { blob: Blob; extension: string; contenedor: string };

/* ─────────────────────────── carga de material ─────────────────────────── */

function porProxy(url: string) {
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function intentarImagen(src: string, espera: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const reloj = window.setTimeout(() => resolve(null), espera);
    img.crossOrigin = "anonymous";
    img.onload = () => { window.clearTimeout(reloj); resolve(img); };
    img.onerror = () => { window.clearTimeout(reloj); resolve(null); };
    img.src = src;
  });
}

/**
 * Primero se intenta el origen directo. El CDN del banco ya manda cabeceras
 * CORS, asi que el canvas no se contamina y ademas evita que cada byte del
 * material pase por nuestra funcion de servidor. El proxy queda como respaldo
 * para los origenes que no las mandan.
 */
async function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return (await intentarImagen(url, 9_000)) ?? (await intentarImagen(porProxy(url), 12_000));
}

function intentarVideo(src: string, espera: number): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let resuelto = false;
    const terminar = (valor: HTMLVideoElement | null) => {
      if (resuelto) return;
      resuelto = true;
      window.clearTimeout(reloj);
      resolve(valor);
    };
    const reloj = window.setTimeout(() => terminar(null), espera);
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.oncanplay = () => {
      void video.play().catch(() => undefined);
      terminar(video);
    };
    video.onerror = () => terminar(null);
    video.src = src;
    video.load();
  });
}

async function cargarVideo(url: string): Promise<HTMLVideoElement | null> {
  return (await intentarVideo(url, 9_000)) ?? (await intentarVideo(porProxy(url), 14_000));
}

type Recurso =
  | { tipo: "video"; elemento: HTMLVideoElement }
  | { tipo: "imagen"; elemento: HTMLImageElement };

async function cargarRecurso(activo: ActivoVisual | undefined): Promise<Recurso | null> {
  if (!activo) return null;
  if (activo.tipo === "video") {
    const video = await cargarVideo(activo.url);
    if (video) return { tipo: "video", elemento: video };
    if (activo.miniatura) {
      const respaldo = await cargarImagen(activo.miniatura);
      if (respaldo) return { tipo: "imagen", elemento: respaldo };
    }
    return null;
  }
  const imagen = await cargarImagen(activo.url);
  return imagen ? { tipo: "imagen", elemento: imagen } : null;
}

/* ──────────────────────────────── dibujo ──────────────────────────────── */

function dimensiones(recurso: Recurso) {
  return recurso.tipo === "video"
    ? { w: recurso.elemento.videoWidth, h: recurso.elemento.videoHeight }
    : { w: recurso.elemento.naturalWidth, h: recurso.elemento.naturalHeight };
}

/**
 * Encaje por recorte central con un empuje lento. En un clip vertical el
 * movimiento es minimo, porque el plano ya se mueve solo; en una foto se nota
 * mas, que es justo lo que hace que una imagen fija no parezca fija.
 */
function fondo(ctx: CanvasRenderingContext2D, recurso: Recurso, avance: number) {
  const { w, h } = dimensiones(recurso);
  if (!w || !h) return;
  const empuje = recurso.tipo === "video" ? 0.02 : 0.11;
  const escala = Math.max(ANCHO / w, ALTO / h) * (1.015 + avance * empuje);
  const ancho = w * escala;
  const alto = h * escala;
  ctx.drawImage(recurso.elemento, (ANCHO - ancho) / 2, (ALTO - alto) / 2, ancho, alto);
}

function degradado(ctx: CanvasRenderingContext2D) {
  const arriba = ctx.createLinearGradient(0, 0, 0, 360);
  arriba.addColorStop(0, "rgba(4,14,12,.72)");
  arriba.addColorStop(1, "rgba(4,14,12,0)");
  ctx.fillStyle = arriba;
  ctx.fillRect(0, 0, ANCHO, 360);

  const abajo = ctx.createLinearGradient(0, ALTO - 780, 0, ALTO);
  abajo.addColorStop(0, "rgba(4,14,12,0)");
  abajo.addColorStop(0.55, "rgba(4,14,12,.55)");
  abajo.addColorStop(1, "rgba(4,14,12,.95)");
  ctx.fillStyle = abajo;
  ctx.fillRect(0, ALTO - 780, ANCHO, 780);
}

function partir(ctx: CanvasRenderingContext2D, texto: string, max: number, tope: number) {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > max && actual) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, tope);
}

/** Ajusta el cuerpo hasta que el titular quepa en tres lineas como maximo. */
function titularAjustado(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  for (const cuerpo of [62, 56, 50, 45]) {
    ctx.font = `800 ${cuerpo}px Arial, Helvetica, sans-serif`;
    const lineas = partir(ctx, texto, max, 4);
    if (lineas.length <= 3) return { cuerpo, lineas };
  }
  ctx.font = "800 45px Arial, Helvetica, sans-serif";
  return { cuerpo: 45, lineas: partir(ctx, texto, max, 3) };
}

function marca(ctx: CanvasRenderingContext2D, entrada: number) {
  ctx.save();
  ctx.globalAlpha = entrada;
  ctx.fillStyle = "#8df5bd";
  ctx.beginPath();
  ctx.arc(MARGEN + 11, SEGURO_SUP - 26, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "700 21px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillText("DESTINATION PULSE", MARGEN + 34, SEGURO_SUP - 18);
  ctx.restore();
}

function progresoEscenas(ctx: CanvasRenderingContext2D, total: number, indice: number, dentro: number) {
  const ancho = (ANCHO - MARGEN * 2 - (total - 1) * 8) / total;
  for (let i = 0; i < total; i += 1) {
    const x = MARGEN + i * (ancho + 8);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(x, SEGURO_SUP - 66, ancho, 4);
    const relleno = i < indice ? 1 : i === indice ? dentro : 0;
    if (relleno > 0) {
      ctx.fillStyle = "#8df5bd";
      ctx.fillRect(x, SEGURO_SUP - 66, ancho * relleno, 4);
    }
  }
}

function textos(ctx: CanvasRenderingContext2D, plan: PlanContenido, indice: number, dentro: number) {
  const escena = plan.escenas[indice];
  const entrada = Math.min(1, dentro * 6);
  const deslizamiento = (1 - entrada) * 26;
  const max = ANCHO - MARGEN * 2;

  ctx.save();
  ctx.globalAlpha = entrada;
  progresoEscenas(ctx, plan.escenas.length, indice, dentro);
  marca(ctx, entrada);

  const { cuerpo, lineas } = titularAjustado(ctx, escena.textoPantalla, max);
  const alturaLinea = cuerpo * 1.16;

  ctx.font = "600 26px Arial, Helvetica, sans-serif";
  const apoyo = partir(ctx, escena.locucion, max, 2);

  const bloque = lineas.length * alturaLinea + (apoyo.length ? apoyo.length * 34 + 22 : 0);
  let y = ALTO - SEGURO_INF - bloque + alturaLinea * 0.82 + deslizamiento;

  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${cuerpo}px Arial, Helvetica, sans-serif`;
  for (const linea of lineas) {
    ctx.fillText(linea, MARGEN, y);
    y += alturaLinea;
  }

  if (apoyo.length) {
    y += 12;
    ctx.font = "600 26px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.86)";
    for (const linea of apoyo) {
      ctx.fillText(linea, MARGEN, y);
      y += 34;
    }
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (indice === plan.escenas.length - 1) {
    const etiqueta = plan.cta.slice(0, 28);
    ctx.font = "800 25px Arial, Helvetica, sans-serif";
    const ancho = ctx.measureText(etiqueta).width + 56;
    const yBoton = ALTO - SEGURO_INF + 40;
    ctx.fillStyle = "#8df5bd";
    ctx.beginPath();
    ctx.roundRect(MARGEN, yBoton, ancho, 62, 31);
    ctx.fill();
    ctx.fillStyle = "#07211a";
    ctx.fillText(etiqueta, MARGEN + 28, yBoton + 40);
  }
  ctx.restore();
}

/* ──────────────────────────────── audio ──────────────────────────────── */

/**
 * Cama musical generativa: una progresion de cuatro acordes con ataque suave,
 * no un tono continuo. No es musica de biblioteca — en produccion esto seria una
 * pista de Epidemic Sound o Uppbeat — pero suena a fondo intencionado y evita
 * meter material protegido en una pieza que se va a publicar.
 */
function camaMusical(audio: AudioContext, destino: AudioNode, segundos: number, t0: number) {
  const acordes = [
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
    [146.83, 185.0, 220.0],
    [164.81, 207.65, 246.94],
  ];
  const compas = segundos / acordes.length;
  const filtro = audio.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(1300, t0);
  filtro.connect(destino);

  acordes.forEach((acorde, paso) => {
    const inicio = t0 + paso * compas;
    acorde.forEach((frecuencia, voz) => {
      const oscilador = audio.createOscillator();
      const ganancia = audio.createGain();
      oscilador.type = voz === 0 ? "sine" : "triangle";
      oscilador.frequency.setValueAtTime(frecuencia, inicio);
      ganancia.gain.setValueAtTime(0, inicio);
      ganancia.gain.linearRampToValueAtTime(voz === 0 ? 0.5 : 0.2, inicio + compas * 0.25);
      ganancia.gain.linearRampToValueAtTime(0.0001, inicio + compas * 0.98);
      oscilador.connect(ganancia).connect(filtro);
      oscilador.start(inicio);
      oscilador.stop(inicio + compas);
    });
  });

  // Pulso grave que marca el tempo sin llegar a ser percusion.
  for (let golpe = 0; golpe * 0.5 < segundos; golpe += 1) {
    const inicio = t0 + golpe * 0.5;
    const oscilador = audio.createOscillator();
    const ganancia = audio.createGain();
    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(64, inicio);
    ganancia.gain.setValueAtTime(0.34, inicio);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.26);
    oscilador.connect(ganancia).connect(destino);
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.3);
  }
}

/** Contenedores por orden de preferencia. MP4 primero: es lo que aceptan TikTok e Instagram. */
const CONTENEDORES = [
  { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', extension: "mp4" },
  { mime: 'video/mp4;codecs="avc1,mp4a.40.2"', extension: "mp4" },
  { mime: "video/mp4", extension: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mime: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mime: "video/webm", extension: "webm" },
];

export function contenedorDisponible() {
  if (typeof MediaRecorder === "undefined") return null;
  return CONTENEDORES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

/* ─────────────────────────────── montaje ─────────────────────────────── */

export async function renderizarVideo(
  plan: PlanContenido,
  activos: ActivoVisual[],
  locucion: ArrayBuffer | null,
  progreso: (valor: number) => void,
): Promise<ResultadoVideo> {
  const contenedor = contenedorDisponible();
  if (!contenedor) throw new Error("Este navegador no permite exportar vídeo.");

  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No se ha podido preparar el lienzo de vídeo.");
  ctx.textBaseline = "alphabetic";

  // Un recurso por escena; si hay menos activos que escenas, se reciclan.
  // En paralelo: en secuencia, seis clips podian tardar mas de un minuto y en
  // una demo en vivo ese minuto se nota mucho.
  let listos = 0;
  const recursos = await Promise.all(
    plan.escenas.map(async (_, i) => {
      const activo = activos.length ? activos[i % activos.length] : undefined;
      const recurso = await cargarRecurso(activo);
      listos += 1;
      progreso(Math.round((listos / plan.escenas.length) * 25));
      return recurso;
    }),
  );

  const audio = new AudioContext();
  // Este contexto se crea despues de varios await — la peticion de voz y la
  // carga de los clips — y el navegador lo abre suspendido. Mientras lo este,
  // currentTime no avanza: todo lo que se programe queda en el pasado y no
  // suena nada. Hay que reanudarlo antes de tocar el reloj.
  if (audio.state !== "running") {
    try { await audio.resume(); } catch { /* se comprueba justo despues */ }
  }

  // La voz se descodifica antes de programar nada: descodificar tarda, y si se
  // hace en medio se desplaza todo lo ya programado.
  let vozDecodificada: AudioBuffer | null = null;
  if (locucion) {
    try { vozDecodificada = await audio.decodeAudioData(locucion.slice(0)); } catch { vozDecodificada = null; }
  }

  const salida = audio.createMediaStreamDestination();
  const musica = audio.createGain();
  musica.connect(salida);
  // La musica baja cuando hay voz: si no, compiten y no se entiende ninguna.
  musica.gain.value = vozDecodificada ? 0.05 : 0.13;

  const video = canvas.captureStream(FPS);
  const pistasAudio = salida.stream.getAudioTracks();
  const mezcla = new MediaStream([...video.getVideoTracks(), ...pistasAudio]);
  if (!pistasAudio.length) {
    await audio.close();
    throw new Error("El navegador no ha dejado abrir la pista de audio. Vuelve a pulsar el botón.");
  }
  const grabador = new MediaRecorder(mezcla, {
    mimeType: contenedor.mime,
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 128_000,
  });

  const partes: BlobPart[] = [];
  grabador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const terminado = new Promise<Blob>((resolve, reject) => {
    grabador.onerror = () => reject(new Error("No se ha podido codificar el vídeo."));
    grabador.onstop = () => resolve(new Blob(partes, { type: contenedor.mime.split(";")[0] }));
  });

  grabador.start(500);

  // Se programa con el grabador ya en marcha y unos milisegundos por delante,
  // para no perder el arranque de la musica ni de la voz.
  const t0 = audio.currentTime + 0.12;
  camaMusical(audio, musica, plan.duracion, t0);
  if (vozDecodificada) {
    const voz = audio.createBufferSource();
    const ganancia = audio.createGain();
    ganancia.gain.value = 1.35;
    voz.buffer = vozDecodificada;
    voz.connect(ganancia).connect(salida);
    voz.start(t0 + 0.3);
  }

  const inicio = performance.now();
  const total = plan.duracion * 1000;

  await new Promise<void>((resolve) => {
    const cuadro = (ahora: number) => {
      const transcurrido = Math.min(total, ahora - inicio);
      const proporcion = transcurrido / total;
      const posicion = proporcion * plan.escenas.length;
      const indice = Math.min(plan.escenas.length - 1, Math.floor(posicion));
      const dentro = posicion - indice;

      ctx.fillStyle = "#07100f";
      ctx.fillRect(0, 0, ANCHO, ALTO);
      const recurso = recursos[indice];
      if (recurso) fondo(ctx, recurso, dentro);
      degradado(ctx);
      textos(ctx, plan, indice, dentro);

      progreso(25 + Math.round(proporcion * 75));
      if (transcurrido >= total) resolve();
      else requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  });

  grabador.stop();
  mezcla.getTracks().forEach((pista) => pista.stop());
  for (const recurso of recursos) {
    if (recurso?.tipo === "video") {
      recurso.elemento.pause();
      recurso.elemento.removeAttribute("src");
      recurso.elemento.load();
    }
  }
  const blob = await terminado;
  await audio.close();
  return { blob, extension: contenedor.extension, contenedor: contenedor.mime };
}
