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

test("mas senales disponibles, mas confianza", () => {
  const conAmbas = opportunityScore(buscar("Ibiza")); // clima e interes reales
  const peor = destinos.map(opportunityScore).sort((a, b) => a.confianza - b.confianza)[0];
  assert.ok(conAmbas.confianza > peor.confianza);
});

test("el volcado guardado no trae volumen todavia, y se declara como ausente", () => {
  // La metrica de volumen se anadio despues de la ultima ingesta real. No se
  // rellena con nada: aparece como ausente hasta que se vuelva a ingerir.
  const o = opportunityScore(buscar("Ibiza"));
  assert.ok(o.ausentes.includes("Volumen de atención"));
  assert.ok(o.confianza < 100);
});

test("los componentes ausentes no aportan nada al score", () => {
  const o = opportunityScore(destinos.find((d) => opportunityScore(d).ausentes.length > 0)!);
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
  const completo = buscar("Ibiza");
  const sinSenal = destinos.find(
    (d) => !d.senales.some((s) => s.metrica === "tendencia_interes_pct" && s.estado === "ok"),
  )!;
  assert.ok(sinSenal, "deberia haber algun destino sin senal de interes");
  const a = opportunityScore(completo);
  const b = opportunityScore(sinSenal);

  assert.ok(a.confianza > b.confianza, "el que tiene mas senales deberia tener mas confianza");
  // El ajuste tiene que morder: el score publicado es menor que el que saldria
  // repartiendo el peso sin penalizar.
  assert.ok(b.score < b.scoreSinAjustar, "el score sin ajustar deberia ser mayor");
});

test("con confianza total el score no se penaliza", () => {
  // Se construye un destino con todas las metricas para comprobar el limite.
  const completo = {
    ...buscar("Ibiza"),
    senales: [
      { fuente: "interes" as const, metrica: "tendencia_interes_pct", valor: 10, periodo: "2026-08", estado: "ok" as const, obtenidoEn: null },
      { fuente: "interes" as const, metrica: "volumen_atencion_dia", valor: 5000, periodo: "2026-08", estado: "ok" as const, obtenidoEn: null },
      { fuente: "clima" as const, metrica: "temperatura_media", valor: 24, periodo: "2026-08", estado: "ok" as const, obtenidoEn: null },
    ],
  };
  const o = opportunityScore(completo);
  assert.equal(o.confianza, 100);
  assert.equal(o.score, o.scoreSinAjustar);
});

test("una fuente que NO cubre el destino no le resta confianza", () => {
  const base = buscar("Ibiza");
  const conIneNoAplicable = {
    ...base,
    senales: [
      ...base.senales,
      { fuente: "ine" as const, metrica: "variacion_viajeros_pct", valor: null, periodo: "2026-08", estado: "no_aplicable" as const, obtenidoEn: null },
    ],
  };
  assert.equal(
    opportunityScore(conIneNoAplicable).confianza,
    opportunityScore(base).confianza,
    "el INE no aplicable no puede cambiar la confianza",
  );
});

test("cuando hay Google Trends manda Trends, y si no Wikipedia como respaldo", () => {
  const base = buscar("Ibiza");
  const soloWiki = opportunityScore(base);
  const conTrends = opportunityScore({
    ...base,
    senales: [
      ...base.senales,
      { fuente: "trends" as const, metrica: "momentum_busquedas_pct", valor: 45, periodo: "2026-08", estado: "ok" as const, obtenidoEn: null },
    ],
  });
  // Ibiza cae en Wikipedia; con un Trends de +45 el momentum tiene que subir.
  assert.ok(conTrends.componentes.find((c) => c.clave === "momentum")!.valor! >
    soloWiki.componentes.find((c) => c.clave === "momentum")!.valor!);
});
