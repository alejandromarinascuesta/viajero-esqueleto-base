// La accion recomendada de cada destino sale de umbrales explicitos, no de una
// interpretacion. Estas pruebas fijan esos umbrales: si alguien los cambia sin
// querer, se entera aqui.
//
//   npx esbuild tests/verificar_acciones.ts --bundle --platform=node \
//     --format=esm --outfile=/tmp/ac.mjs && node /tmp/ac.mjs

import { accionRecomendada, pulso } from "../src/lib/recomendador/temperatura";

const base = { destino: "Creta", cupo: 20, margenPct: 20, temporada: "5-10", fuentesFaltantes: [] };
const v = (s: string) => `\x1b[32m${s}\x1b[0m`;
const x = (s: string) => `\x1b[31m${s}\x1b[0m`;
let fallos = 0;

const casos: [string, () => boolean, string][] = [
  [
    "+40% con cupo alto -> empujar",
    () => accionRecomendada({ ...base, tendenciaInteres: 40 }, 7).titulo === "Empujar ahora",
    "empuja cuando sube y hay plazas",
  ],
  [
    "+40% con cupo bajo -> subir precio",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: 40, cupo: 6 }, 7).titulo ===
      "Subir precio antes que promocionar",
    "no regala margen si la demanda ya esta",
  ],
  [
    "-40% con cupo alto -> revisar",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: -40 }, 7).titulo ===
      "Revisar precio o retirar de campaña",
    "deja de invertir en lo que cae",
  ],
  [
    "fuera de temporada manda sobre todo",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: 90 }, 1).titulo === "No promocionar este mes",
    "no promociona lo que el motor descarta",
  ],
  [
    "sin senal -> refrescar",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: null }, 7).titulo === "Refrescar las fuentes",
    "no inventa consejo sin dato",
  ],
  [
    "cupo muy bajo -> liquidar",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: 0, cupo: 5 }, 7).titulo === "Liquidar cupo",
    "prioriza vaciar cupo",
  ],
  [
    "margen alto -> candidato a campana",
    () =>
      accionRecomendada({ ...base, tendenciaInteres: 0, margenPct: 28 }, 7).titulo ===
      "Buen candidato para campaña",
    "donde mas renta cada venta",
  ],
  ["pulso: 30% disparado", () => pulso(30).icono === "🔥", ""],
  ["pulso: 0% estable", () => pulso(0).icono === "😐", ""],
  ["pulso: -30% enfriandose", () => pulso(-30).icono === "🥶", ""],
  ["pulso: sin dato", () => pulso(null).tono === "sin-dato", ""],
];

for (const [nombre, prueba, porque] of casos) {
  let ok = false;
  try {
    ok = prueba();
  } catch {
    ok = false;
  }
  if (!ok) fallos++;
  console.log(`  ${ok ? v("  OK ") : x("FALLA")}  ${nombre.padEnd(42)}${porque}`);
}
console.log(fallos === 0 ? v(`\n${casos.length} casos, 0 fallos\n`) : x(`\n${fallos} fallos\n`));
process.exit(fallos === 0 ? 0 : 1);
