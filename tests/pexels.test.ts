import { strict as assert } from "node:assert";
import { test } from "node:test";
import { elegirFichero, ordenarPorVerticalidad } from "../lib/pexels";

test("elige el fichero mas cercano a 720 px y descarta lo que no es mp4", () => {
  const elegido = elegirFichero([
    { link: "a.mp4", file_type: "video/mp4", width: 240, height: 426 },
    { link: "b.mp4", file_type: "video/mp4", width: 640, height: 1138 },
    { link: "c.mp4", file_type: "video/mp4", width: 1920, height: 3414 },
    { link: "d.mov", file_type: "video/quicktime", width: 720, height: 1280 },
  ]);
  assert.equal(elegido?.link, "b.mp4");
});

test("sin ficheros utilizables devuelve null en lugar de inventar uno", () => {
  assert.equal(elegirFichero([{ link: "x.mov", file_type: "video/quicktime", width: 720 }]), null);
  assert.equal(elegirFichero([]), null);
  assert.equal(elegirFichero(), null);
});

test("un fichero enorme no se cuela solo por ser el unico", () => {
  assert.equal(elegirFichero([{ link: "4k.mp4", file_type: "video/mp4", width: 3840, height: 2160 }]), null);
});

test("lo vertical va primero, que es el formato de la pieza", () => {
  const ordenado = ordenarPorVerticalidad([
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
    { width: 1080, height: 1080 },
  ]);
  assert.deepEqual(ordenado.map((x) => x.height), [1920, 1080, 1080]);
  assert.equal(ordenado[0].width, 1080);
});

test("sin clave configurada no se llama al banco y no se rompe nada", async () => {
  delete process.env.PEXELS_API_KEY;
  const { buscarActivosPexels, hayPexels } = await import("../lib/pexels");
  assert.equal(hayPexels(), false);
  assert.deepEqual(
    await buscarActivosPexels({ id: "EXP01", destino: "Creta", pais: "Grecia", tipo: "playa" } as never),
    { activos: [], verificados: 0, descartados: 0 },
  );
});

test("un video de otra ciudad no entra en la campania de este destino", async () => {
  const { nombraOtroSitio } = await import("../lib/pexels");
  const sevilla = ["seville", "sevilla", "andalusia", "giralda", "alcazar"];
  // El caso real: buscando Sevilla, el banco devolvio el ayuntamiento de Madrid.
  assert.equal(nombraOtroSitio("https://www.pexels.com/video/city-hall-of-madrid-12345/", sevilla), true);
  assert.equal(nombraOtroSitio("https://www.pexels.com/video/sagrada-familia-barcelona-99/", sevilla), true);
  assert.equal(nombraOtroSitio("https://www.pexels.com/video/plaza-de-espana-seville-77/", sevilla), false);
});

test("si nombra el destino se acepta aunque nombre tambien otro sitio", async () => {
  const { nombraOtroSitio } = await import("../lib/pexels");
  const sevilla = ["seville", "sevilla"];
  assert.equal(nombraOtroSitio("train from madrid to seville", sevilla), false);
});

test("se da por verificado solo lo que nombra el destino", async () => {
  const { nombraDestino } = await import("../lib/pexels");
  const creta = ["crete", "balos", "elafonissi"];
  assert.equal(nombraDestino("https://www.pexels.com/video/balos-beach-aerial-1/", creta), true);
  assert.equal(nombraDestino("https://www.pexels.com/video/beautiful-turquoise-water-2/", creta), false);
});

test("lo generico entra, pero detras y sin contar como verificado", async () => {
  const { nombraDestino, nombraOtroSitio } = await import("../lib/pexels");
  const creta = ["crete", "balos"];
  const generico = "https://www.pexels.com/video/waves-on-the-shore-9/";
  assert.equal(nombraOtroSitio(generico, creta), false, "no deberia descartarse");
  assert.equal(nombraDestino(generico, creta), false, "tampoco deberia darse por bueno");
});
