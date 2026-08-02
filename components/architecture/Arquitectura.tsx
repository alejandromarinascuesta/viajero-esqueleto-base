"use client";

import { useEffect, useState } from "react";
import { Activity, LoaderCircle } from "lucide-react";
import type { OrigenDatos } from "@/lib/data";
import { Panel } from "@/components/ui";

type Consumo = {
  llamadas: number;
  fallos: number;
  tasaError: number;
  costeTotal: number;
  costePorCaso: number;
  latenciaP95: number;
  porTipo: Record<string, { llamadas: number; coste: number; msMedio: number }>;
  porActor: Record<string, { llamadas: number; coste: number; casos: number }>;
  proyeccion4000Propuestas: number;
  presupuestoMensual: number | null;
  alerta: string | null;
};

const ETIQUETA_TIPO: Record<string, string> = {
  perfil: "Leer las notas del agente",
  argumento: "Redactar el argumento",
  guion: "Guion de contenido",
  voz: "Locución",
};

const euros = (v: number) =>
  v >= 1 ? `${v.toFixed(2)} €` : `${(v * 100).toFixed(2)} cént.`;

/**
 * Observabilidad del gasto en IA, visible.
 *
 * Contar tokens no le dice nada a quien firma el presupuesto. Aqui se ve en
 * euros, por tipo de peticion, y proyectado al volumen real de la agencia.
 */
