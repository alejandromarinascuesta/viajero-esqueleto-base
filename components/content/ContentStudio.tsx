"use client";

/* Las imágenes proceden de Wikimedia en tiempo de ejecución y se reutilizan
   en Canvas; el elemento nativo conserva exactamente la misma URL del activo. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Film, LoaderCircle, Pause, Play, Save, Send, Sparkles } from "lucide-react";
import type { DestinoConScore } from "@/components/layout/Shell";
import { Panel, Vacio } from "@/components/ui";
import type { ActivoVisual, PlanContenido } from "@/types";
import { renderizarVideoWebM } from "@/lib/video-browser";
import { AUDIENCIAS_CONTENIDO, OBJETIVOS_CONTENIDO } from "@/lib/content";

type RespuestaContenido = {
  plan?: PlanContenido;
  activos?: ActivoVisual[];
  media?: { estado: string; fuente: string; licencia: string };
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
  const [destinoId, setDestinoId] = useState(
    () => destinos.some((d) => d.id === destinoSugerido) ? destinoSugerido : destinos[0]?.id || "",
  );
  const [audiencia, setAudiencia] = useState<(typeof AUDIENCIAS_CONTENIDO)[number]>("Parejas de 30 a 45 años");
  const [objetivo, setObjetivo] = useState("Generar solicitudes de presupuesto");
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
  const [video, setVideo] = useState<{ blob: Blob; url: string } | null>(null);
  const [consentimiento, setConsentimiento] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [guardados, setGuardados] = useState<PlanContenido[]>([]);
  const videoRef = useRef<{ blob: Blob; url: string } | null>(null);

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

  const destino = useMemo(() => destinos.find((d) => d.id === destinoId) ?? destinos[0], [destinos, destinoId]);
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
        body: JSON.stringify({ destinationId: destino.id, audience: audiencia, objective: objetivo, tone: tono, duration: duracion, visualMix: mezclaVisual }),
      });
      const datos = (await r.json()) as RespuestaContenido;
      if (!r.ok || !datos.plan) throw new Error(datos.error?.message ?? "No se ha podido generar el contenido.");
      setPlan(datos.plan); setActivos(datos.activos ?? []); setReproduciendo(true);
      setMensaje(datos.activos?.length ? "Guion y material visual preparados." : "Guion preparado. Wikimedia no devolvió imágenes y el vídeo usará dirección de arte de marca.");
    } catch (e) { setMensaje(e instanceof Error ? e.message : "No se ha podido generar el contenido."); }
    finally { setCargando(false); }
  }

  async function crearVideo(descargar: boolean) {
    if (!plan) throw new Error("Genera primero la pieza creativa.");
    setRenderizando(true); setProgreso(0); setMensaje("Renderizando el vídeo vertical en tu navegador…");
    try {
      const blob = await renderizarVideoWebM(plan, activos, setProgreso);
      if (video?.url) URL.revokeObjectURL(video.url);
      const url = URL.createObjectURL(blob);
      setVideo({ blob, url });
      setMensaje("Vídeo 9:16 generado. Ya puedes descargarlo o enviarlo a TikTok.");
      if (descargar) {
        const a = document.createElement("a");
        a.href = url; a.download = `${plan.destino.toLowerCase().replace(/\s+/g, "-")}-vertical.webm`; a.click();
      }
      return blob;
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
        body: JSON.stringify({ action: "initialize", size: blob.size, mime: "video/webm" }),
      });
      const datos = (await init.json()) as { publishId?: string; uploadUrl?: string; error?: { code: string; message: string } };
      if (!init.ok || !datos.uploadUrl) throw new Error(datos.error?.message ?? "TikTok no ha iniciado el envío.");
      const subida = await fetch(datos.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/webm", "Content-Length": String(blob.size), "Content-Range": `bytes 0-${blob.size - 1}/${blob.size}` },
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
                {[...destinos].sort((a,b) => b.oportunidad.score - a.oportunidad.score).map((d) => <option key={d.id} value={d.id}>{d.destino} · score {d.oportunidad.score}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--muted)]">Audiencia
              <select className="field mt-1.5" value={audiencia} onChange={(e) => setAudiencia(e.target.value as typeof audiencia)}>
                {AUDIENCIAS_CONTENIDO.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--muted)]">Objetivo
              <select className="field mt-1.5" value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>
                {OBJETIVOS_CONTENIDO.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
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
            <button type="button" className="btn btn-primary w-full" disabled={cargando || !audiencia.trim() || !objetivo.trim()} onClick={generar}>
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
                      <div className="absolute inset-x-4 bottom-14"><b className="block text-[24px] leading-tight">{plan.escenas[escena]?.textoPantalla}</b><span className="mt-2 block text-[11px] leading-relaxed text-white/80">{plan.escenas[escena]?.locucion}</span></div>
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between"><span className="text-[9px]">{escena + 1}/{plan.escenas.length}</span><button type="button" aria-label={reproduciendo ? "Pausar" : "Reproducir"} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--green)] text-[#092116]" onClick={() => setReproduciendo(!reproduciendo)}>{reproduciendo ? <Pause size={14} /> : <Play size={14} />}</button></div>
                    </>
                  )}
                </div>
                {renderizando ? <div className="mt-3"><div className="bar"><i style={{ width: `${progreso}%` }} /></div><p className="mt-1 text-center text-[10px] text-[var(--dim)]">Renderizando {progreso}% · dura {plan.duracion} segundos</p></div> : null}
              </div>

              <div className="min-w-0 space-y-4">
                <div><span className="text-[10px] font-bold tracking-[.12em] text-[var(--dim)]">CONCEPTO</span><h3 className="mt-1 text-[18px]">{plan.concepto}</h3><p className="mt-2 text-[13px] text-[var(--green)]">{plan.hook}</p></div>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {plan.escenas.map((e, i) => <li key={`${e.titulo}-${i}`}><button type="button" onClick={() => { setEscena(i); setReproduciendo(false); }} className="subpanel h-full w-full p-3 text-left" style={{ borderColor: escena === i ? "var(--line-strong)" : undefined }}><span className="text-[9px] text-[var(--dim)]">ESCENA {i + 1}</span><b className="mt-1 block text-[12px]">{e.textoPantalla}</b><span className="mt-1 block text-[10px] leading-relaxed text-[var(--muted)]">{e.locucion}</span></button></li>)}
                </ol>
                <div className="subpanel p-3"><div className="flex items-start justify-between gap-3"><p className="text-[12px] leading-relaxed">{plan.caption}<br/><span className="text-[var(--green)]">{plan.hashtags.join(" ")}</span></p><button type="button" className="btn btn-ghost p-2" aria-label="Copiar texto" onClick={() => { void navigator.clipboard.writeText(`${plan.caption}\n${plan.hashtags.join(" ")}`); setMensaje("Texto copiado."); }}><Copy size={14}/></button></div></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" disabled={renderizando} onClick={() => void crearVideo(true)}><Download size={14} className="mr-1.5 inline" />Generar y descargar vídeo</button>
                  <button type="button" className="btn btn-ghost" onClick={guardar}><Save size={14} className="mr-1.5 inline" />Guardar</button>
                </div>
                <div className="subpanel p-4">
                  <div className="flex items-center gap-2"><Film size={15} className="text-[var(--green)]"/><b className="text-[13px]">Publicación social</b></div>
                  <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--muted)]"><input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-0.5"/>Confirmo que he revisado el vídeo y autorizo expresamente su envío a mi cuenta de TikTok.</label>
                  <button type="button" className="btn btn-primary mt-3 w-full" disabled={!consentimiento || publicando || renderizando} onClick={publicarTikTok}>{publicando ? <LoaderCircle size={14} className="mr-1.5 inline animate-spin"/> : <Send size={14} className="mr-1.5 inline"/>}Publicar en TikTok</button>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--dim)]">Incluye una cama sonora original. Se envía como borrador: TikTok notificará al creador para cambiar el audio, revisar y completar la publicación.</p>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {mensaje ? <div className="subpanel flex items-center gap-2 px-4 py-3 text-[12px]"><Check size={14} className="shrink-0 text-[var(--green)]"/>{mensaje}</div> : null}

      {activos.length ? <Panel titulo={`Material audiovisual · ${activos.filter((a) => a.tipo === "video").length} vídeos · ${activos.filter((a) => a.tipo === "imagen").length} imágenes de respaldo`}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">{activos.slice(0,6).map((a) => <a key={a.id} href={a.paginaFuente} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>{a.tipo === "video" ? <video src={a.url} poster={a.miniatura} muted playsInline preload="metadata" className="aspect-[4/3] w-full object-cover"/> : <img src={a.miniatura} alt={a.titulo} className="aspect-[4/3] w-full object-cover"/>}{a.tipo === "video" ? <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[8px] font-black tracking-[.1em] text-white">VÍDEO</span> : null}<span className="block p-2 text-[9px] leading-relaxed text-[var(--dim)]">{a.licencia} · {a.autor.slice(0,55)} <ExternalLink size={9} className="inline"/></span></a>)}</div></Panel> : null}

      {guardados.length ? <Panel titulo={`Biblioteca de campañas · ${guardados.length}`}><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{guardados.slice(0,8).map((p) => <button type="button" key={p.creadoEn} className="subpanel p-3 text-left" onClick={() => { setPlan(p); setDestinoId(p.destinoId); setEscena(0); setVideo(null); }}><span className="text-[9px] text-[var(--dim)]">{new Date(p.creadoEn).toLocaleDateString("es-ES")}</span><b className="mt-1 block text-[13px]">{p.destino}</b><span className="mt-1 block text-[10px] text-[var(--muted)]">{p.concepto}</span></button>)}</div></Panel> : null}
    </div>
  );
}

