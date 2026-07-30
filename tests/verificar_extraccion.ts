// El copiloto tiene que funcionar sin clave de modelo. Estas pruebas cubren el
// extractor determinista, que es el suelo del sistema.
//
//   npx esbuild tests/verificar_extraccion.ts --bundle --platform=node \
//     --format=esm --outfile=/tmp/e.mjs && node /tmp/e.mjs

import { extraerPerfilDeterminista } from "../src/lib/recomendador/extraccion";

type Esperado = Partial<{
  adultos: number;
  ninos: number[];
  presupuesto_total: number;
  mes: number;
  dias: number;
  motivacion: string;
  restricciones: string[];
  tension: boolean;
  presupuesto_es_por_persona: boolean | null;
}>;

const casos: [string, string, Esperado][] = [
  [
    "familia clasica de agosto",
    "Pareja de 45 con dos niños de 5 y 8. Unos 3.500 en total, primera quincena de agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.",
    {
      adultos: 2,
      ninos: [5, 8],
      presupuesto_total: 3500,
      mes: 8,
      dias: 7,
      motivacion: "descanso",
      presupuesto_es_por_persona: false,
      tension: true,
    },
  ],
  [
    "jubilados con movilidad reducida",
    "Matrimonio jubilado, ella con problemas de rodilla, no puede con cuestas ni caminatas largas. 3.000 los dos, mayo, ocho días. Les gusta la cultura y comer bien.",
    {
      adultos: 2,
      ninos: [],
      presupuesto_total: 3000,
      mes: 5,
      dias: 8,
      motivacion: "cultura",
      restricciones: ["movilidad reducida"],
    },
  ],
  [
    "grupo de amigos",
    "Cuatro amigos de 30, julio, cinco días. Unos 800 cada uno. Quieren ambiente y salir de noche.",
    {
      adultos: 4,
      ninos: [],
      presupuesto_total: 800,
      mes: 7,
      dias: 5,
      presupuesto_es_por_persona: true,
    },
  ],
  [
    "luna de miel",
    "Se casan en octubre. Viaje en noviembre, 8 días. Presupuesto 6.000 los dos, quieren algo romántico y tranquilo.",
    {
      adultos: 2,
      presupuesto_total: 6000,
      mes: 11,
      dias: 8,
      motivacion: "romantico",
      presupuesto_es_por_persona: false,
    },
  ],
  [
    "familia con bebe",
    "Familia con un niño de 2 y otro de 6. Tienen 8.000 y quieren la Riviera Maya en julio. Diez días.",
    { ninos: [2, 6], presupuesto_total: 8000, mes: 7, dias: 10 },
  ],
];

const v = (s: string) => `\x1b[32m${s}\x1b[0m`;
const x = (s: string) => `\x1b[31m${s}\x1b[0m`;
let fallos = 0;

for (const [nombre, notas, esperado] of casos) {
  const r = extraerPerfilDeterminista(notas);
  const errores: string[] = [];
  for (const [campo, valor] of Object.entries(esperado)) {
    if (campo === "tension") {
      if ((r.tension !== null) !== valor)
        errores.push(`tension=${r.tension === null ? "no detectada" : "detectada"}`);
      continue;
    }
    const obtenido = (r as unknown as Record<string, unknown>)[campo];
    const iguales = JSON.stringify(obtenido) === JSON.stringify(valor);
    if (!iguales)
      errores.push(
        `${campo}: esperaba ${JSON.stringify(valor)}, obtuve ${JSON.stringify(obtenido)}`,
      );
  }
  if (errores.length) fallos++;
  console.log(
    `  ${errores.length ? x("FALLA") : v("  OK ")}  ${nombre.padEnd(32)}${errores.join(" · ")}`,
  );
}

console.log(fallos === 0 ? v(`\n${casos.length} casos, 0 fallos\n`) : x(`\n${fallos} fallos\n`));
process.exit(fallos === 0 ? 0 : 1);
