import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { opportunityScore } from "../lib/scoring";
import type { Destino } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;
const buscar = (d: string) => destinos.find((x) => x.destino === d)!;

test("el score nunca inventa: sin senal, baja la confianza", () => {
  for (const d of destinos) {
    const o = opportunityScore(d);
    assert.ok(o.score >= 0 && o.score <= 100, `${d.destino}: score fuera de rango`);
    assert.ok(o.confianza >= 0 && o.confianza <= 100);
    const faltan = o.componentes.filter((c) => c.valor === null).length;
    assert.equal(o.ausentes.length, faltan);
  }
});

test("un destino con las dos senales externas tiene mas confianza que uno sin ellas", () => {
  const conAmbas = opportunityScore(buscar("Ibiza"));      // clima e interes reales
  const sinNinguna = opportunityScore(buscar("Praga"));    // ninguna de las dos
  assert.ok(conAmbas.confianza > sinNinguna.confianza);
  assert.equal(conAmbas.confianza, 100);
});

test("los componentes ausentes no aportan nada al score", () => {
  const o = opportunityScore(buscar("Praga"));
  for (const c of o.componentes) {
    if (c.valor === null) assert.equal(c.aporta, 0);
  }
});

test("el mismo destino da siempre el mismo score: es determinista", () => {
  const a = opportunityScore(buscar("Creta")).score;
  const b = opportunityScore(buscar("Creta")).score;
  assert.equal(a, b);
});
