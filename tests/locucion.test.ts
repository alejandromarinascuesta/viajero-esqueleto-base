import { strict as assert } from "node:assert";
import { test } from "node:test";
import { guionHablado, velocidadPara, vozValida } from "../lib/locucion";

test("el guion hablado une las escenas con una pausa y limpia espacios", () => {
  assert.equal(
    guionHablado(["  Creta   no es   una playa. ", "", "Son cuarenta."]),
    "Creta no es una playa. … Son cuarenta.",
  );
});

test("una voz desconocida cae a la voz por defecto en vez de romper la peticion", () => {
  assert.equal(vozValida("nova"), "nova");
  assert.equal(vozValida("onyx"), "onyx");
  assert.equal(vozValida("cualquiera"), "nova");
  assert.equal(vozValida(undefined), "nova");
});

test("si el texto cabe en la pieza no se acelera la voz", () => {
  assert.equal(velocidadPara("a".repeat(200), 30), 1);
});

test("un guion largo se acelera, pero nunca por encima de 1,25", () => {
  assert.ok(velocidadPara("a".repeat(600), 30) > 1);
  assert.equal(velocidadPara("a".repeat(5000), 15), 1.25);
});

test("la clave de Anthropic no vale para sintetizar voz", async () => {
  process.env.OPENAI_API_KEY = "sk-ant-loquesea";
  const { claveVoz } = await import("../lib/locucion");
  assert.equal(claveVoz(), null);
  delete process.env.OPENAI_API_KEY;
});
