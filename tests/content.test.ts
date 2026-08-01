import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { contenidoFallback } from "../lib/content";
import type { Destino } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;

test("el contenido de continuidad solo utiliza hechos de la ficha", () => {
  const mallorca = destinos.find((d) => d.destino === "Mallorca")!;
  const plan = contenidoFallback(mallorca, {
    destinationId: mallorca.id,
    objective: "Generar solicitudes de presupuesto",
    tone: "familiar",
    duration: 15,
    visualMix: "video",
  });
  assert.equal(plan.destino, "Mallorca");
  assert.equal(plan.escenas.length, 4);
  assert.deepEqual(plan.hechosUtilizados, mallorca.motivos.slice(0, 3));
  assert.ok(plan.caption.includes("Mallorca"));
});

test("la pieza de treinta segundos admite más escenas sin inventar datos", () => {
  const destino = destinos[0];
  const plan = contenidoFallback(destino, {
    destinationId: destino.id,
    objective: "Inspirar y aumentar notoriedad",
    tone: "inspirador",
    duration: 30,
    visualMix: "mixto",
  });
  assert.ok(plan.escenas.length >= 4 && plan.escenas.length <= 6);
  assert.equal(plan.duracion, 30);
});

test("el rotulo y la locucion nunca dicen lo mismo con las mismas palabras", async () => {
  const { seSolapan } = await import("../lib/content");
  // Prohibido: el rotulo aparece dentro de la locucion.
  assert.equal(seSolapan("Cuarenta playas", "Cuarenta playas para elegir."), true);
  assert.equal(seSolapan("Agosto sin colas", "Agosto sin colas"), true);
  assert.equal(seSolapan("AGOSTO SIN COLAS", "agosto, sin colas."), true);
  // Permitido: dicen lo mismo con otras palabras.
  assert.equal(seSolapan("Cuarenta playas, no una", "Aquí no eliges playa el primer día."), false);
  assert.equal(seSolapan("Dos horas de vuelo", "Sales por la mañana y comes allí."), false);
});

test("el respaldo declara que no puede separar rotulo y voz", async () => {
  const { contenidoFallback, seSolapan } = await import("../lib/content");
  const destino = {
    id: "EXP01", destino: "Creta", pais: "Grecia", tipo: "playa", noches: 7, precioDesdePp: 890,
    motivos: ["Cuarenta playas distintas en una sola isla", "Se come bien y barato fuera de la costa", "Historia minoica a media hora del hotel"],
  } as never;
  const plan = contenidoFallback(destino, {
    destinationId: "EXP01", objective: "Generar solicitudes de presupuesto",
    tone: "inspirador", duration: 30, visualMix: "video",
  } as never);
  // Apertura y cierre si se separan: ahi hay lenguaje propio que no afirma nada.
  assert.equal(seSolapan(plan.escenas[0].textoPantalla, plan.escenas[0].locucion), false);
  assert.equal(seSolapan(plan.escenas.at(-1)!.textoPantalla, plan.escenas.at(-1)!.locucion), false);
  // En las centrales solo puede acortar el motivo, y lo dice en vez de callarlo.
  assert.ok(plan.advertencias.some((a) => a.includes("rótulo")), "el respaldo deberia declarar su limitacion");
});

test("el hook del respaldo sigue siendo una pregunta", async () => {
  const { contenidoFallback } = await import("../lib/content");
  const destino = { id: "EXP07", destino: "Sevilla", pais: "España", tipo: "ciudad", noches: 3, precioDesdePp: 420, motivos: ["Se anda entera"] } as never;
  const plan = contenidoFallback(destino, { destinationId: "EXP07", objective: "Inspirar y aumentar notoriedad", tone: "premium", duration: 15, visualMix: "fotos" } as never);
  assert.ok(plan.hook.includes("?"), plan.hook);
});

test("dos objetivos distintos dan piezas distintas", async () => {
  const { elegirAngulo } = await import("../lib/content");
  const semilla = 1_754_000_000_000;
  const base = { destinoId: "EXP01", tono: "inspirador", duracion: 30 } as const;
  const a = elegirAngulo({ ...base, objetivo: "Generar solicitudes de presupuesto" }, semilla);
  const b = elegirAngulo({ ...base, objetivo: "Inspirar y aumentar notoriedad" }, semilla);
  assert.notEqual(a.id, b.id, "cambiar el objetivo devolvia la misma pieza");
});

test("cambiar el tono o la duracion tambien cambia la pieza", async () => {
  const { elegirAngulo } = await import("../lib/content");
  const semilla = 1_754_000_000_000;
  const base = { destinoId: "EXP01", objetivo: "Generar solicitudes de presupuesto", tono: "inspirador", duracion: 30 } as const;
  assert.notEqual(elegirAngulo(base, semilla).id, elegirAngulo({ ...base, tono: "premium" }, semilla).id);
  assert.notEqual(elegirAngulo(base, semilla).id, elegirAngulo({ ...base, duracion: 15 }, semilla).id);
});
