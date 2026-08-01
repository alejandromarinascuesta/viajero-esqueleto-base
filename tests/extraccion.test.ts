import assert from "node:assert/strict";
import { test } from "node:test";
import { extraerPerfilDeterminista } from "../lib/extraccion";

// El copiloto tiene que funcionar sin clave de modelo. Estas pruebas cubren el
// extractor determinista, que es el suelo del sistema.

const casos: [string, string, Record<string, unknown>][] = [
  ["familia clasica de agosto",
   "Pareja de 45 con dos niños de 5 y 8. Unos 3.500 en total, primera quincena de agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.",
   { adultos: 2, ninos: [5, 8], presupuesto_total: 3500, mes: 8, dias: 7, motivacion: "descanso", presupuesto_es_por_persona: false }],
  ["jubilados con movilidad reducida",
   "Matrimonio jubilado, ella con problemas de rodilla, no puede con cuestas ni caminatas largas. 3.000 los dos, mayo, ocho días. Les gusta la cultura y comer bien.",
   { adultos: 2, ninos: [], presupuesto_total: 3000, mes: 5, dias: 8, motivacion: "cultura", restricciones: ["movilidad reducida"] }],
  ["grupo de amigos",
   "Cuatro amigos de 30, julio, cinco días. Unos 800 cada uno. Quieren ambiente y salir de noche.",
   { adultos: 4, ninos: [], presupuesto_total: 800, mes: 7, dias: 5, presupuesto_es_por_persona: true }],
  ["luna de miel",
   "Se casan en octubre. Viaje en noviembre, 8 días. Presupuesto 6.000 los dos, quieren algo romántico y tranquilo.",
   { adultos: 2, presupuesto_total: 6000, mes: 11, dias: 8, motivacion: "romantico", presupuesto_es_por_persona: false }],
  ["familia con bebe",
   "Familia con un niño de 2 y otro de 6. Tienen 8.000 y quieren la Riviera Maya en julio. Diez días.",
   { ninos: [2, 6], presupuesto_total: 8000, mes: 7, dias: 10 }],
];

for (const [nombre, notas, esperado] of casos) {
  test(`extrae el perfil: ${nombre}`, () => {
    const r = extraerPerfilDeterminista(notas) as unknown as Record<string, unknown>;
    for (const [campo, valor] of Object.entries(esperado)) {
      assert.deepEqual(r[campo], valor, `${campo}`);
    }
  });
}

test("detecta la tension declarada entre los dos viajeros", () => {
  const r = extraerPerfilDeterminista(
    "Pareja, 3.500 en total, agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.",
  );
  assert.ok(r.tension !== null);
});

test("lo que las notas no dicen queda a null y se declara", () => {
  const r = extraerPerfilDeterminista("Una pareja quiere viajar.");
  assert.equal(r.presupuesto_total, null);
  assert.ok(r.no_consta.includes("presupuesto_total"));
});

test("entiende que no quieren volar, se diga como se diga", () => {
  for (const notas of [
    "Pareja de 45 con 2 niños, no quieren volar, quieren ir en coche desde Madrid. 2.000 en total, agosto, 5 días.",
    "Familia con 3.000 euros en julio, una semana. Prefieren vuelo corto.",
    "Matrimonio, 2.500, mayo, seis días. Tienen miedo a volar.",
  ]) {
    const r = extraerPerfilDeterminista(notas);
    assert.ok(r.restricciones.includes("no vuelos largos"), notas);
  }
});

test("reconoce a los padres como dos adultos", () => {
  const r = extraerPerfilDeterminista(
    "Quieren viajar fuera de España. Padre, madre e hijo de 15 años. 7 días. 3.000 euros en julio.",
  );
  assert.equal(r.adultos, 2);
  assert.deepEqual(r.ninos, [15]);
  assert.equal(r.dias, 7);
});

test("«que no sea muy caro» es una restriccion, no un presupuesto", () => {
  const r = extraerPerfilDeterminista(
    "Pareja con un hijo de 15, julio, 7 días, 2.500 en total. Que no sea muy caro.",
  );
  assert.ok(r.restricciones.includes("presupuesto ajustado"));
  assert.equal(r.presupuesto_total, 2500);
});

test("deduce dos adultos de las formas en que un agente lo escribe", () => {
  for (const [notas, esperado] of [
    ["Chico y chica jóvenes, 1.200 euros, puente de mayo.", 2],
    ["Familia numerosa, 3 niños de 6, 9 y 12, 7.000, agosto, dos semanas.", 2],
    ["Los padres y un hijo de 10. 4.000 en julio, una semana.", 2],
  ] as const) {
    assert.equal(extraerPerfilDeterminista(notas).adultos, esperado, notas);
  }
});
