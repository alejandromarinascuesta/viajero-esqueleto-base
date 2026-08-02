import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calcularCoste, nuevaTraza, registrar } from "../lib/observabilidad";
import { dentroDelLimite } from "../lib/limite";

test("el coste sale en euros a partir de los tokens", () => {
  // 1M de entrada y 1M de salida a la tarifa de Sonnet
  const c = calcularCoste("claude-sonnet-4-5", 1_000_000, 1_000_000, null);
  assert.equal(Number(c.toFixed(2)), 16.8);
});

test("una llamada tipica de argumento cuesta centimos, no euros", () => {
  const c = calcularCoste("claude-sonnet-4-5", 2_500, 700, null);
  assert.ok(c < 0.02, `deberia costar menos de dos centimos, cuesta ${c}`);
  assert.ok(c > 0, "y no puede ser cero");
});

test("la voz se factura por caracteres, no por tokens", () => {
  const c = calcularCoste("gpt-4o-mini-tts", null, null, 600);
  assert.ok(c > 0 && c < 0.02);
});

test("un modelo desconocido no rompe el calculo", () => {
  assert.ok(calcularCoste("modelo-inventado-7", 1000, 1000, null) > 0);
});

test("cada traza es distinta", () => {
  const trazas = new Set(Array.from({ length: 50 }, () => nuevaTraza()));
  assert.equal(trazas.size, 50);
});

test("el limite corta a partir del maximo y no antes", () => {
  const clave = `prueba-${Math.random()}`;
  for (let i = 0; i < 5; i += 1) {
    assert.equal(dentroDelLimite(clave, 5, 60_000).permitido, true, `la peticion ${i + 1} deberia pasar`);
  }
  const sexta = dentroDelLimite(clave, 5, 60_000);
  assert.equal(sexta.permitido, false);
  assert.ok(sexta.esperaMs > 0);
});

test("origenes distintos no se estorban entre si", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  dentroDelLimite(a, 1, 60_000);
  assert.equal(dentroDelLimite(a, 1, 60_000).permitido, false);
  assert.equal(dentroDelLimite(b, 1, 60_000).permitido, true);
});

test("registrar devuelve el coste calculado y no revienta sin base de datos", async () => {
  delete process.env.SUPABASE_URL;
  const c = await registrar({
    traza: nuevaTraza(), tipo: "argumento", modelo: "claude-sonnet-4-5",
    ok: true, ms: 1200, tokensEntrada: 2500, tokensSalida: 700,
    caracteres: null, error: null,
  });
  assert.ok(c.coste > 0);
  assert.ok(c.momento.includes("T"));
});
