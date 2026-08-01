import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { BASE_SUPUESTA, MINIMO_OBSERVACIONES, estimarConversion } from "../lib/conversion";
import type { Destino, Perfil } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;
const buscar = (d: string) => destinos.find((x) => x.destino === d)!;

const perfil: Perfil = {
  adultos: 2, edadesNinos: [], presupuestoTotal: 4000, presupuestoFlexible: false,
  mes: 8, dias: 7, motivacion: "descanso", intensidad: 2,
  restricciones: [], destinosVisitados: [], tensionDeclarada: "",
};

test("sin historico suficiente la estimacion se declara como supuesta", () => {
  const c = estimarConversion(buscar("Creta"), perfil, 0.7);
  assert.equal(c.empirica, false);
  assert.equal(c.base, BASE_SUPUESTA);
  assert.equal(c.observaciones, 0);
  assert.ok(c.explicacion.includes("supuesta"));
});

test("con historico suficiente la base pasa a ser la tasa real", () => {
  const c = estimarConversion(buscar("Creta"), perfil, 0.7, { decididas: 120, reservadas: 36 });
  assert.equal(c.empirica, true);
  assert.equal(c.base, 0.3);
  assert.ok(c.explicacion.includes("empírica"));
});

test("una muestra pequena NO se usa como base", () => {
  const c = estimarConversion(buscar("Creta"), perfil, 0.7, {
    decididas: MINIMO_OBSERVACIONES - 1,
    reservadas: 20,
  });
  assert.equal(c.empirica, false, "por debajo del minimo no puede ser empirica");
  assert.equal(c.base, BASE_SUPUESTA);
});

test("mejor encaje sube la probabilidad, peor encaje la baja", () => {
  const alto = estimarConversion(buscar("Creta"), perfil, 0.9).probabilidad;
  const bajo = estimarConversion(buscar("Creta"), perfil, 0.1).probabilidad;
  assert.ok(alto > bajo);
});

test("un precio pegado al techo del cliente baja la probabilidad", () => {
  const d = buscar("Creta");
  const holgado = estimarConversion(d, { ...perfil, presupuestoTotal: 6000 }, 0.7).probabilidad;
  const justo = estimarConversion(d, { ...perfil, presupuestoTotal: d.precioDesdePp * 2 }, 0.7).probabilidad;
  assert.ok(holgado > justo);
});

test("cada ajuste viene con su nombre y su porque: nada es una caja negra", () => {
  const c = estimarConversion(buscar("Maldivas"), { ...perfil, destinosVisitados: ["Maldivas"] }, 0.5);
  assert.ok(c.ajustes.length > 0);
  for (const a of c.ajustes) {
    assert.ok(a.nombre.length > 0 && a.porque.length > 0);
    assert.ok(Number.isFinite(a.factor));
  }
});

test("la probabilidad nunca se sale de un rango creible", () => {
  for (const d of destinos) {
    const c = estimarConversion(d, perfil, 1);
    assert.ok(c.probabilidad >= 0.03 && c.probabilidad <= 0.6, d.destino);
  }
});
