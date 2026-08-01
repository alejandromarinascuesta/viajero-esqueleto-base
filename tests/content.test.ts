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
    audience: "Familias con niños",
    objective: "Generar solicitudes de presupuesto",
    tone: "familiar",
    duration: 15,
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
    audience: "Parejas",
    objective: "Inspirar",
    tone: "inspirador",
    duration: 30,
  });
  assert.ok(plan.escenas.length >= 4 && plan.escenas.length <= 6);
  assert.equal(plan.duracion, 30);
});