function GastoIA() {
  const [datos, setDatos] = useState<Consumo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const control = new AbortController();
    fetch("/api/observabilidad", { signal: control.signal })
      .then((r) => r.json())
      .then((d: Consumo) => setDatos(d))
      .catch(() => undefined)
      .finally(() => setCargando(false));
    return () => control.abort();
  }, []);

  return (
    <Panel
      titulo="Lo que cuesta la IA, medido"
      extra={<span className="pill pill-line">EN DIRECTO</span>}
    >
      {cargando ? (
        <p className="flex items-center gap-2 text-[12px] text-[var(--dim)]">
          <LoaderCircle size={13} className="animate-spin" /> Consultando el registro de consumo…
        </p>
      ) : !datos || datos.llamadas === 0 ? (
        <p className="text-[12px] leading-relaxed text-[var(--muted)]">
          Todavía no hay llamadas en esta ventana. Genera una propuesta en el Copiloto o una pieza
          en el Content Studio y vuelve aquí: cada llamada al modelo se registra con su coste en euros.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Coste por caso", euros(datos.costePorCaso), "un cliente atendido de principio a fin"],
              ["Gasto acumulado", euros(datos.costeTotal), `${datos.llamadas} llamadas registradas`],
              ["Latencia p95", `${(datos.latenciaP95 / 1000).toFixed(1)} s`, "19 de cada 20 por debajo"],
              ["Errores", `${Math.round(datos.tasaError * 100)} %`, `${datos.fallos} de ${datos.llamadas}`],
            ].map(([k, v, n]) => (
              <div key={k} className="subpanel p-3">
                <span className="block text-[9px] tracking-[.1em] text-[var(--dim)]">{k.toUpperCase()}</span>
                <b className="mt-1 block text-[20px] text-[var(--green)]">{v}</b>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--dim)]">{n}</span>
              </div>
            ))}
          </div>

          {Object.keys(datos.porTipo).length ? (
            <div className="subpanel p-3">
              <span className="block text-[9px] tracking-[.1em] text-[var(--dim)]">DÓNDE SE VA EL DINERO</span>
              <ul className="mt-2 space-y-1.5">
                {Object.entries(datos.porTipo).map(([tipo, t]) => (
                  <li key={tipo} className="flex items-center justify-between gap-3 text-[11px]">
                    <span>{ETIQUETA_TIPO[tipo] ?? tipo}</span>
                    <span className="text-[var(--dim)]">
                      {t.llamadas} · {Math.round(t.msMedio)} ms · <b className="text-[var(--text)]">{euros(t.coste)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {datos.porActor && Object.keys(datos.porActor).length ? (
            <div className="subpanel p-3">
              <span className="block text-[9px] tracking-[.1em] text-[var(--dim)]">GASTO POR AGENTE</span>
              <ul className="mt-2 space-y-1.5">
                {Object.entries(datos.porActor).map(([actor, a]) => (
                  <li key={actor} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-mono text-[10px]">{actor}</span>
                    <span className="text-[var(--dim)]">
                      {a.casos} {a.casos === 1 ? "cliente" : "clientes"} · {a.llamadas} llamadas ·{" "}
                      <b className="text-[var(--text)]">{euros(a.coste)}</b>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--dim)]">
                Hoy el agente se identifica por navegador, porque todavía no hay inicio de sesión.
                Cuando lo haya, aquí aparece el usuario real sin cambiar nada más.
              </p>
            </div>
          ) : null}

          <div className="subpanel p-3">
            <div className="flex items-start gap-2">
              <Activity size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
              <p className="text-[11px] leading-relaxed">
                A este ritmo, <b>4.000 propuestas al mes costarían {euros(datos.proyeccion4000Propuestas)}</b> en
                modelo y voz.{" "}
                {datos.presupuestoMensual
                  ? `Presupuesto declarado: ${datos.presupuestoMensual} €/mes.`
                  : "No hay presupuesto mensual declarado, así que no hay alerta que dar."}
              </p>
            </div>
            {datos.alerta ? (
              <p className="mt-2 text-[11px] font-bold" style={{ color: "#FF9868" }}>{datos.alerta}</p>
            ) : null}
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--dim)]">
            Histórico persistido en base de datos: cada llamada guarda su traza, su coste y a quién
            atribuirla. Sobrevive a los despliegues.
          </p>
        </div>
      )}
    </Panel>
  );
}

const CAPAS = [
  {
    nombre: "Experiencia",
    piezas: ["Radar", "Destino 360", "Copiloto", "Content Studio", "Ajustes de dirección"],
    nota: "Lo que ve el agente y la dirección",
  },
  {
    nombre: "Producto",
    piezas: ["Puntuación de oportunidad", "Reglas duras", "Pesos comerciales", "Guiones verificados", "Render vertical"],
    nota: "El criterio de la agencia, hecho código. Determinista",
  },
  {
    nombre: "Inteligencia",
    piezas: ["Claude_LLM", "Google Trends", "Wikimedia Commons", "Clima", "Fallbacks verificados"],
    nota: "La IA redacta; las reglas, los datos y las licencias se controlan en código",
  },
  {
    nombre: "Plataforma",
    piezas: ["Next.js", "Vercel", "Postgres", "Canvas/MediaRecorder", "TikTok Content Posting API"],
    nota: "Sin servidor persistente",
  },
];

const DECISIONES = [
  {
    titulo: "La IA nunca decide",
    detalle:
      "Descarta el código, ordenan los pesos de la agencia y el modelo solo lee texto libre al principio y redacta al final. Mismo cliente y mismas reglas, misma respuesta.",
    coste: "Pierde flexibilidad ante matices raros que un modelo suelto captaría mejor.",
  },
  {
    titulo: "Generar vídeo en el navegador",
    detalle:
      "El primer MVP compone 9:16 con Canvas y MediaRecorder: no necesita una granja de render ni una API de vídeo para producir un WebM real con audio original.",
    coste: "La calidad cinematográfica y la voz natural requieren después un proveedor especializado o render cloud.",
  },
  {
    titulo: "TikTok como borrador, no autopublicación ciega",
    detalle:
      "La plataforma inicia la subida oficial, pero el creador revisa el resultado y completa la publicación desde TikTok. El consentimiento queda delante del botón.",
    coste: "Añade un paso humano, pero reduce riesgo de marca y cumple el flujo de autorización de TikTok.",
  },
  {
    titulo: "Dos niveles de regla dura",
    detalle:
      "Relajables (presupuesto, duración, temporada) pueden proponerse avisando. Inviolables (vuelo largo con menores, restricciones declaradas, cupo, visado) no aparecen nunca.",
    coste: "Una clasificación más que mantener y discutible caso a caso.",
  },
  {
    titulo: "Ningún dato inventado",
    detalle:
      "Cuando una fuente no devuelve dato, la métrica queda vacía, su peso se reparte y baja la confianza. Si la fuente cae, se sirve la última observación real guardada.",
    coste: "El panel enseña huecos en vez de tarjetas llenas.",
  },
  {
    titulo: "Ingesta en lote, no en caliente",
    detalle:
      "El motor nunca llama a una API externa durante una recomendación: lee la ficha ya cocinada. Cada fuente tiene su propia cadencia.",
    coste: "La señal puede tener horas o días. Para decidir qué promover, es irrelevante.",
  },
];

const SIGUIENTES = [
  "Cerrar el bucle: conectar el resultado real de reserva para que los pesos se corrijan con lo que se vende",
  "Fuentes de demanda consumada: Amadeus en producción, INE, Dataestur, Eurostat y Aena",
  "Eventos, para explicar por qué sube un destino y no solo que sube",
  "Integración en el CRM donde el agente ya trabaja",
  "Voz natural y B-roll generativo mediante un proveedor audiovisual intercambiable",
  "Roles, trazabilidad y retención de datos de cliente",
];

export default function Arquitectura({ origen }: { origen: OrigenDatos }) {
  return (
    <div className="space-y-4">
      <Panel titulo="Cómo se orquesta">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="subpanel p-4">
            <span className="pill pill-line">DE NOCHE · EN LOTE</span>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              Cada conector lee su fuente, la normaliza y la escribe con tres fechas: cuándo ocurre el dato,
              cuándo lo publicó la fuente y cuándo lo ingerimos. Todas las fuentes aterrizan en la misma
              forma — eso es lo que significa unificar datos dispersos.
            </p>
          </div>
          <div className="subpanel p-4 lg:col-span-2">
            <span className="pill pill-line">AL GENERAR CONTENIDO · BAJO DEMANDA</span>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              Radar → destino prioritario → Claude redacta sobre hechos permitidos → validación → búsqueda de
              activos licenciados en Wikimedia Commons → composición 9:16 con audio original → aprobación
              humana → descarga o borrador en TikTok. Si el modelo falla, entra un guion determinista construido
              con los motivos reales de la ficha.
            </p>
          </div>
          <div className="subpanel p-4">
            <span className="pill pill-line">EN CALIENTE · AL PEDIR</span>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
              Notas → extracción determinista → reglas duras descartan → pesos ordenan → el modelo redacta
              sobre las dos finalistas → verificación → pantalla. Sin llamadas externas.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CAPAS.map((c) => (
            <article key={c.nombre} className="subpanel p-4">
              <b className="text-[13px]">{c.nombre}</b>
              <ul className="mt-2 space-y-1 text-[11px] text-[var(--muted)]">
                {c.piezas.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] leading-relaxed text-[var(--dim)]">{c.nota}</p>
            </article>
          ))}
        </div>
      </Panel>

      <GastoIA />

      <Panel titulo="Decisiones y lo que cuestan">
        <div className="grid gap-3 lg:grid-cols-2">
          {DECISIONES.map((d) => (
            <article key={d.titulo} className="subpanel p-4">
              <b className="text-[13px]">{d.titulo}</b>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">{d.detalle}</p>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--orange)" }}>
                Coste: {d.coste}
              </p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel titulo="Dónde están los puntos críticos">
          <ul className="space-y-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
            <li><b className="text-[var(--text)]">La calidad del catálogo.</b> Si los motivos están mal escritos, el argumento suena a folleto. Ninguna IA lo arregla.</li>
            <li><b className="text-[var(--text)]">La extracción del perfil.</b> Confundir presupuesto total con presupuesto por persona lo multiplica por el número de viajeros. Por eso cada dato enseña la frase de la que sale.</li>
            <li><b className="text-[var(--text)]">Las fuentes externas.</b> Dependen de terceros. Mitigado con ingesta en lote y última observación real.</li>
            <li><b className="text-[var(--text)]">La redacción del argumento.</b> Es donde un modelo podría inventar. Se verifica en código y, si falla, no se muestra.</li>
            <li><b className="text-[var(--text)]">La adopción.</b> Un agente veterano no usa una herramienta que le contradice sin explicarse.</li>
            <li><b className="text-[var(--text)]">Derechos y publicación.</b> Cada activo conserva atribución y licencia; TikTok exige cuenta autorizada y revisión humana.</li>
          </ul>
        </Panel>

        <Panel titulo="Siguientes pasos">
          <ol className="space-y-2 text-[12px] leading-relaxed text-[var(--muted)]">
            {SIGUIENTES.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="text-[var(--dim)]">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--dim)]">
            Origen de los datos ahora mismo: {origen.detalle.toLowerCase()}
            {origen.ingestadoEn ? `, ingestado el ${new Date(origen.ingestadoEn).toLocaleString("es-ES")}` : ""}.
          </p>
        </Panel>
      </div>
    </div>
  );
}
