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

test("si el texto cabe justo, se lee a velocidad normal", () => {
  // 30 s de hueco util son 351 caracteres a ritmo comodo.
  assert.equal(velocidadPara("a".repeat(340), 30), 1);
});

test("un guion largo se acelera, pero nunca por encima de 1,12", () => {
  assert.ok(velocidadPara("a".repeat(600), 30) > 1);
  assert.equal(velocidadPara("a".repeat(5000), 15), 1.12);
});

test("la clave de Anthropic no vale para sintetizar voz", async () => {
  process.env.OPENAI_API_KEY = "sk-ant-loquesea";
  const { claveVoz } = await import("../lib/locucion");
  assert.equal(claveVoz(), null);
  delete process.env.OPENAI_API_KEY;
});

test("un guion que cabe holgado se lee despacio, no acelerado", () => {
  // Antes esto devolvia 1,25 casi siempre y por eso la voz sonaba a maquina.
  assert.equal(velocidadPara("a".repeat(250), 30), 0.94);
  assert.ok(velocidadPara("a".repeat(600), 30) <= 1.12);
});

test("el recorte respeta el final de frase y no parte palabras", async () => {
  const { recortarAlPresupuesto } = await import("../lib/locucion");
  const largo = "Creta no es una playa, son cuarenta. Cada una con su propia arena y su propio color de agua, y ninguna se parece a la anterior aunque esten a diez minutos.";
  // Cuatro lineas reparten el presupuesto, que es el caso real de una pieza.
  const [salida] = recortarAlPresupuesto([largo, largo, largo, largo], 30);
  assert.ok(salida.length < largo.length);
  assert.ok(!salida.endsWith(" "));
  assert.ok(/[.?!]$/.test(salida), `deberia acabar en signo: ${salida}`);
});

test("lo que ya cabe no se toca", async () => {
  const { recortarAlPresupuesto } = await import("../lib/locucion");
  assert.deepEqual(recortarAlPresupuesto(["Dos noches en Roma."], 30), ["Dos noches en Roma."]);
});

test("dos destinos distintos no reciben la misma voz", async () => {
  const { vozPara } = await import("../lib/locucion");
  const voces = new Set(["EXP01", "EXP07", "EXP13", "EXP21", "EXP28"].map((id) => vozPara("inspirador", id)));
  assert.ok(voces.size > 1, "todas las piezas sonaban con la misma voz");
});

test("la voz es estable para la misma pieza: al re-renderizar suena igual", async () => {
  const { vozPara } = await import("../lib/locucion");
  assert.equal(vozPara("premium", "EXP13detalle"), vozPara("premium", "EXP13detalle"));
});
