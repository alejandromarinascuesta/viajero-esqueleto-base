import assert from "node:assert/strict";
import { test } from "node:test";
import { emparejar, limpiarTermino, parsearTrends } from "../lib/trends";

// Formato real de una exportacion de «Interés a lo largo del tiempo».
const CSV = `Categoría: Todas las categorías

Semana,viajar a Mallorca: (España),viajar a Creta: (España),viajar a Praga: (España)
2026-05-03,40,20,30
2026-05-10,42,22,28
2026-05-17,38,18,32
2026-05-24,44,20,30
2026-05-31,60,21,15
2026-06-07,64,19,16
2026-06-14,58,20,14
2026-06-21,62,20,15
`;

test("parsea la cabecera y los tres terminos", () => {
  const r = parsearTrends(CSV);
  assert.equal(r.error, null);
  assert.equal(r.series.length, 3);
  assert.deepEqual(
    r.series.map((s) => s.termino),
    ["viajar a Mallorca", "viajar a Creta", "viajar a Praga"],
  );
});

test("calcula el momentum como cuatro semanas frente a las cuatro anteriores", () => {
  const r = parsearTrends(CSV);
  const mallorca = r.series.find((s) => s.termino.includes("Mallorca"))!;
  // (61 - 41) / 41 = +48,8 %
  assert.equal(mallorca.momentum, 48.8);
  const praga = r.series.find((s) => s.termino.includes("Praga"))!;
  assert.ok(praga.momentum !== null && praga.momentum < 0, "Praga cae");
});

test("una serie corta no da momentum y dice por que", () => {
  const corto = "Semana,viajar a Roma: (España)\n2026-06-07,10\n2026-06-14,20\n";
  const r = parsearTrends(corto);
  assert.equal(r.series[0].momentum, null);
  assert.ok(r.series[0].motivo?.includes("8"));
});

test("rechaza un archivo que no es de interes a lo largo del tiempo", () => {
  const r = parsearTrends("Región,viajar a Roma\nMadrid,100\n");
  assert.ok(r.error);
  assert.equal(r.series.length, 0);
});

test("limpia el sufijo de region del termino", () => {
  assert.equal(limpiarTermino("viajar a Mallorca: (España)"), "viajar a Mallorca");
  assert.equal(limpiarTermino('"viajar a Creta: (Spain)"'), "viajar a Creta");
});

test("empareja cada termino con su destino, y declara los que no casan", () => {
  const r = parsearTrends(CSV);
  const destinos = [
    { id: "EXP01", destino: "Mallorca" },
    { id: "EXP14", destino: "Creta" },
    { id: "EXP15", destino: "Praga" },
    { id: "EXP10", destino: "Roma" },
  ];
  const pares = emparejar(r.series, destinos);
  assert.deepEqual(pares.map((p) => p.destinoId), ["EXP01", "EXP14", "EXP15"]);

  const sinCasar = emparejar(
    parsearTrends("Semana,viajar barato\n2026-06-07,10\n").series,
    destinos,
  );
  assert.equal(sinCasar[0].destinoId, null);
});
