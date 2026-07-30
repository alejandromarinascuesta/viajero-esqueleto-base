import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../data/snapshot.json";
import { PESOS_POR_DEFECTO, evaluarReglas, recomendar } from "../lib/motor";
import type { Destino, Perfil } from "../types";

const destinos = (snapshot as unknown as { destinos: Destino[] }).destinos;
const buscar = (d: string) => destinos.find((x) => x.destino === d)!;

const perfil: Perfil = {
  adultos: 2, edadesNinos: [], presupuestoTotal: 4000, presupuestoFlexible: false,
  mes: 8, dias: 7, motivacion: "descanso", intensidad: 2,
  restricciones: [], destinosVisitados: [], tensionDeclarada: "",
};

test("un veto de la direccion es inviolable: el destino no aparece nunca", () => {
  const creta = buscar("Creta");
  const sinVeto = recomendar(destinos, perfil);
  assert.ok(sinVeto.supervivientes > 0);

  const vetos = [{ destinoId: creta.id, mes: null, motivo: "prueba" }];
  const e = evaluarReglas(creta, perfil, 2, vetos);
  assert.ok(e.inviolables.some((i) => i.includes("veto comercial")));

  const conVeto = recomendar(destinos, perfil, { vetos });
  assert.ok(!conVeto.propuestas.some((p) => p.id === creta.id));
});

test("un veto solo aplica en el mes indicado", () => {
  const creta = buscar("Creta");
  const vetos = [{ destinoId: creta.id, mes: 12, motivo: "solo diciembre" }];
  assert.equal(evaluarReglas(creta, { ...perfil, mes: 8 }, 2, vetos).inviolables.length, 0);
  assert.ok(evaluarReglas(creta, { ...perfil, mes: 12 }, 2, vetos).inviolables.length > 0);
});

test("marcar un destino como campana lo sube en el orden", () => {
  const sin = recomendar(destinos, perfil, { pesos: { ...PESOS_POR_DEFECTO, campana: 5 } });
  const candidato = sin.propuestas.at(-1)?.id;
  assert.ok(candidato);

  const con = recomendar(destinos, perfil, {
    pesos: { ...PESOS_POR_DEFECTO, campana: 5 },
    campanas: [candidato!],
  });
  const posicion = con.propuestas.findIndex((p) => p.id === candidato);
  assert.equal(posicion, 0, "el destino en campaña deberia quedar el primero");
});

test("los pesos ordenan, pero NO anulan las reglas duras", () => {
  // Margen al maximo con una familia con un bebe: la Riviera Maya deja mucho
  // margen y sigue sin poder proponerse.
  const familia: Perfil = { ...perfil, edadesNinos: [2, 6], presupuestoTotal: 12000, mes: 7, dias: 10 };
  const r = recomendar(destinos, familia, {
    pesos: { encaje_cliente: 1, demanda: 1, margen: 5, campana: 1, cupo: 1 },
    campanas: [buscar("Riviera Maya").id],
  });
  assert.ok(!r.propuestas.some((p) => p.destino === "Riviera Maya"));
});
