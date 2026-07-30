import assert from "node:assert/strict";
import { test } from "node:test";
import { verificarArgumento } from "../lib/verificar";

// Decirle al modelo "no inventes" no basta: hay que comprobarlo. Esto es lo que
// permite afirmar «campos inventados: 0» como un hecho medido.

const ficha = {
  id: "EXP14", destino: "Creta", precio_desde_pp: 980, noches: 7, horas_vuelo: 3.5,
  motivo_1: "Playas de aguas poco profundas y cálidas",
  motivo_2: "Hotel con club infantil y cocina mediterránea",
  motivo_3: "Historia minoica a media hora en coche",
};

test("acepta un argumento que solo usa datos de la ficha", () => {
  const r = verificarArgumento(
    ["Playas poco profundas, ideal con niños.", "980 € por persona, 7 noches.", "Historia minoica cerca."],
    ["motivo_1", "precio_desde_pp", "noches", "motivo_3"], ficha);
  assert.equal(r.valido, true);
});

test("acepta el precio total del grupo: es un multiplo legitimo", () => {
  const r = verificarArgumento(["Encaja con la familia.", "3920 € los cuatro."], ["precio_desde_pp"], ficha);
  assert.equal(r.valido, true);
});

test("caza una cifra que no esta en la ficha", () => {
  const r = verificarArgumento(["Playas tranquilas.", "El agua está a 26 grados."], ["motivo_1"], ficha);
  assert.equal(r.valido, false);
  assert.deepEqual(r.numerosInventados, ["26"]);
});

test("caza un campo citado que no existe", () => {
  const r = verificarArgumento(["Playas tranquilas."], ["motivo_1", "valoracion_clientes"], ficha);
  assert.equal(r.valido, false);
  assert.deepEqual(r.camposInexistentes, ["valoracion_clientes"]);
});
