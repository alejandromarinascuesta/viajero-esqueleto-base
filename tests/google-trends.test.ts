import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularMomentumTrends, conectorGoogleTrends } from "../lib/google-trends";

test("Google Trends calcula cuatro periodos frente a los cuatro anteriores", () => {
  assert.equal(calcularMomentumTrends([10, 10, 10, 10, 15, 15, 15, 15]), 50);
  assert.equal(calcularMomentumTrends([10, 10, 10, 10, 5, 5, 5, 5]), -50);
});

test("Google Trends no inventa momentum con una serie insuficiente", () => {
  assert.equal(calcularMomentumTrends([10, 20, 30]), null);
  assert.equal(calcularMomentumTrends([0, 0, 0, 0, 10, 10, 10, 10]), null);
});

test("sin clave el conector omite la consulta y no crea filas ficticias", async () => {
  const anterior = process.env.SERPAPI_API_KEY;
  const aliasAnterior = process.env.SerpAPI;
  delete process.env.SERPAPI_API_KEY;
  delete process.env.SerpAPI;
  try {
    const resultado = await conectorGoogleTrends([]);
    assert.equal(resultado.consultas, 0);
    assert.deepEqual(resultado.filas, []);
    assert.ok(resultado.omitido?.includes("SerpAPI"));
  } finally {
    if (anterior) process.env.SERPAPI_API_KEY = anterior;
    if (aliasAnterior) process.env.SerpAPI = aliasAnterior;
  }
});
