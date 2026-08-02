"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel, Vacio } from "@/components/ui";
import type { Recomendacion } from "@/types";

type Argumento = { id: string; argumento: string[]; camposCitados: string[]; verificado: boolean; motivo: string | null };
type Conversion = {
  id: string;
  probabilidad: number;
  base: number;
  ajustes: { nombre: string; factor: number; porque: string }[];
  empirica: boolean;
  observaciones: number;
  explicacion: string;
};

type Respuesta = {
  modo: string;
  recomendacionId?: number | null;
  conversiones?: Conversion[];
  mensaje?: string;
  resultado?: Recomendacion;
  argumentos?: Argumento[];
  perfilExtraido?: {
    adultos: number | null; ninos: number[]; presupuesto_total: number | null; mes: number | null;
    dias: number | null; motivacion: string | null; tension: string | null;
    no_consta: string[]; literales: Record<string, string>;
  };
  traza?: Record<string, unknown>;
};

const EJEMPLOS = [
  "Pareja de 45 con dos niños de 5 y 8. Unos 3.500 en total, primera quincena de agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.",
  "Matrimonio jubilado, ella con problemas de rodilla, no puede con cuestas. 3.000 los dos, mayo, ocho días. Les gusta la cultura.",
  "Familia con un niño de 2 y otro de 6. Tienen 8.000 y quieren la Riviera Maya en julio. Diez días.",
];

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const RESTRICCIONES = ["movilidad reducida", "no vuelos largos", "presupuesto ajustado"];

function Campo({ etiqueta, id, ayuda, children }: { etiqueta: string; id: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] text-[var(--dim)]">
        {etiqueta}
      </label>
      {children}
      {ayuda ? <span className="mt-1 block text-[10px] text-[var(--dim)]">{ayuda}</span> : null}
    </div>
  );
}

