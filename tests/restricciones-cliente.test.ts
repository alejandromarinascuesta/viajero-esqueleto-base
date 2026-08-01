import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { detectarTopePrecioReferenciado } from "../lib/restricciones-cliente";
import type { Destino } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;

test("una objeción de precio a Ibiza usa el precio real de su ficha como tope", () => {
  const tope = detectarTopePrecioReferenciado(
    "Ibiza me parece muy caro. Busquemos algo más familiar.",
    destinos,
  );
  assert.equal(tope?.destino, "Ibiza");
  assert.equal(tope?.precioMaximoPp, 620);
});

test("no deduce un tope si el cliente solo menciona el destino", () => {
  assert.equal(detectarTopePrecioReferenciado("Le gusta Ibiza y también Creta.", destinos), null);
});
