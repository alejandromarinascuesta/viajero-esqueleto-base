// Compila las pruebas en TypeScript y las ejecuta con el runner de Node.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readdirSync, mkdirSync, rmSync } from "node:fs";

const salida = ".test-build";
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

const pruebas = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));
await build({
  entryPoints: pruebas.map((f) => `tests/${f}`),
  outdir: salida,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "error",
  external: ["node:*"],
});

const archivos = readdirSync(salida).filter((f) => f.endsWith(".js")).map((f) => `${salida}/${f}`);
const r = spawnSync("node", ["--test", ...archivos], { stdio: "inherit" });
process.exit(r.status ?? 1);
