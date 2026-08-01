import { strict as assert } from "node:assert";
import { test } from "node:test";
import { RETIRADOS } from "../lib/data";
import { ANGULOS, elegirAngulo } from "../lib/content";
import snapshot from "../data/snapshot.json";

const destinos = (snapshot as { destinos: { destino: string }[] }).destinos;

test("el catalogo comercial queda en doce experiencias", () => {
  const activos = destinos.filter((d) => !RETIRADOS.includes(d.destino));
  assert.equal(activos.length, 12);
});

test("retirar no es borrar: el historico sigue en el origen de datos", () => {
  for (const nombre of RETIRADOS) {
    assert.ok(destinos.some((d) => d.destino === nombre), `${nombre} deberia seguir en el snapshot`);
  }
});

test("el catalogo conserva variedad: playa, ciudad, corto y largo radio", () => {
  const activos = destinos.filter((d) => !RETIRADOS.includes(d.destino)).map((d) => d.destino);
  for (const imprescindible of ["Riviera Maya", "Santorini", "Roma", "Sevilla", "Maldivas", "Ibiza"]) {
    assert.ok(activos.includes(imprescindible), `falta ${imprescindible}, que sostiene una regla dura de la demo`);
  }
});

const BRIEF = { objetivo: "Generar solicitudes de presupuesto", tono: "inspirador", duracion: 30 } as const;

test("dos destinos no comparten angulo narrativo en el mismo momento", () => {
  const semilla = 1_754_000_000_000;
  const angulos = new Set(
    ["EXP01", "EXP07", "EXP13", "EXP21"].map((id) => elegirAngulo({ ...BRIEF, destinoId: id }, semilla).id),
  );
  assert.ok(angulos.size > 1, "todas las campanias salian con el mismo recurso narrativo");
});

test("el angulo es uno de los declarados y es estable con el mismo brief", () => {
  const uno = elegirAngulo({ ...BRIEF, destinoId: "EXP13" }, 1_754_000_000_000);
  assert.ok(ANGULOS.some((a) => a.id === uno.id));
  assert.equal(uno.id, elegirAngulo({ ...BRIEF, destinoId: "EXP13" }, 1_754_000_000_000).id);
});
