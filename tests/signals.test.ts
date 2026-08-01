import assert from "node:assert/strict";
import { test } from "node:test";
import { senalMasReciente, senalMomentum, senalesActuales } from "../lib/signals";
import type { Senal } from "../types";

const wikiAntigua: Senal = {
  fuente: "interes",
  metrica: "tendencia_interes_pct",
  valor: -23.1,
  periodo: "2026-07",
  estado: "ok",
  obtenidoEn: "2026-07-30T08:00:00Z",
};

const wikiNueva: Senal = {
  ...wikiAntigua,
  valor: -11.3,
  periodo: "2026-08",
  obtenidoEn: "2026-08-01T08:00:00Z",
};

test("elige la observacion mas reciente aunque Supabase la devuelva despues", () => {
  assert.equal(
    senalMasReciente([wikiAntigua, wikiNueva], "tendencia_interes_pct")?.valor,
    -11.3,
  );
});

test("Google Trends tiene prioridad sobre Wikimedia aunque Wikimedia sea mas reciente", () => {
  const trends: Senal = {
    fuente: "trends",
    metrica: "momentum_busquedas_pct",
    valor: 36.4,
    periodo: "2026-07",
    estado: "ok",
    obtenidoEn: "2026-07-31T08:00:00Z",
  };

  assert.equal(senalMomentum({ senales: [wikiNueva, trends] })?.fuente, "trends");
  assert.equal(senalMomentum({ senales: [wikiNueva, trends] })?.valor, 36.4);
});

test("sin Trends se usa la ultima observacion de Wikimedia", () => {
  assert.equal(senalMomentum({ senales: [wikiAntigua, wikiNueva] })?.valor, -11.3);
});

test("la procedencia muestra una sola observacion actual por fuente y metrica", () => {
  const actuales = senalesActuales([wikiAntigua, wikiNueva]);
  assert.equal(actuales.length, 1);
  assert.equal(actuales[0].valor, -11.3);
});
