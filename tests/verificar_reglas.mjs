// Verificación de las reglas duras contra los 10 perfiles de prueba.
// Los perfiles y sus resultados esperados se escribieron ANTES que el motor.
//
//   node tests/verificar_reglas.mjs
//
// Refleja los dos niveles de src/lib/recomendador/motor.ts:
//   RELAJABLES  presupuesto, noches, temporada, desaconsejado en julio/agosto
//   INVIOLABLES vuelo largo con menores, restricciones declaradas, apto_ninos,
//               cupo y visado
// Cuando ninguna experiencia sobrevive, el sistema solo puede proponer las que
// incumplen reglas relajables. Las inviolables no se negocian nunca.
//
// Lee el catálogo de Supabase si hay credenciales; si no, del CSV local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_SB = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY_SB =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

// ---------------------------------------------------------------- catálogo

async function cargarCatalogo() {
  if (URL_SB && KEY_SB) {
    const r = await fetch(`${URL_SB}/rest/v1/experiencias?select=*`, {
      headers: { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}` },
    });
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}: ${await r.text()}`);
    return { origen: "supabase", filas: await r.json() };
  }
  const csv = readFileSync(join(AQUI, "../data/catalogo_experiencias.csv"), "utf8")
    .trim()
    .split("\n");
  const cab = csv[0].split(",");
  const filas = csv.slice(1).map((l) => {
    const c = l.split(",");
    return Object.fromEntries(cab.map((k, i) => [k, c[i]]));
  });
  return { origen: "csv", filas };
}

// ------------------------------------------------------------ reglas duras

const norm = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function enTemporada(rango, mes) {
  const [a, b] = (rango ?? "").split("-").map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || a > 12 || b < 1 || b > 12) {
    return false; // ante la duda, la regla dura descarta
  }
  return a <= b ? mes >= a && mes <= b : mes >= a || mes <= b;
}

export function reglasDuras(exp, p) {
  const relajables = [];
  const inviolables = [];
  const pax = p.adultos + p.ninos.length;
  const tope = (p.presupuesto_total / pax) * (p.flexible ? 1.1 : 1);
  const precio = Number(exp.precio_desde_pp);
  const veto = norm(exp.no_recomendado_si);

  if (precio > tope) relajables.push(`precio: ${Math.round((precio - tope) * pax)} € por encima`);
  if (Number(exp.noches) > p.dias)
    relajables.push(`duración: ${exp.noches} noches con ${p.dias} días`);
  if (!enTemporada(exp.temporada_agencia, p.mes))
    relajables.push(`fuera de temporada (${exp.temporada_agencia})`);
  if (veto.includes("julio y agosto") && [7, 8].includes(p.mes))
    relajables.push("desaconsejado en julio y agosto");

  if (p.ninos.length && Math.min(...p.ninos) < 6 && Number(exp.horas_vuelo) > 6)
    inviolables.push(`vuelo de ${exp.horas_vuelo} h con un menor de 6 años`);
  if (p.restricciones.includes("no vuelos largos") && Number(exp.horas_vuelo) > 4)
    inviolables.push(`vuelo de ${exp.horas_vuelo} h con «no vuelos largos»`);
  for (const r of p.restricciones) {
    if (r === "no vuelos largos") continue;
    if (veto.includes(norm(r))) inviolables.push(`restricción: ${r}`);
  }
  if (p.ninos.length && norm(exp.apto_ninos) === "bajo") inviolables.push("no apto para niños");
  if (Number(exp.cupo) === 0) inviolables.push("sin cupo");

  return { relajables, inviolables };
}

// ------------------------------------------------------------------ pruebas
// Lo que el sistema NUNCA debe proponer. Importa más que los positivos: un
// fallo aquí es una venta que acaba en reclamación.
//
// nivel 'inviolable' = no se puede proponer ni como "lo más cercano"
// nivel 'relajable'  = solo aparece si no hay ninguna alternativa, con aviso

const NEGATIVOS = [
  ["P06", "EXP21", "Riviera Maya a una familia con un bebé de 2 años", "inviolable"],
  ["P04", "EXP09", "Lisboa a alguien con movilidad reducida", "inviolable"],
  ["P01", "EXP13", "Santorini a una familia con niños", "inviolable"],
  ["P05", "EXP02", "Ibiza a un grupo de amigos sin niños", "permitido"],
  ["P07", "EXP28", "Maldivas a una pareja con 1.400 €", "relajable"],
  ["P10", "EXP10", "Roma en agosto", "relajable"],
  ["P10", "EXP07", "Sevilla en agosto", "relajable"],
];

const v = (s) => `\x1b[32m${s}\x1b[0m`;
const x = (s) => `\x1b[31m${s}\x1b[0m`;

const { origen, filas } = await cargarCatalogo();
const cat = Object.fromEntries(filas.map((e) => [e.id, e]));
const perfiles = JSON.parse(readFileSync(join(AQUI, "../data/perfiles_test.json"), "utf8"));
const porId = Object.fromEntries(perfiles.map((p) => [p.id, p]));

console.log(`\ncatálogo: ${filas.length} experiencias (${origen})\n`);
let fallos = 0;

console.log("1 · Los destinos esperados sobreviven a todas las reglas\n");
for (const p of perfiles) {
  const vivos = filas
    .filter((e) => {
      const r = reglasDuras(e, p.perfil);
      return r.relajables.length === 0 && r.inviolables.length === 0;
    })
    .map((e) => e.id);
  const ko = p.espera.filter((e) => !vivos.includes(e));
  if (ko.length) fallos++;
  console.log(
    `  ${ko.length ? x("FALLA") : v("  OK ")}  ${p.id}  ${p.titulo.padEnd(44)}` +
      `${String(vivos.length).padStart(2)}/${filas.length} sobreviven` +
      (ko.length ? `   → falta ${ko.join(", ")}` : ""),
  );
}

console.log("\n2 · Los destinos prohibidos se descartan, en el nivel correcto\n");
for (const [pid, eid, desc, nivel] of NEGATIVOS) {
  const { relajables, inviolables } = reglasDuras(cat[eid], porId[pid].perfil);
  let ok, detalle;
  if (nivel === "inviolable") {
    ok = inviolables.length > 0;
    detalle = ok ? inviolables.join(" · ") : "NO SE DESCARTÓ COMO INVIOLABLE";
  } else if (nivel === "relajable") {
    ok = inviolables.length === 0 && relajables.length > 0;
    detalle = ok
      ? `${relajables.join(" · ")}  (proponible solo si no hay alternativa)`
      : inviolables.length
        ? `marcado inviolable cuando debería ser relajable: ${inviolables.join(" · ")}`
        : "NO SE DESCARTÓ";
  } else {
    ok = relajables.length === 0 && inviolables.length === 0;
    detalle = ok
      ? "admitido, como debe ser"
      : `descartado indebidamente: ${[...relajables, ...inviolables].join(" · ")}`;
  }
  if (!ok) fallos++;
  console.log(`  ${ok ? v("  OK ") : x("FALLA")}  ${desc.padEnd(50)}${detalle}`);
}

const total = perfiles.length + NEGATIVOS.length;
console.log(
  fallos === 0
    ? v(`\n${total} pruebas, 0 fallos\n`)
    : x(`\n${total} pruebas, ${fallos} fallidas\n`),
);
process.exit(fallos === 0 ? 0 : 1);
