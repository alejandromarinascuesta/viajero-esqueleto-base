// Verificación de que el argumento redactado por el modelo no se inventa nada.
//
// Decirle al modelo "no inventes" no basta: hay que comprobarlo. Esta prueba
// cubre los dos fallos que puede cometer —citar un campo que no existe y
// colar una cifra que no está en la ficha— y el falso positivo que hay que
// evitar: el precio total del grupo es un múltiplo legítimo del precio por
// persona.
//
//   npx esbuild tests/verificar_argumento.ts --bundle --platform=node \
//     --format=esm --outfile=/tmp/p.mjs && node /tmp/p.mjs

import { verificarArgumento } from "../src/lib/recomendador/verificar";

const ficha = {
  id: "EXP14",
  destino: "Creta",
  precio_desde_pp: 980,
  noches: 7,
  horas_vuelo: 3.5,
  motivo_1: "Playas de aguas poco profundas y cálidas",
  motivo_2: "Hotel con club infantil y cocina mediterránea",
  motivo_3: "Historia minoica a media hora en coche",
};

const casos: [string, string[], string[], boolean][] = [
  [
    "argumento honesto",
    [
      "Playas de aguas poco profundas, ideal con niños.",
      "980 € por persona, 7 noches.",
      "Historia minoica a media hora.",
    ],
    ["motivo_1", "precio_desde_pp", "noches", "motivo_3"],
    true,
  ],
  [
    "precio total del grupo (multiplo legitimo)",
    ["Encaja con la familia.", "3920 € los cuatro."],
    ["precio_desde_pp"],
    true,
  ],
  [
    "cifra inventada",
    ["Playas tranquilas.", "El agua está a 26 grados en agosto."],
    ["motivo_1"],
    false,
  ],
  ["campo que no existe", ["Playas tranquilas."], ["motivo_1", "valoracion_clientes"], false],
  ["vuelo correcto de ficha", ["Vuelo de 3,5 h sin escalas."], ["horas_vuelo"], true],
];

let fallos = 0;
for (const [nombre, argumento, campos, esperado] of casos) {
  const r = verificarArgumento(argumento, campos, ficha);
  const ok = r.valido === esperado;
  if (!ok) fallos++;
  console.log(
    `${ok ? "  OK " : "FALLA"}  ${nombre.padEnd(42)} valido=${r.valido}` +
      (r.numerosInventados.length ? `  inventados=[${r.numerosInventados}]` : "") +
      (r.camposInexistentes.length ? `  campos_inexistentes=[${r.camposInexistentes}]` : ""),
  );
}
console.log(fallos === 0 ? `\n${casos.length} casos, 0 fallos` : `\n${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
