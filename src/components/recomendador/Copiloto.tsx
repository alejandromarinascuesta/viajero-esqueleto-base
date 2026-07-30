import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extraerPerfil, redactarArgumentos } from "@/lib/copiloto.functions";
import type { ArgumentoVerificado, PerfilExtraido } from "@/lib/copiloto.functions";
import { recomendar, registrarDescarte } from "@/lib/recomendador.functions";
import { consultarCopiloto } from "@/lib/senales.functions";
import type {
  Motivacion,
  Perfil,
  Propuesta,
  ResultadoRecomendacion,
  Restriccion,
} from "@/lib/recomendador/tipos";

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

type Turno =
  | { tipo: "agente"; texto: string }
  | { tipo: "sistema"; texto: string }
  | { tipo: "perfil"; perfil: PerfilExtraido; confirmarPresupuesto: boolean };

const MOTIVACIONES_VALIDAS = ["descanso", "cultura", "aventura", "romantico", "celebracion"];
const RESTRICCIONES_VALIDAS = ["movilidad reducida", "no vuelos largos", "presupuesto ajustado"];

/**
 * Clasificación determinista: una pregunta va al copiloto de consulta, una
 * descripción de cliente va a la extracción de perfil. No la decide el modelo,
 * porque el encaminamiento tiene que ser reproducible.
 */
function esConsulta(texto: string): boolean {
  const t = texto.trim().toLowerCase();
  if (t.endsWith("?") || t.startsWith("¿")) return true;
  return /^(que|qué|cual|cuál|como|cómo|cuanto|cuánto|por que|por qué|dime|muestra|explica|hay )/.test(
    t,
  );
}

function aPerfil(e: PerfilExtraido): Perfil {
  return {
    adultos: e.adultos ?? 2,
    edadesNinos: Array.isArray(e.ninos) ? e.ninos : [],
    presupuestoTotal: e.presupuesto_total ?? 0,
    presupuestoFlexible: e.flexible === true,
    mes: e.mes ?? new Date().getMonth() + 1,
    dias: e.dias ?? 7,
    motivacion: (MOTIVACIONES_VALIDAS.includes(e.motivacion ?? "")
      ? e.motivacion
      : "descanso") as Motivacion,
    intensidad: e.intensidad ?? 2,
    restricciones: (e.restricciones ?? []).filter((r) =>
      RESTRICCIONES_VALIDAS.includes(r),
    ) as Restriccion[],
    destinosVisitados: [],
    tensionDeclarada: e.tension ?? "",
  };
}

