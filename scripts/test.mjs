// Compila las pruebas en TypeScript y las ejecuta con el runner de Node.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const salida = ".test-build";
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

const pruebas = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));
await build({
  entryPoints: pruebas.map((f) => resolve("tests", f)),
  outdir: salida,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  logLevel: "error",
  external: ["node:*"],
});

const archivos = readdirSync(salida).filter((f) => f.endsWith(".js")).map((f) => `${salida}/${f}`);
let estado = 0;
for (const archivo of archivos) {
  const r = spawnSync(process.execPath, [archivo], { stdio: "inherit" });
  if (r.status !== 0) estado = r.status ?? 1;
}
process.exit(estado);
