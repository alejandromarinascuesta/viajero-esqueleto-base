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

test("no tener datos NO puede subir la puntuacion", () => {
  const completo = buscar("Ibiza"); // clima e interes reales
  const sinSenal = buscar("Bali"); // sin interes
  const a = opportunityScore(completo);
  const b = opportunityScore(sinSenal);

  assert.equal(a.confianza, 100);
  assert.ok(b.confianza < 100, "Bali deberia tener confianza incompleta");
  // El ajuste tiene que morder: el score publicado es menor que el que saldria
  // repartiendo el peso sin penalizar.
  assert.ok(b.score < b.scoreSinAjustar, "el score sin ajustar deberia ser mayor");
});

test("con confianza total el score no se penaliza", () => {
  const o = opportunityScore(buscar("Ibiza"));
  assert.equal(o.score, o.scoreSinAjustar);
});
