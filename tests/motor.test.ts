import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { recomendar, evaluarReglas } from "../lib/motor";
import type { Destino, Perfil } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;

const perfil = (p: Partial<Perfil>): Perfil => ({
  adultos: 2, edadesNinos: [], presupuestoTotal: 3500, presupuestoFlexible: false,
  mes: 8, dias: 7, motivacion: "descanso", intensidad: 2,
  restricciones: [], destinosVisitados: [], tensionDeclarada: "", ...p,
});

const buscar = (destino: string) => destinos.find((d) => d.destino === destino)!;

test("el catalogo esta completo y dentro de rango", () => {
  assert.equal(destinos.length, 30);
  for (const d of destinos) {
    assert.ok(d.intensidad >= 1 && d.intensidad <= 5, `${d.destino}: intensidad fuera de escala`);
    assert.ok(d.precioDesdePp > 0 && d.margenPct > 0);
    assert.ok(["alto", "medio", "bajo"].includes(d.aptoNinos));
  }
});

test("una familia con ninos de 5 y 8 y 3.500 euros en agosto deja 10 supervivientes", () => {
  const r = recomendar(destinos, perfil({ edadesNinos: [5, 8] }));
  assert.equal(r.supervivientes, 10);
  assert.equal(r.propuestas.length, 2);
});

test("la Riviera Maya NO se propone a una familia con un bebe de 2 anos", () => {
  const p = perfil({ edadesNinos: [2, 6], presupuestoTotal: 8000, mes: 7, dias: 10 });
  const e = evaluarReglas(buscar("Riviera Maya"), p, 4);
  assert.ok(e.inviolables.some((i) => i.includes("menor de 6")), "el vuelo largo con menores es inviolable");

  const r = recomendar(destinos, p);
  assert.ok(!r.propuestas.some((x) => x.destino === "Riviera Maya"));
});

test("Santorini no se propone a una familia con ninos: es inviolable, no negociable", () => {
  const e = evaluarReglas(buscar("Santorini"), perfil({ edadesNinos: [5, 8] }), 4);
  assert.ok(e.inviolables.includes("no apto para niños"));
});

test("Lisboa no se propone a alguien con movilidad reducida", () => {
  const e = evaluarReglas(buscar("Lisboa"), perfil({ restricciones: ["movilidad reducida"] }), 2);
  assert.ok(e.inviolables.length > 0);
});

test("Roma en agosto es relajable, no inviolable: se puede vender avisando", () => {
  const e = evaluarReglas(buscar("Roma"), perfil({ mes: 8 }), 2);
  assert.equal(e.inviolables.length, 0);
  assert.ok(e.relajables.length > 0);
});

test("Ibiza SI se propone a un grupo de amigos sin ninos", () => {
  const e = evaluarReglas(buscar("Ibiza"), perfil({ adultos: 4, presupuestoTotal: 3200, mes: 7, dias: 5 }), 4);
  assert.equal(e.inviolables.length, 0);
  assert.equal(e.relajables.length, 0);
});

test("cuando nada cumple, solo se proponen las que incumplen reglas relajables", () => {
  const r = recomendar(destinos, perfil({ presupuestoTotal: 400, mes: 8, dias: 3 }));
  assert.ok(r.modo === "sin_supervivientes" || r.modo === "sin_opciones");
  for (const p of r.propuestas) {
    const d = destinos.find((x) => x.id === p.id)!;
    assert.equal(evaluarReglas(d, perfil({ presupuestoTotal: 400, mes: 8, dias: 3 }), 2).inviolables.length, 0);
  }
});

test("una temporada mal formada descarta: ante la duda, la regla dura corta", () => {
  const roto: Destino = { ...buscar("Creta"), temporada: "sin datos" };
  const e = evaluarReglas(roto, perfil({}), 2);
  assert.ok(e.relajables.some((r) => r.includes("fuera de temporada")));
});
