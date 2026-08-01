import type { ActivoVisual, PlanContenido } from "@/types";

const ANCHO = 720;
const ALTO = 1280;
const FPS = 24;

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `/api/media-proxy?url=${encodeURIComponent(url)}`;
  });
}

type RecursoVisual = { tipo: "imagen"; elemento: HTMLImageElement } | { tipo: "video"; elemento: HTMLVideoElement };

function cargarVideo(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const reloj = window.setTimeout(() => resolve(null), 10_000);
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      window.clearTimeout(reloj);
      void video.play().catch(() => undefined);
      resolve(video);
    };
    video.onerror = () => { window.clearTimeout(reloj); resolve(null); };
    video.src = url;
    video.load();
  });
}

async function cargarRecurso(activo: ActivoVisual): Promise<RecursoVisual | null> {
  if (activo.tipo === "video") {
    const video = await cargarVideo(activo.url);
    if (video) return { tipo: "video", elemento: video };
    const respaldo = await cargarImagen(activo.miniatura);
    return respaldo ? { tipo: "imagen", elemento: respaldo } : null;
  }
  const imagen = await cargarImagen(activo.url);
  return imagen ? { tipo: "imagen", elemento: imagen } : null;
}

function portada(ctx: CanvasRenderingContext2D, recurso: RecursoVisual, progreso: number) {
  const ancho = recurso.tipo === "video" ? recurso.elemento.videoWidth : recurso.elemento.naturalWidth;
  const alto = recurso.tipo === "video" ? recurso.elemento.videoHeight : recurso.elemento.naturalHeight;
  if (!ancho || !alto) return;
  const escalaBase = Math.max(ANCHO / ancho, ALTO / alto);
  const escala = escalaBase * (1.02 + progreso * 0.09);
  const w = ancho * escala;
  const h = alto * escala;
  const x = (ANCHO - w) / 2 - progreso * 16;
  const y = (ALTO - h) / 2 - progreso * 10;
  ctx.drawImage(recurso.elemento, x, y, w, h);
}

function lineas(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  const palabras = texto.split(/\s+/);
  const resultado: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const siguiente = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(siguiente).width > max && actual) {
      resultado.push(actual);
      actual = palabra;
    } else actual = siguiente;
  }
  if (actual) resultado.push(actual);
  return resultado.slice(0, 4);
}

function dibujarTexto(ctx: CanvasRenderingContext2D, plan: PlanContenido, escena: number, progreso: number) {
  const datos = plan.escenas[escena];
  const entrada = Math.min(1, progreso * 5);
  ctx.save();
  ctx.globalAlpha = entrada;
  ctx.fillStyle = "#8df5bd";
  ctx.font = "700 22px Arial";
  ctx.fillText("DESTINATION PULSE", 54, 74);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px Arial";
  const trozos = lineas(ctx, datos.textoPantalla, ANCHO - 108);
  const inicio = 835 - Math.max(0, trozos.length - 2) * 64;
  trozos.forEach((linea, i) => ctx.fillText(linea, 54, inicio + i * 68));
  ctx.font = "500 28px Arial";
  ctx.fillStyle = "rgba(255,255,255,.88)";
  const locucion = lineas(ctx, datos.locucion, ANCHO - 108).slice(0, 3);
  locucion.forEach((linea, i) => ctx.fillText(linea, 54, inicio + trozos.length * 68 + 34 + i * 38));
  if (escena === plan.escenas.length - 1) {
    ctx.fillStyle = "#8df5bd";
    ctx.fillRect(54, 1150, 310, 66);
    ctx.fillStyle = "#092116";
    ctx.font = "800 24px Arial";
    ctx.fillText(plan.cta.slice(0, 26), 76, 1192);
  }
  ctx.restore();
}

export async function renderizarVideoWebM(
  plan: PlanContenido,
  activos: ActivoVisual[],
  progreso: (valor: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") throw new Error("Este navegador no permite exportar vídeo.");
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se ha podido preparar el lienzo de vídeo.");
  const recursos = await Promise.all(activos.slice(0, plan.escenas.length).map(cargarRecurso));
  const stream = canvas.captureStream(FPS);
  // Cama sonora original y generativa: evita material protegido y hace que el
  // fichero exportado sea audiovisual incluso sin contratar un proveedor TTS.
  const audio = new AudioContext();
  const salidaAudio = audio.createMediaStreamDestination();
  const master = audio.createGain();
  master.gain.setValueAtTime(0.035, audio.currentTime);
  master.connect(salidaAudio);
  const osciladores = [220, 277.18, 329.63].map((frecuencia, indice) => {
    const oscilador = audio.createOscillator();
    const ganancia = audio.createGain();
    oscilador.type = indice === 0 ? "sine" : "triangle";
    oscilador.frequency.setValueAtTime(frecuencia, audio.currentTime);
    ganancia.gain.setValueAtTime(indice === 0 ? 0.55 : 0.18, audio.currentTime);
    oscilador.connect(ganancia).connect(master);
    oscilador.start();
    oscilador.stop(audio.currentTime + plan.duracion + 0.2);
    return oscilador;
  });
  const streamFinal = new MediaStream([...stream.getVideoTracks(), ...salidaAudio.stream.getAudioTracks()]);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((tipo) => MediaRecorder.isTypeSupported(tipo));
  if (!mime) throw new Error("El navegador no admite exportación WebM.");
  const recorder = new MediaRecorder(streamFinal, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
  const partes: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const final = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("No se ha podido codificar el vídeo."));
    recorder.onstop = () => resolve(new Blob(partes, { type: "video/webm" }));
  });
  recorder.start(1000);
  const inicio = performance.now();
  const duracionMs = plan.duracion * 1000;
  await new Promise<void>((resolve) => {
    const frame = (ahora: number) => {
      const transcurrido = Math.min(duracionMs, ahora - inicio);
      const total = transcurrido / duracionMs;
      const posicion = total * plan.escenas.length;
      const indice = Math.min(plan.escenas.length - 1, Math.floor(posicion));
      const dentro = posicion - indice;
      const recurso = recursos[indice % Math.max(1, recursos.length)] ?? null;
      const gradiente = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
      gradiente.addColorStop(0, indice % 2 ? "#102b25" : "#173d32");
      gradiente.addColorStop(1, "#07100f");
      ctx.fillStyle = gradiente;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      if (recurso) portada(ctx, recurso, dentro);
      const sombra = ctx.createLinearGradient(0, 300, 0, ALTO);
      sombra.addColorStop(0, "rgba(0,0,0,.05)");
      sombra.addColorStop(.55, "rgba(0,0,0,.25)");
      sombra.addColorStop(1, "rgba(0,0,0,.92)");
      ctx.fillStyle = sombra;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      dibujarTexto(ctx, plan, indice, dentro);
      progreso(Math.round(total * 100));
      if (transcurrido >= duracionMs) resolve(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  streamFinal.getTracks().forEach((track) => track.stop());
  recursos.forEach((recurso) => {
    if (recurso?.tipo === "video") {
      recurso.elemento.pause();
      recurso.elemento.removeAttribute("src");
      recurso.elemento.load();
    }
  });
  osciladores.forEach((oscilador) => { try { oscilador.disconnect(); } catch { /* ya detenido */ } });
  const blob = await final;
  await audio.close();
  return blob;
}