export default function Copiloto({ destinoSugerido }: { destinoSugerido: string }) {
  const [modo, setModo] = useState<"guiado" | "notas">("guiado");
  // Con que entrada se lanzo la ultima consulta. Sin esto, descartar despues de
  // usar las notas recalculaba con los valores del formulario.
  const [ultimaEntrada, setUltimaEntrada] = useState<{ formulario: boolean; texto: string }>({
    formulario: true,
    texto: "",
  });
  const [notas, setNotas] = useState("");
  const [form, setForm] = useState({
    adultos: 2,
    ninos: "" as string,
    presupuestoTotal: 3500,
    presupuestoFlexible: false,
    fechaSalida: "",
    mes: new Date().getMonth() + 1,
    dias: 7,
    motivacion: "descanso" as "descanso" | "cultura" | "aventura" | "romantico" | "celebracion",
    intensidad: 2,
    restricciones: [] as string[],
    tensionDeclarada: "",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [tecnico, setTecnico] = useState(false);

  function perfilDelFormulario() {
    return {
      adultos: form.adultos,
      edadesNinos: form.ninos
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map(Number)
        .filter((n) => n >= 0 && n <= 17),
      presupuestoTotal: form.presupuestoTotal,
      presupuestoFlexible: form.presupuestoFlexible,
      mes: form.mes,
      dias: form.dias,
      fechaSalida: form.fechaSalida || null,
      motivacion: form.motivacion,
      intensidad: form.intensidad,
      restricciones: form.restricciones,
      destinosVisitados: [],
      tensionDeclarada: form.tensionDeclarada,
    };
  }

  async function enviar(texto: string, fuera: string[] = [], usarFormulario = modo === "guiado") {
    if (cargando) return;
    if (!usarFormulario && !texto.trim()) return;
    setCargando(true);
    setError(null);
    setUltimaEntrada({ formulario: usarFormulario, texto });
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usarFormulario
            ? { perfil: perfilDelFormulario(), excluidos: fuera }
            : { notas: texto, excluidos: fuera },
        ),
      });
      const d = (await r.json()) as Respuesta & { error?: { message: string } };
      if (!r.ok) throw new Error(d.error?.message ?? "No se ha podido calcular la propuesta.");
      setRespuesta(d);

      // Si faltan datos, no se deja al agente en un callejon sin salida: se
      // rellena el formulario con lo que SI se ha entendido y solo se le pide
      // lo que falta.
      if (d.modo === "perfil-incompleto" && d.perfilExtraido) {
        const p = d.perfilExtraido;
        setForm((f) => ({
          ...f,
          adultos: p.adultos ?? f.adultos,
          ninos: (p.ninos ?? []).join(", "),
          mes: p.mes ?? f.mes,
          dias: p.dias ?? f.dias,
          motivacion: (["descanso", "cultura", "aventura", "romantico", "celebracion"].includes(
            p.motivacion ?? "",
          )
            ? p.motivacion
            : f.motivacion) as typeof f.motivacion,
          restricciones: (p as { restricciones?: string[] }).restricciones ?? f.restricciones,
          tensionDeclarada: p.tension ?? f.tensionDeclarada,
        }));
        setModo("guiado");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido calcular la propuesta.");
    } finally {
      setCargando(false);
    }
  }

  // Un motivo POR PROPUESTA. Con un solo estado compartido, escribir en una
  // tarjeta escribia en las dos.
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  async function descartar(id: string, texto: string) {
    // El motivo del descarte es lo que hace util el registro: sin el, solo
    // sabriamos que se rechazo, no por que.
    void fetch("/api/descarte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recomendacionId: respuesta?.recomendacionId ?? null,
        destinoId: id,
        motivo: texto,
      }),
    }).catch(() => undefined);

    const fuera = [...excluidos, id];
    setExcluidos(fuera);
    setMotivos((m) => {
      const resto = { ...m };
      delete resto[id];
      return resto;
    });
    await enviar(ultimaEntrada.texto, fuera, ultimaEntrada.formulario);
  }

  const perfil = respuesta?.perfilExtraido;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-4">
        <Panel
          titulo="1 · Quién viaja y cómo"
          extra={
            <div className="flex gap-1 rounded-xl p-1" style={{ border: "1px solid var(--line)" }}>
              {(["guiado", "notas"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  aria-pressed={modo === m}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                  style={{
                    background: modo === m ? "rgba(141,245,189,.1)" : "transparent",
                    color: modo === m ? "var(--green)" : "#70897e",
                  }}
                >
                  {m === "guiado" ? "Formulario" : "Notas libres"}
                </button>
              ))}
            </div>
          }
        >
          {modo === "guiado" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setExcluidos([]);
                void enviar("", [], true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Campo etiqueta="Adultos" id="f-adultos">
                  <input id="f-adultos" type="number" min={1} max={12} className="field"
                    value={form.adultos}
                    onChange={(e) => setForm({ ...form, adultos: Number(e.target.value) })} />
                </Campo>

                <Campo etiqueta="Edades de los niños" id="f-ninos" ayuda="separadas por comas">
                  <input id="f-ninos" className="field" placeholder="5, 8"
                    value={form.ninos}
                    onChange={(e) => setForm({ ...form, ninos: e.target.value })} />
                </Campo>

                <Campo etiqueta="Presupuesto total (€)" id="f-presu">
                  <input id="f-presu" type="number" min={100} step={100} className="field"
                    value={form.presupuestoTotal}
                    onChange={(e) => setForm({ ...form, presupuestoTotal: Number(e.target.value) })} />
                </Campo>

                <Campo etiqueta="Fecha de salida" id="f-fecha" ayuda="si el cliente ya la tiene">
                  <input id="f-fecha" type="date" className="field"
                    value={form.fechaSalida}
                    onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })} />
                </Campo>

                <Campo etiqueta="Mes del viaje" id="f-mes" ayuda={form.fechaSalida ? "lo manda la fecha" : "si aún no hay fecha"}>
                  <select id="f-mes" className="field" value={form.mes} disabled={Boolean(form.fechaSalida)}
                    onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}>
                    {MESES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Días disponibles" id="f-dias">
                  <input id="f-dias" type="number" min={1} max={60} className="field"
                    value={form.dias}
                    onChange={(e) => setForm({ ...form, dias: Number(e.target.value) })} />
                </Campo>

                <Campo etiqueta="Motivación" id="f-motiv">
                  <select id="f-motiv" className="field" value={form.motivacion}
                    onChange={(e) => setForm({ ...form, motivacion: e.target.value as typeof form.motivacion })}>
                    <option value="descanso">Descanso</option>
                    <option value="cultura">Cultura</option>
                    <option value="aventura">Aventura</option>
                    <option value="romantico">Romántico</option>
                    <option value="celebracion">Celebración</option>
                  </select>
                </Campo>

                <Campo etiqueta="Intensidad" id="f-int" ayuda="1 tumbado · 5 mochila y ruta">
                  <input id="f-int" type="range" min={1} max={5} step={1} className="w-full"
                    style={{ accentColor: "var(--green)" }}
                    value={form.intensidad}
                    onChange={(e) => setForm({ ...form, intensidad: Number(e.target.value) })} />
                </Campo>

                <div className="sm:col-span-2 lg:col-span-2">
                  <span className="mb-2 block text-[11px] text-[var(--dim)]">Restricciones</span>
                  <div className="flex flex-wrap gap-2">
                    {RESTRICCIONES.map((r) => {
                      const on = form.restricciones.includes(r);
                      return (
                        <button key={r} type="button" aria-pressed={on}
                          className="btn btn-ghost px-3 py-1.5 text-[11px]"
                          style={on ? { borderColor: "var(--line-strong)", color: "var(--green)" } : undefined}
                          onClick={() =>
                            setForm({
                              ...form,
                              restricciones: on
                                ? form.restricciones.filter((x) => x !== r)
                                : [...form.restricciones, r],
                            })
                          }>
                          {r}
                        </button>
                      );
                    })}
                    <button type="button" aria-pressed={form.presupuestoFlexible}
                      className="btn btn-ghost px-3 py-1.5 text-[11px]"
                      style={form.presupuestoFlexible ? { borderColor: "var(--line-strong)", color: "var(--green)" } : undefined}
                      onClick={() => setForm({ ...form, presupuestoFlexible: !form.presupuestoFlexible })}>
                      presupuesto flexible
                    </button>
                  </div>
                </div>

                <Campo etiqueta="Tensión declarada" id="f-tension" ayuda="lo que un desplegable no captura">
                  <input id="f-tension" className="field" placeholder="ella quiere playa, él se aburre"
                    value={form.tensionDeclarada}
                    onChange={(e) => setForm({ ...form, tensionDeclarada: e.target.value })} />
                </Campo>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--dim)]">
                  El formulario se salta la extracción: menos tokens, menos latencia y cero ambigüedad.
                </span>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  <Send size={14} className="mr-1.5 inline" aria-hidden />
                  {cargando ? "Calculando…" : "Preparar propuesta"}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setExcluidos([]);
                void enviar(notas, [], false);
              }}
            >
              <label htmlFor="notas" className="sr-only">Notas de la llamada</label>
              <textarea
                id="notas"
                className="field min-h-[110px] resize-y"
                placeholder={`Con tus palabras. Por ejemplo: ${EJEMPLOS[0]}`}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={2000}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--dim)]">
                  La extracción funciona sin modelo de lenguaje: son reglas, no una IA adivinando.
                </span>
                <button type="submit" className="btn btn-primary" disabled={cargando || notas.trim().length < 3}>
                  <Send size={14} className="mr-1.5 inline" aria-hidden />
                  {cargando ? "Calculando…" : "Preparar propuesta"}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {EJEMPLOS.map((e, i) => (
                  <button key={i} type="button" className="btn btn-ghost px-3 py-1.5 text-[11px]"
                    onClick={() => { setNotas(e); setExcluidos([]); void enviar(e, [], false); }}>
                    Ejemplo {i + 1}
                  </button>
                ))}
              </div>
            </form>
          )}
        </Panel>

        {error ? <Vacio mensaje={error} /> : null}

        {respuesta?.modo === "perfil-incompleto" ? (
          <div className="subpanel p-4">
            <p className="text-[13px]">{respuesta.mensaje ?? "Faltan datos en las notas."}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
              He rellenado el formulario de arriba con lo que sí he entendido de tus notas. Añade el
              presupuesto y dale a «Preparar propuesta».
            </p>
          </div>
        ) : null}

        {respuesta?.resultado ? (
          <>
          {/* El descarte era una línea de once píxeles en la esquina, y es el
              momento en el que el producto demuestra lo que hace. Ahora es un
              paso con su propio sitio. */}
          <section className="panel p-4">
            <span className="block text-[10px] font-bold tracking-[.12em] text-[var(--dim)]">
              2 · QUÉ HA DESCARTADO EL SISTEMA
            </span>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
              <b className="text-[22px] tabular-nums">{respuesta.resultado.candidatas}</b>
              <span className="text-[var(--muted)]">destinos evaluados</span>
              <span className="text-[var(--dim)]">→</span>
              <b className="text-[22px] tabular-nums" style={{ color: "#FF9868" }}>
                {respuesta.resultado.candidatas - respuesta.resultado.supervivientes}
              </b>
              <span className="text-[var(--muted)]">descartados por las reglas</span>
              <span className="text-[var(--dim)]">→</span>
              <b className="text-[22px] tabular-nums" style={{ color: "var(--green)" }}>
                {respuesta.resultado.propuestas.length}
              </b>
              <span className="text-[var(--muted)]">propuestas</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">
              El descarte lo hace código, no el modelo. Una regla inviolable no se puede negociar
              ni resucitar: si el vuelo es largo y viaja un menor de seis años, ese destino no sale.
            </p>
          </section>

          <Panel
            titulo={
              respuesta.resultado.modo === "recomendadas"
                ? "3 · Lo que le propones al cliente"
                : "3 · Ninguna opción cumple todo"
            }
          >
            {respuesta.resultado.mensaje ? (
              <p className="subpanel mb-3 p-3 text-[12px] text-[var(--muted)]">{respuesta.resultado.mensaje}</p>
            ) : null}

            {respuesta.resultado.propuestas.length === 0 ? (
              <Vacio mensaje="No hay ninguna opción admisible con estas condiciones." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {respuesta.resultado.propuestas.map((p) => {
                  const arg = respuesta.argumentos?.find((a) => a.id === p.id);
                  return (
                    <article key={p.id} className="subpanel p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <b className="block text-[14px]">{p.destino}</b>
                          <span className="block text-[11px] text-[var(--dim)]">{p.nombre}</span>
                        </div>
                        <span className="shrink-0 text-right">
                          <b className="block text-[14px]">{euros.format(p.precioPorPersona)}</b>
                          <span className="block text-[10px] text-[var(--dim)]">{euros.format(p.precioTotalGrupo)} grupo</span>
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-[var(--dim)]">
                        {p.salida && p.regreso
                          ? `${fecha(p.salida)} → ${fecha(p.regreso)} · ${p.noches} noches`
                          : `${p.noches} noches`}
                        {" · precio del paquete en el catálogo de la agencia"}
                      </div>

                      <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed">
                        {(arg?.argumento ?? p.motivos).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>

                      {p.incumplimientos.length > 0 ? (
                        <ul className="mt-3 space-y-1 border-t pt-3 text-[11px] text-[var(--orange)]" style={{ borderColor: "var(--line)" }}>
                          {p.incumplimientos.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                        </ul>
                      ) : null}

                      {(() => {
                        const c = respuesta.conversiones?.find((x) => x.id === p.id);
                        if (!c) return null;
                        return (
                          <details className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                            <summary className="flex cursor-pointer items-baseline justify-between gap-2">
                              <span className="text-[11px] text-[var(--dim)]">Probabilidad de cierre</span>
                              <span className="text-[15px] tabular-nums" style={{ color: "var(--green)" }}>
                                {Math.round(c.probabilidad * 100)}%
                              </span>
                            </summary>
                            <ul className="mt-2 space-y-1 text-[11px]">
                              <li className="flex justify-between gap-2 text-[var(--muted)]">
                                <span>Base {c.empirica ? "empírica" : "supuesta"}</span>
                                <span className="tabular-nums">{Math.round(c.base * 100)}%</span>
                              </li>
                              {c.ajustes.map((a) => (
                                <li key={a.nombre} className="flex justify-between gap-2 text-[var(--muted)]">
                                  <span className="min-w-0">
                                    {a.nombre}
                                    <span className="block text-[10px] text-[var(--dim)]">{a.porque}</span>
                                  </span>
                                  <span
                                    className="shrink-0 tabular-nums"
                                    style={{ color: a.factor >= 1 ? "var(--green)" : "var(--orange)" }}
                                  >
                                    ×{a.factor.toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <p
                              className="mt-2 text-[10px] leading-relaxed"
                              style={{ color: c.empirica ? "var(--dim)" : "var(--orange)" }}
                            >
                              {c.explicacion}
                            </p>
                          </details>
                        );
                      })()}

                      <p className="mt-3 text-[10px] text-[var(--dim)]">
                        {arg?.verificado
                          ? `Argumento verificado · ${arg.camposCitados.length} campos citados de la ficha, 0 inventados`
                          : `Sin redacción verificada${arg?.motivo ? ` (${arg.motivo})` : ""}. Se muestran los motivos del catálogo.`}
                      </p>

                      <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                        <label className="sr-only" htmlFor={`motivo-${p.id}`}>
                          Motivo del descarte, opcional
                        </label>
                        <input
                          id={`motivo-${p.id}`}
                          className="field text-[12px]"
                          placeholder="¿Por qué no encaja? (opcional)"
                          value={motivos[p.id] ?? ""}
                          onChange={(e) => setMotivos({ ...motivos, [p.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void descartar(p.id, (motivos[p.id] ?? "").trim() || "sin motivo indicado");
                            }
                          }}
                          disabled={cargando}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost shrink-0 px-3 py-1.5 text-[11px]"
                          disabled={cargando}
                          onClick={() => descartar(p.id, (motivos[p.id] ?? "").trim() || "sin motivo indicado")}
                        >
                          {cargando ? "Recalculando…" : "Descartar"}
                        </button>
                      </div>

                    </article>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
              Revisa siempre la propuesta antes de enviarla al cliente.
              {destinoSugerido ? ` Destino abierto en el radar: ${destinoSugerido}.` : ""}
            </p>
          </Panel>
          </>
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel titulo="Lo que hemos entendido">
          {!perfil ? (
            <Vacio mensaje="Escribe las notas de la llamada y el perfil aparecerá aquí, con la frase de la que sale cada dato." />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                {[
                  ["Adultos", perfil.adultos ?? "—"],
                  ["Niños", perfil.ninos?.length ? `${perfil.ninos.join(", ")} años` : "ninguno"],
                  ["Presupuesto", perfil.presupuesto_total ? euros.format(perfil.presupuesto_total) : "—"],
                  ["Mes", perfil.mes ?? "—"],
                  ["Días", perfil.dias ?? "—"],
                  ["Motivación", perfil.motivacion ?? "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-2">
                    <dt className="text-[var(--dim)]">{k}</dt>
                    <dd className="text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>

              {perfil.tension ? (
                <p className="subpanel mt-3 p-3 text-[12px]">
                  <span className="block text-[10px] text-[var(--dim)]">Tensión declarada</span>
                  {perfil.tension}
                </p>
              ) : null}

              {perfil.no_consta?.length > 0 ? (
                <p className="mt-3 text-[11px]" style={{ color: "var(--orange)" }}>
                  No consta en las notas: {perfil.no_consta.join(", ")}. Se ha usado el valor por defecto.
                </p>
              ) : null}

              {Object.keys(perfil.literales ?? {}).length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-[var(--dim)]">De dónde sale cada dato</summary>
                  <ul className="mt-2 space-y-1 text-[11px] text-[var(--muted)]">
                    {Object.entries(perfil.literales).map(([campo, cita]) => (
                      <li key={campo}>
                        <span className="text-[var(--text)]">{campo}:</span> «{cita}»
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </Panel>

        <Panel
          titulo="Para el equipo técnico"
          extra={
            <button
              type="button"
              className="btn btn-ghost px-3 py-1.5 text-[11px]"
              onClick={() => setTecnico((v) => !v)}
              aria-pressed={tecnico}
            >
              {tecnico ? "Ocultar" : "Ver la traza"}
            </button>
          }
        >
          {!tecnico ? (
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              La traza completa: qué descartó cada regla, con qué pesos se ordenó lo que quedó, y el
              resultado de la verificación del argumento. No hace falta para usar la herramienta.
            </p>
          ) : !respuesta?.traza ? (
            <Vacio mensaje="Lanza una propuesta para ver la traza." />
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[var(--muted)]">
              {JSON.stringify(respuesta.traza, null, 2)}
            </pre>
          )}
        </Panel>
      </div>
    </div>
  );
}
