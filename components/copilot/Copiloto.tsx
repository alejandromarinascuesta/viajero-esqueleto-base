"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel, Vacio } from "@/components/ui";
import type { Recomendacion } from "@/types";

type Argumento = { id: string; argumento: string[]; camposCitados: string[]; verificado: boolean; motivo: string | null };
type Respuesta = {
  modo: string;
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

export default function Copiloto({ destinoSugerido }: { destinoSugerido: string }) {
  const [notas, setNotas] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [tecnico, setTecnico] = useState(false);

  async function enviar(texto: string, fuera: string[] = []) {
    if (!texto.trim() || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas: texto, excluidos: fuera }),
      });
      const d = (await r.json()) as Respuesta & { error?: { message: string } };
      if (!r.ok) throw new Error(d.error?.message ?? "No se ha podido calcular la propuesta.");
      setRespuesta(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido calcular la propuesta.");
    } finally {
      setCargando(false);
    }
  }

  const descartar = (id: string) => {
    const fuera = [...excluidos, id];
    setExcluidos(fuera);
    void enviar(notas, fuera);
  };

  const perfil = respuesta?.perfilExtraido;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-4">
        <Panel titulo="Cuenta lo que te ha dicho el cliente">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setExcluidos([]);
              void enviar(notas);
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
                La extracción del perfil funciona sin modelo de lenguaje: son reglas, no una IA adivinando.
              </span>
              <button type="submit" className="btn btn-primary" disabled={cargando || notas.trim().length < 3}>
                <Send size={14} className="mr-1.5 inline" aria-hidden />
                {cargando ? "Calculando…" : "Preparar propuesta"}
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EJEMPLOS.map((e, i) => (
              <button
                key={i}
                type="button"
                className="btn btn-ghost px-3 py-1.5 text-[11px]"
                onClick={() => { setNotas(e); setExcluidos([]); void enviar(e); }}
              >
                Ejemplo {i + 1}
              </button>
            ))}
          </div>
        </Panel>

        {error ? <Vacio mensaje={error} /> : null}

        {respuesta?.modo === "perfil-incompleto" ? (
          <Vacio mensaje={respuesta.mensaje ?? "Faltan datos en las notas."} />
        ) : null}

        {respuesta?.resultado ? (
          <Panel
            titulo={
              respuesta.resultado.modo === "recomendadas"
                ? "Propuestas para este cliente"
                : "Ninguna opción cumple todo"
            }
            extra={
              <span className="text-[11px] text-[var(--dim)]">
                {respuesta.resultado.candidatas} evaluadas · {respuesta.resultado.supervivientes} superan las reglas
              </span>
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

                      <p className="mt-3 text-[10px] text-[var(--dim)]">
                        {arg?.verificado
                          ? `Argumento verificado · ${arg.camposCitados.length} campos citados de la ficha, 0 inventados`
                          : `Sin redacción verificada${arg?.motivo ? ` (${arg.motivo})` : ""}. Se muestran los motivos del catálogo.`}
                      </p>

                      <button type="button" className="btn btn-ghost mt-3 px-3 py-1.5 text-[11px]" onClick={() => descartar(p.id)}>
                        Descartar y recalcular
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
              Las recomendaciones deben ser revisadas por un agente antes de enviarse al cliente.
              {destinoSugerido ? ` Destino abierto en el radar: ${destinoSugerido}.` : ""}
            </p>
          </Panel>
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel titulo="Perfil extraído">
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
          titulo="Modo técnico"
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
              Abre la orquestación: qué descartó cada regla, los pesos aplicados y el resultado de la
              verificación del argumento.
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
