"use client";

/* Las imágenes proceden de Wikimedia en tiempo de ejecución y se reutilizan
   en Canvas; el elemento nativo conserva exactamente la misma URL del activo. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Film, LoaderCircle, Mic, MicOff, Pause, Play, Save, Send, Sparkles } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Panel, Vacio } from "@/components/ui";
import type { ActivoVisual, PlanContenido } from "@/types";
import { contenedorDisponible, renderizarVideo } from "@/lib/video-browser";
import { OBJETIVOS_CONTENIDO } from "@/lib/content";

type FicheroVideo = { blob: Blob; url: string; extension: string };

type RespuestaContenido = {
  plan?: PlanContenido;
  activos?: ActivoVisual[];
  media?: { estado: string; fuente: string; licencia: string; videos?: number; fotos?: number; verificados?: number; descartados?: number };
  voz?: { disponible: boolean };
  modelo?: { ok: boolean; modelo: string; tokensEntrada: number | null; tokensSalida: number | null };
  error?: { code: string; message: string };
};

const CLAVE_BIBLIOTECA = "travel-intelligence-content-v1";

export default function ContentStudio({
  destinos,
  destinoSugerido,
  onSeleccionar,
}: {
  destinos: DestinoConScore[];
  destinoSugerido: string;
  onSeleccionar: (id: string) => void;
}) {
  /**
   * Producir contenido cuesta dinero y atención, así que solo se abre para las
   * cinco oportunidades de arriba. Si el radar dice que el sitio donde hay que
   * empujar es otro, la lista cambia sola: la restricción es la señal, no una
   * preferencia de quien esté delante de la pantalla.
   */
  const top5 = useMemo(
    () => [...destinos].sort((a, b) => b.oportunidad.score - a.oportunidad.score).slice(0, 5),
    [destinos],
  );
  const [destinoId, setDestinoId] = useState(
    () => (top5.some((d) => d.id === destinoSugerido) ? destinoSugerido : top5[0]?.id || ""),
  );
  const [objetivo, setObjetivo] = useState<(typeof OBJETIVOS_CONTENIDO)[number]>("Generar solicitudes de presupuesto");
  const [tono, setTono] = useState<"inspirador" | "premium" | "familiar" | "aventurero">("inspirador");
  const [duracion, setDuracion] = useState<15 | 30>(30);
  const [mezclaVisual, setMezclaVisual] = useState<"video" | "mixto" | "fotos">("video");
  const [plan, setPlan] = useState<PlanContenido | null>(null);
  const [activos, setActivos] = useState<ActivoVisual[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [escena, setEscena] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [renderizando, setRenderizando] = useState(false);
  const [video, setVideo] = useState<FicheroVideo | null>(null);
  const [medios, setMedios] = useState<{ fuente: string; videos: number; fotos: number; verificados: number; descartados: number } | null>(null);
  const [vozDisponible, setVozDisponible] = useState(false);
  const [usarVoz, setUsarVoz] = useState(true);
  const [probandoVoz, setProbandoVoz] = useState(false);
  const audioPruebaRef = useRef<HTMLAudioElement | null>(null);
  const motivoVozRef = useRef<string | null>(null);
  const [consentimiento, setConsentimiento] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [guardados, setGuardados] = useState<PlanContenido[]>([]);
  const videoRef = useRef<FicheroVideo | null>(null);

  useEffect(() => {
    const reloj = window.setTimeout(() => {
      try { setGuardados(JSON.parse(localStorage.getItem(CLAVE_BIBLIOTECA) ?? "[]") as PlanContenido[]); } catch { setGuardados([]); }
    }, 0);
    return () => window.clearTimeout(reloj);
  }, []);

  useEffect(() => {
    videoRef.current = video;
    return () => { if (videoRef.current?.url) URL.revokeObjectURL(videoRef.current.url); };
  }, [video]);

  useEffect(() => {
    if (!reproduciendo || !plan) return;
    const ms = (plan.duracion * 1000) / plan.escenas.length;
    const reloj = window.setInterval(() => setEscena((actual) => (actual + 1) % plan.escenas.length), ms);
    return () => window.clearInterval(reloj);
  }, [reproduciendo, plan]);

  const destino = useMemo(() => top5.find((d) => d.id === destinoId) ?? top5[0], [top5, destinoId]);
  const fueraDelTop = useMemo(
    () => destinos.find((d) => d.id === destinoSugerido && !top5.some((t) => t.id === d.id)),
    [destinos, destinoSugerido, top5],
  );
  const activoVisual = activos[escena % Math.max(1, activos.length)];

  async function generar() {
    if (!destino) return;
    setCargando(true); setMensaje(null); setPlan(null); setActivos([]); setEscena(0); setReproduciendo(false);
    if (video?.url) URL.revokeObjectURL(video.url);
    setVideo(null);
    try {
      const r = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: destino.id, objective: objetivo, tone: tono, duration: duracion, visualMix: mezclaVisual }),
      });
      const datos = (await r.json()) as RespuestaContenido;
      if (!r.ok || !datos.plan) throw new Error(datos.error?.message ?? "No se ha podido generar el contenido.");
      setPlan(datos.plan); setActivos(datos.activos ?? []); setReproduciendo(true);
      setVozDisponible(Boolean(datos.voz?.disponible));
      setMedios(datos.media ? {
        fuente: datos.media.fuente,
        videos: datos.media.videos ?? 0,
        fotos: datos.media.fotos ?? 0,
        verificados: datos.media.verificados ?? 0,
        descartados: datos.media.descartados ?? 0,
      } : null);
      const descartados = datos.media?.descartados ?? 0;
      setMensaje(
        !datos.activos?.length
          ? "Guion preparado. El banco no devolvió material para este destino y la pieza saldrá con dirección de arte de marca."
          : `Guion listo · ${datos.media?.verificados ?? 0} de ${datos.activos.length} activos confirmados como del destino` +
            (descartados ? ` · ${descartados} descartados por ser de otro sitio` : "") +
            (datos.plan.modo === "fallback-verificado" ? " · ATENCIÓN: guion de respaldo, el modelo no respondió" : ""),
      );
    } catch (e) { setMensaje(e instanceof Error ? e.message : "No se ha podido generar el contenido."); }
    finally { setCargando(false); }
  }

  /** Pide la locución. Si falla, la pieza se genera igual con la cama musical. */
  async function pedirLocucion(actual: PlanContenido): Promise<ArrayBuffer | null> {
    motivoVozRef.current = null;
    if (!usarVoz || !vozDisponible) return null;
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locuciones: actual.escenas.map((e) => e.locucion), duracion: actual.duracion, voz: actual.voz }),
      });
      if (!r.ok) {
        const detalle = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(detalle?.error?.message ?? `La síntesis de voz respondió ${r.status}.`);
      }
      return await r.arrayBuffer();
    } catch (e) {
      motivoVozRef.current = e instanceof Error ? e.message : "No se ha podido generar la locución.";
      return null;
    }
  }

  /** Escucha la locución suelta. Sirve para separar un fallo de voz de uno de mezcla. */
  async function escucharLocucion() {
    if (!plan) return;
    setProbandoVoz(true); setMensaje(null);
    try {
      const bytes = await pedirLocucion(plan);
      if (!bytes) throw new Error(motivoVozRef.current ?? "La síntesis de voz no ha devuelto audio.");
      audioPruebaRef.current?.pause();
      if (audioPruebaRef.current?.src) URL.revokeObjectURL(audioPruebaRef.current.src);
      const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" })));
      audioPruebaRef.current = audio;
      await audio.play();
      setMensaje("Reproduciendo la locución. Si la oyes aquí, la voz funciona y el problema sería la mezcla.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se ha podido reproducir la locución.");
    } finally { setProbandoVoz(false); }
  }

  async function crearVideo(descargar: boolean) {
    if (!plan) throw new Error("Genera primero la pieza creativa.");
    setRenderizando(true); setProgreso(0);
    setMensaje(usarVoz && vozDisponible ? "Grabando la locución…" : "Montando el vídeo vertical…");
    try {
      const locucion = await pedirLocucion(plan);
      setMensaje("Montando el vídeo vertical en tu navegador…");
      const resultado = await renderizarVideo(plan, activos, locucion, setProgreso);
      if (video?.url) URL.revokeObjectURL(video.url);
      const url = URL.createObjectURL(resultado.blob);
      setVideo({ blob: resultado.blob, url, extension: resultado.extension });
      setMensaje(
        `Vídeo 9:16 en ${resultado.extension.toUpperCase()} listo${locucion ? " con locución" : ` sin locución${motivoVozRef.current ? ` (${motivoVozRef.current})` : ""}`}. ` +
        (resultado.extension === "webm" ? "Este navegador no graba MP4: para publicar, conviértelo o usa Chrome." : "Ya se puede subir a TikTok o Instagram."),
      );
      if (descargar) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${plan.destino.toLowerCase().replace(/\s+/g, "-")}-vertical.${resultado.extension}`;
        a.click();
      }
      return resultado.blob;
    } finally { setRenderizando(false); }
  }

  function guardar() {
    if (!plan) return;
    const siguientes = [plan, ...guardados.filter((p) => p.creadoEn !== plan.creadoEn)].slice(0, 20);
    localStorage.setItem(CLAVE_BIBLIOTECA, JSON.stringify(siguientes));
    setGuardados(siguientes); setMensaje("Campaña guardada en la biblioteca local.");
  }

  async function publicarTikTok() {
    if (!plan || !consentimiento) return;
    setPublicando(true); setMensaje(null);
    try {
      const blob = video?.blob ?? await crearVideo(false);
      const init = await fetch("/api/tiktok", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize", size: blob.size, mime: video?.extension === "webm" ? "video/webm" : "video/mp4" }),
      });
      const datos = (await init.json()) as { publishId?: string; uploadUrl?: string; error?: { code: string; message: string } };
      if (!init.ok || !datos.uploadUrl) throw new Error(datos.error?.message ?? "TikTok no ha iniciado el envío.");
      const subida = await fetch(datos.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": video?.extension === "webm" ? "video/webm" : "video/mp4", "Content-Length": String(blob.size), "Content-Range": `bytes 0-${blob.size - 1}/${blob.size}` },
        body: blob,
      });
      if (!subida.ok && subida.status !== 206) throw new Error("TikTok no ha completado la subida.");
      setMensaje("Vídeo enviado a TikTok. Abre la notificación de TikTok para revisarlo, añadir audio y completar la publicación.");
    } catch (e) { setMensaje(e instanceof Error ? e.message : "No se ha podido publicar en TikTok."); }
    finally { setPublicando(false); }
  }

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden p-5" style={{ background: "linear-gradient(120deg,rgba(22,61,49,.98),rgba(9,23,20,.92))" }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <span className="pill pill-green"><Sparkles size={12} /> CONTENT STUDIO</span>
            <h2 className="mt-3 text-[25px] leading-tight">Crea contenido solo para las cinco oportunidades prioritarias.</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">Menos destinos, mejor material y una demo más fiable.</p>
          </div>
          {destino ? <div className="subpanel px-4 py-3 text-right"><span className="block text-[10px] text-[var(--dim)]">OPORTUNIDAD SELECCIONADA</span><b className="text-[18px] text-[var(--green)]">{destino.destino} · {destino.oportunidad.score}</b></div> : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel titulo="Brief guiado · top 5">
          <div className="space-y-4">
            <label className="block text-[11px] text-[var(--muted)]">Destino
              <select className="field mt-1.5" value={destinoId} onChange={(e) => { setDestinoId(e.target.value); onSeleccionar(e.target.value); }}>
                {top5.map((d, i) => <option key={d.id} value={d.id}>{i + 1}. {d.destino} · score {d.oportunidad.score}</option>)}
              </select>
              <span className="mt-1.5 block text-[10px] leading-relaxed text-[var(--dim)]">
                Solo las cinco primeras oportunidades del radar. Producir contenido para un destino
                que nadie está buscando es el gasto que la agencia ya tiene.
              </span>
            </label>
            {fueraDelTop ? (
              <p className="text-[10px] leading-relaxed text-[var(--amber,#FF9868)]">
                {fueraDelTop.destino} está en el puesto {destinos.filter((d) => d.oportunidad.score > fueraDelTop.oportunidad.score).length + 1} del radar,
                así que no se puede producir contenido para él todavía.
              </p>
            ) : null}
            <label className="block text-[11px] text-[var(--muted)]">Objetivo
              <select className="field mt-1.5" value={objetivo} onChange={(e) => setObjetivo(e.target.value as typeof objetivo)}>
                {OBJETIVOS_CONTENIDO.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
              <span className="mt-1.5 block text-[10px] leading-relaxed text-[var(--dim)]">
                {objetivo === "Generar solicitudes de presupuesto"
                  ? "Respuesta directa: ritmo rápido, se puede citar el precio y el cierre pide escribir."
                  : "Marca: ritmo pausado, sin precio y con un cierre que invita en vez de pedir."}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] text-[var(--muted)]">Tono
                <select className="field mt-1.5" value={tono} onChange={(e) => setTono(e.target.value as typeof tono)}>
                  <option value="inspirador">Inspirador</option><option value="premium">Premium</option><option value="familiar">Familiar</option><option value="aventurero">Aventurero</option>
                </select>
              </label>
              <label className="block text-[11px] text-[var(--muted)]">Duración
                <select className="field mt-1.5" value={duracion} onChange={(e) => setDuracion(Number(e.target.value) as 15 | 30)}>
                  <option value={15}>15 segundos</option><option value={30}>30 segundos</option>
                </select>
              </label>
            </div>
            <label className="block text-[11px] text-[var(--muted)]">Material audiovisual
              <select className="field mt-1.5" value={mezclaVisual} onChange={(e) => setMezclaVisual(e.target.value as typeof mezclaVisual)}>
                <option value="video">Varios clips de vídeo cortos</option>
                <option value="mixto">Clips de vídeo y fotografías</option>
                <option value="fotos">Varias fotografías con movimiento</option>
              </select>
            </label>
            {plan ? (
              <div className="subpanel p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[11px]">
                    {usarVoz && vozDisponible ? <Mic size={13} className="text-[var(--green)]" /> : <MicOff size={13} className="text-[var(--dim)]" />}
                    <b>Locución</b>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost px-2.5 py-1 text-[10px]"
                    disabled={!vozDisponible}
                    onClick={() => setUsarVoz(!usarVoz)}
                  >
                    {!vozDisponible ? "No configurada" : usarVoz ? "Activada" : "Desactivada"}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--dim)]">
                  {vozDisponible
                    ? "Voz en español sobre la cama musical. Lee el guion verificado, no añade nada."
                    : "Falta la clave de síntesis de voz. La pieza sale con música y rótulos."}
                </p>
                {vozDisponible ? (
                  <button type="button" className="btn btn-ghost mt-2 w-full py-1.5 text-[10px]" disabled={probandoVoz} onClick={escucharLocucion}>
                    {probandoVoz ? <LoaderCircle size={12} className="mr-1.5 inline animate-spin" /> : <Play size={12} className="mr-1.5 inline" />}
                    Escuchar solo la locución
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="button" className="btn btn-primary w-full" disabled={cargando} onClick={generar}>
              {cargando ? <LoaderCircle size={15} className="mr-2 inline animate-spin" /> : <Sparkles size={15} className="mr-2 inline" />}
              {cargando ? "Analizando señales y creando…" : "Generar campaña vertical"}
            </button>
            <p className="text-[10px] leading-relaxed text-[var(--dim)]">No se generan datos del destino: el modelo solo redacta sobre la ficha seleccionada. Revisión humana obligatoria.</p>
          </div>
        </Panel>

        <Panel titulo="Previsualización 9:16" extra={plan ? <span className="pill pill-line">{plan.modo === "live-ai" ? "LIVE AI" : "FALLBACK VERIFICADO"}</span> : null}>
          {!plan ? <Vacio mensaje="Configura el brief y genera la pieza. Aquí aparecerán el vídeo, el guion y las acciones de publicación." /> : (
            <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
              <div className="mx-auto w-full max-w-[270px]">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--line-strong)", background: "linear-gradient(160deg,#173d32,#07100f)" }}>
                  {video ? <video src={video.url} controls playsInline className="h-full w-full object-cover" /> : (
                    <>
                      {activoVisual?.tipo === "video" ? (
                        <video key={activoVisual.id} src={activoVisual.url} poster={activoVisual.miniatura} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                      ) : activoVisual ? <img src={activoVisual.miniatura} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.1) 40%,rgba(0,0,0,.9))" }} />
                      <div className="absolute left-4 top-4 text-[8px] font-black tracking-[.12em] text-[var(--green)]">DESTINATION PULSE</div>
                      <div className="absolute inset-x-4 bottom-14"><b className="block text-[26px] leading-tight">{plan.escenas[escena]?.textoPantalla}</b></div>
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between"><span className="text-[9px]">{escena + 1}/{plan.escenas.length}</span><button type="button" aria-label={reproduciendo ? "Pausar" : "Reproducir"} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--green)] text-[#092116]" onClick={() => setReproduciendo(!reproduciendo)}>{reproduciendo ? <Pause size={14} /> : <Play size={14} />}</button></div>
                    </>
                  )}
                </div>
                <p className="mt-2 text-center text-[9px] text-[var(--dim)]">Se exporta en {(contenedorDisponible()?.extension ?? "webm").toUpperCase()} · 720×1280 · {plan.duracion} s</p>
                {renderizando ? <div className="mt-3"><div className="bar"><i style={{ width: `${progreso}%` }} /></div><p className="mt-1 text-center text-[10px] text-[var(--dim)]">Renderizando {progreso}% · dura {plan.duracion} segundos</p></div> : null}
              </div>

              <div className="min-w-0 space-y-4">
                <div><span className="text-[10px] font-bold tracking-[.12em] text-[var(--dim)]">CONCEPTO</span><h3 className="mt-1 text-[18px]">{plan.concepto}</h3><p className="mt-2 text-[13px] text-[var(--green)]">{plan.hook}</p></div>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {plan.escenas.map((e, i) => <li key={`${e.titulo}-${i}`}><button type="button" onClick={() => { setEscena(i); setReproduciendo(false); }} className="subpanel h-full w-full p-3 text-left" style={{ borderColor: escena === i ? "var(--line-strong)" : undefined }}><span className="text-[9px] text-[var(--dim)]">ESCENA {i + 1}</span><b className="mt-1 block text-[12px]">{e.textoPantalla}</b><span className="mt-1 block text-[10px] leading-relaxed text-[var(--muted)]">{e.locucion}</span></button></li>)}
                </ol>
                {plan.advertencias.length > 1 ? (
                  <ul className="subpanel space-y-1 p-3 text-[10px] leading-relaxed text-[var(--dim)]">
                    {plan.advertencias.map((a) => <li key={a}>· {a}</li>)}
                  </ul>
                ) : null}
                <div className="subpanel p-3"><div className="flex items-start justify-between gap-3"><p className="text-[12px] leading-relaxed">{plan.caption}<br/><span className="text-[var(--green)]">{plan.hashtags.join(" ")}</span></p><button type="button" className="btn btn-ghost p-2" aria-label="Copiar texto" onClick={() => { void navigator.clipboard.writeText(`${plan.caption}\n${plan.hashtags.join(" ")}`); setMensaje("Texto copiado."); }}><Copy size={14}/></button></div></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" disabled={renderizando} onClick={() => void crearVideo(true)}><Download size={14} className="mr-1.5 inline" />Generar y descargar vídeo</button>
                  <button type="button" className="btn btn-ghost" onClick={guardar}><Save size={14} className="mr-1.5 inline" />Guardar</button>
                </div>
                <div className="subpanel p-4">
                  <div className="flex items-center gap-2"><Film size={15} className="text-[var(--green)]"/><b className="text-[13px]">Publicación social</b></div>
                  <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--muted)]"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-0.5"/>Confirmo que he revisado el vídeo y autorizo expresamente su envío a mi cuenta de TikTok.</label>
                  <button type="button" className="btn btn-primary mt-3 w-full" disabled={!consentimiento || publicando || renderizando} onClick={publicarTikTok}>{publicando ? <LoaderCircle size={14} className="mr-1.5 inline animate-spin"/> : <Send size={14} className="mr-1.5 inline"/>}Publicar en TikTok</button>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--dim)]">Cama sonora original generada por la plataforma{usarVoz && vozDisponible ? " y locución sintética" : ""}. Se envía como borrador: TikTok notifica al creador para revisar, cambiar el audio si quiere y completar la publicación.</p>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {mensaje ? <div className="subpanel flex items-center gap-2 px-4 py-3 text-[12px]"><Check size={14} className="shrink-0 text-[var(--green)]"/>{mensaje}</div> : null}

      {activos.length ? <Panel titulo={`Material audiovisual · ${activos.filter((a) => a.tipo === "video").length} vídeos · ${activos.filter((a) => a.tipo === "imagen").length} imágenes`} extra={medios ? (
        <span className="flex items-center gap-2">
          <span className="pill pill-line">{medios.fuente.toUpperCase()}</span>
          <span className="pill pill-green">{medios.verificados} VERIFICADOS</span>
          {medios.descartados ? <span className="pill pill-line">{medios.descartados} DESCARTADOS</span> : null}
        </span>
      ) : null}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{activos.slice(0,6).map((a) => <a key={a.id} href={a.paginaFuente} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>{a.tipo === "video" ? <video src={a.url} poster={a.miniatura} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)} onMouseLeave={(e) => e.currentTarget.pause()} className="aspect-[9/16] w-full object-cover"/> : <img src={a.miniatura} alt={a.titulo} className="aspect-[9/16] w-full object-cover"/>}{a.tipo === "video" ? <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[8px] font-black tracking-[.1em] text-white">VÍDEO</span> : null}{medios && activos.indexOf(a) >= medios.verificados ? <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[8px] font-black tracking-[.1em]" style={{ color: "#FF9868" }} title="No hemos podido confirmar que sea de este destino">GENÉRICO</span> : null}<span className="block p-2 text-[9px] leading-relaxed text-[var(--dim)]">{a.licencia} · {a.autor.slice(0,55)} <ExternalLink size={9} className="inline"/></span></a>)}</div></Panel> : null}

      {guardados.length ? <Panel titulo={`Biblioteca de campañas · ${guardados.length}`}><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{guardados.slice(0,8).map((p) => <button type="button" key={p.creadoEn} className="subpanel p-3 text-left" onClick={() => { setPlan(p); setDestinoId(p.destinoId); setEscena(0); setVideo(null); }}><span className="text-[9px] text-[var(--dim)]">{new Date(p.creadoEn).toLocaleDateString("es-ES")}</span><b className="mt-1 block text-[13px]">{p.destino}</b><span className="mt-1 block text-[10px] text-[var(--muted)]">{p.concepto}</span></button>)}</div></Panel> : null}
    </div>
  );
}