export function Copiloto({ tecnico }: { tecnico: boolean }) {
  const lanzarExtraccion = useServerFn(extraerPerfil);
  const lanzarConsulta = useServerFn(consultarCopiloto);
  const lanzarRecomendacion = useServerFn(recomendar);
  const lanzarArgumentos = useServerFn(redactarArgumentos);
  const lanzarDescarte = useServerFn(registrarDescarte);

  const [entrada, setEntrada] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [resultado, setResultado] = useState<ResultadoRecomendacion | null>(null);
  const [argumentos, setArgumentos] = useState<ArgumentoVerificado[]>([]);
  const [abierta, setAbierta] = useState<Propuesta | null>(null);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [traza, setTraza] = useState<Record<string, unknown> | null>(null);
  const idRecomendacion = useRef<number | null>(null);

  const anadir = (t: Turno) => setTurnos((prev) => [...prev, t]);

  const calcular = async (p: Perfil, fuera: string[]) => {
    const r = await lanzarRecomendacion({ data: { perfil: p, excluidos: fuera, afinar: "" } });
    setResultado(r);
    idRecomendacion.current = r.recomendacionId ?? null;
    setArgumentos([]);

    let usoArgumentos: unknown = null;
    if (r.propuestas.length > 0) {
      const a = await lanzarArgumentos({ data: { perfil: p, propuestas: r.propuestas } });
      setArgumentos(a.argumentos);
      usoArgumentos = {
        ...a.uso,
        camposCitados: a.camposCitados,
        camposInventados: a.camposInventados,
      };
    }
    setTraza({
      candidatas: r.candidatas,
      supervivientes: r.supervivientes,
      modo: r.modo,
      excluidos: fuera,
      avisos: r.avisos,
      redaccion: usoArgumentos,
    });
    return r;
  };

  const enviar = useMutation({
    mutationFn: async (texto: string) => {
      anadir({ tipo: "agente", texto });

      if (esConsulta(texto)) {
        const r = await lanzarConsulta({ data: { pregunta: texto } });
        anadir({ tipo: "sistema", texto: r.respuesta });
        return;
      }

      const e = await lanzarExtraccion({ data: { notas: texto } });
      if (!e.perfil) {
        anadir({
          tipo: "sistema",
          texto:
            "No he podido interpretar las notas. Revisa el perfil a mano y pulsa «Recomendar».",
        });
        return;
      }
      anadir({
        tipo: "perfil",
        perfil: e.perfil,
        confirmarPresupuesto: e.requiereConfirmarPresupuesto,
      });
      const p = aPerfil(e.perfil);
      setPerfil(p);
      setExcluidos([]);
      if (!e.requiereConfirmarPresupuesto) await calcular(p, []);
    },
  });

  const descartar = async (id: string, motivo: string) => {
    if (!perfil) return;
    await lanzarDescarte({
      data: { recomendacionId: idRecomendacion.current, destinoId: id, motivo },
    });
    const fuera = [...excluidos, id];
    setExcluidos(fuera);
    setAbierta(null);
    anadir({ tipo: "agente", texto: `Descartada ${id}: ${motivo}` });
    await calcular(perfil, fuera);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
      {/* Conversación */}
      <section className="flex min-h-[28rem] flex-col rounded-md border border-border xl:min-h-[34rem]">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 xl:max-h-[calc(100vh-20rem)]">
          {turnos.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Cuenta lo que te ha dicho el cliente, con tus palabras:</p>
              <p className="rounded-md border border-border p-3 text-foreground">
                «Pareja de 45 con dos niños de 5 y 8. Unos 3.500 en total, primera quincena de
                agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.»
              </p>
              <p>O pregunta por los datos: «¿cómo está el interés por Lisboa?»</p>
            </div>
          ) : null}

          {turnos.map((t, i) =>
            t.tipo === "perfil" ? (
              <FichaPerfil key={i} extraido={t.perfil} confirmar={t.confirmarPresupuesto} />
            ) : (
              <div
                key={i}
                className={
                  t.tipo === "agente"
                    ? "ml-auto max-w-[85%] rounded-md bg-muted px-3 py-2 text-sm"
                    : "max-w-[85%] rounded-md border border-border px-3 py-2 text-sm"
                }
              >
                {t.texto}
              </div>
            ),
          )}

          {enviar.isPending ? <p className="text-sm text-muted-foreground">Procesando…</p> : null}
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            const texto = entrada.trim();
            if (!texto || enviar.isPending) return;
            setEntrada("");
            enviar.mutate(texto);
          }}
        >
          <Textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Notas de la llamada, o una pregunta sobre los datos…"
            className="min-h-[3rem] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          />
          <Button type="submit" disabled={enviar.isPending}>
            Enviar
          </Button>
        </form>
      </section>

      {/* Resultado del motor */}
      <aside className="space-y-3">
        {perfil && resultado ? (
          <div className="rounded-md border border-border p-4">
            <p className="text-xs text-muted-foreground">
              {resultado.candidatas} evaluadas · {resultado.supervivientes} superan las reglas
            </p>
            {resultado.mensaje ? (
              <p className="mt-2 rounded-md border border-border p-2 text-xs">
                {resultado.mensaje}
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              {resultado.propuestas.map((p) => {
                const arg = argumentos.find((a) => a.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAbierta(p)}
                    className="w-full rounded-md border border-border p-3 text-left transition-colors hover:border-foreground/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{p.destino}</span>
                      <span className="shrink-0 text-sm">{euros.format(p.precioPorPersona)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.noches} noches · {euros.format(p.precioTotalGrupo)} el grupo
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs">{(arg?.argumento ?? p.motivos)[0]}</p>
                    {arg && !arg.verificado ? (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        argumento sin verificar · se muestran los motivos de ficha
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {resultado.propuestas.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No hay ninguna opción admisible.</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            Las propuestas aparecerán aquí en cuanto describas al cliente.
          </div>
        )}

        {tecnico && traza ? (
          <div className="rounded-md border border-border p-4">
            <p className="text-xs font-medium">Traza</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(traza, null, 2)}
            </pre>
          </div>
        ) : null}
      </aside>

      <DetallePropuesta
        propuesta={abierta}
        argumento={abierta ? (argumentos.find((a) => a.id === abierta.id) ?? null) : null}
        tecnico={tecnico}
        onCerrar={() => setAbierta(null)}
        onDescartar={descartar}
      />
    </div>
  );
}

function FichaPerfil({ extraido, confirmar }: { extraido: PerfilExtraido; confirmar: boolean }) {
  const filas: [string, string][] = [
    ["Adultos", String(extraido.adultos ?? "—")],
    ["Niños", extraido.ninos?.length ? extraido.ninos.join(", ") + " años" : "ninguno"],
    ["Presupuesto", extraido.presupuesto_total ? euros.format(extraido.presupuesto_total) : "—"],
    ["Mes", extraido.mes ? String(extraido.mes) : "—"],
    ["Días", String(extraido.dias ?? "—")],
    ["Motivación", extraido.motivacion ?? "—"],
    ["Tensión", extraido.tension ?? "no declarada"],
  ];

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium">Perfil extraído de tus notas</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>

      {confirmar ? (
        <p className="mt-2 rounded-md border border-border p-2 text-xs">
          No queda claro si el presupuesto es total o por persona. Confírmalo en el formulario antes
          de recomendar: interpretarlo mal multiplica el presupuesto por el número de viajeros.
        </p>
      ) : null}

      {extraido.no_consta?.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No consta en las notas: {extraido.no_consta.join(", ")}. Se ha usado el valor por defecto.
        </p>
      ) : null}

      {Object.keys(extraido.literales ?? {}).length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            De dónde sale cada dato
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {Object.entries(extraido.literales).map(([campo, cita]) => (
              <li key={campo}>
                <span className="text-foreground">{campo}:</span> «{cita}»
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function DetallePropuesta({
  propuesta,
  argumento,
  tecnico,
  onCerrar,
  onDescartar,
}: {
  propuesta: Propuesta | null;
  argumento: ArgumentoVerificado | null;
  tecnico: boolean;
  onCerrar: () => void;
  onDescartar: (id: string, motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <Dialog open={propuesta !== null} onOpenChange={(v) => (!v ? onCerrar() : undefined)}>
      <DialogContent className="max-w-lg">
        {propuesta ? (
          <>
            <DialogHeader>
              <DialogTitle>{propuesta.nombre}</DialogTitle>
              <DialogDescription>
                {propuesta.destino} · {propuesta.noches} noches
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Por persona</dt>
                <dd>{euros.format(propuesta.precioPorPersona)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total grupo</dt>
                <dd>{euros.format(propuesta.precioTotalGrupo)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Noches</dt>
                <dd>{propuesta.noches}</dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-medium">Por qué encaja</p>
              <ul className="mt-1 space-y-1 text-sm">
                {(argumento?.argumento ?? propuesta.motivos).map((frase) => (
                  <li key={frase}>{frase}</li>
                ))}
              </ul>
              {argumento ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {argumento.verificado
                    ? `Verificado · ${argumento.camposCitados.length} campos citados de la ficha, 0 inventados`
                    : `Sin verificar (${argumento.motivoFallo}). Se muestran los motivos del catálogo.`}
                </p>
              ) : null}
            </div>

            {propuesta.incumplimientos.length > 0 ? (
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-medium">Incumple reglas relajables</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {propuesta.incumplimientos.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tecnico && argumento ? (
              <p className="text-[11px] text-muted-foreground">
                Campos citados: {argumento.camposCitados.join(", ") || "ninguno"}
              </p>
            ) : null}

            <form
              className="flex items-center gap-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!motivo.trim()) return;
                onDescartar(propuesta.id, motivo.trim());
                setMotivo("");
              }}
            >
              <Input
                placeholder="Motivo del descarte"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <Button type="submit" variant="outline" size="sm">
                Descartar
              </Button>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
