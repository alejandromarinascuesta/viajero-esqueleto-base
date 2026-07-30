"use client";

import type { OrigenDatos } from "@/lib/data";
import { Panel } from "@/components/ui";

const CAPAS = [
  {
    nombre: "Experiencia",
    piezas: ["Overview", "Radar de demanda", "Destino 360", "Copiloto"],
    nota: "Lo que ve el agente y la dirección",
  },
  {
    nombre: "Producto",
    piezas: ["Opportunity Score", "Reglas duras en dos niveles", "Pesos comerciales", "Verificación del argumento"],
    nota: "El criterio de la agencia, hecho código. Determinista",
  },
  {
    nombre: "Inteligencia",
    piezas: ["Extracción determinista", "Modelo de lenguaje (opcional)", "Señales de demanda", "Clima"],
    nota: "La IA solo lee texto libre y redacta. Nunca decide",
  },
  {
    nombre: "Plataforma",
    piezas: ["Next.js", "Vercel", "Postgres", "Caché e ingesta en lote"],
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
