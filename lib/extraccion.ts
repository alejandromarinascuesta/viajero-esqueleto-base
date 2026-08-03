// Extracción determinista del perfil a partir de las notas del agente.
//
// Por qué existe: el copiloto no puede depender de que haya clave de modelo.
// Esta capa es el SUELO — funciona siempre, sin red, sin coste y con el mismo
// resultado ante la misma entrada. El modelo de lenguaje es la MEJORA: cuando
// está disponible captura matices que una regla no ve (una tensión declarada
// dicha de forma rara, una motivación implícita).
//
// Mismo principio que el resto del sistema: lo que no se puede deducir se deja
// a null y se declara en "no_consta". Nunca se rellena con un supuesto.

import type { PerfilExtraido } from "@/lib/perfil";

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const NUMEROS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
};

/** Formas de decir «van dos adultos» que aparecen de verdad en unas notas. */
const DOS_ADULTOS =
  /\bpareja\b|\bmatrimonio\b|\bluna de miel\b|\bse casan\b|\blos dos\b|\blos padres\b|padre[,\s]+(?:e |y )?madre|madre[,\s]+(?:e |y )?padre|chico y chica|novios|\bfamilia\b/;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "3.500" -> 3500 · "3,5" -> 3.5 */
function aNumero(bruto: string): number {
  return Number(bruto.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
}

function palabraONumero(t: string): number | null {
  const limpio = norm(t.trim());
  if (/^\d+$/.test(limpio)) return Number(limpio);
  return NUMEROS[limpio] ?? null;
}

export function extraerPerfilDeterminista(notas: string): PerfilExtraido {
  const t = norm(notas);
  const literales: Record<string, string> = {};
  const guardar = (campo: string, cita: string | undefined) => {
    if (cita) literales[campo] = cita.trim();
  };

  // --- composición del grupo ---
  let adultos: number | null = null;
  // "2 adultos", "2 padres", "somos 4", "4 personas": el agente escribe como
  // habla, y todas estas formas aparecen de verdad en unas notas.
  const mAdultos = t.match(
    /(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho)\s+(?:adultos?|padres|personas|pax)|somos\s+(\d+|dos|tres|cuatro|cinco|seis)/,
  );
  if (mAdultos) {
    adultos = palabraONumero(mAdultos[1] ?? mAdultos[2]);
    guardar("adultos", mAdultos[0]);
  } else if (DOS_ADULTOS.test(t)) {
    adultos = 2;
    guardar("adultos", t.match(DOS_ADULTOS)?.[0]);
  } else {
    const mAmigos = t.match(/(\d+|dos|tres|cuatro|cinco|seis|siete|ocho)\s+amigos?/);
    if (mAmigos) {
      adultos = palabraONumero(mAmigos[1]);
      guardar("adultos", mAmigos[0]);
    }
  }

  // --- edades de los niños ---
  const ninos: number[] = [];
  // Cubre "dos ninos de 5 y 8" y tambien "un nino de 2 y otro de 6".
  const bloque = t.match(/(?:ninos?|ninas?|hijos?|criaturas?|peques?|bebes?|nenes?)[^.]{0,80}/);
  if (bloque) {
    const encadenadas =
      bloque[0].match(/de\s+(\d+)|(?:^|\s)(\d+)\s*(?:y|e|,)\s*(\d+)\s*(?:anos)?/g) ?? [];
    for (const trozo of encadenadas) {
      for (const n of trozo.match(/\d+/g) ?? []) {
        const edad = Number(n);
        if (edad <= 17 && !ninos.includes(edad)) ninos.push(edad);
      }
    }
    const sueltas = bloque[0].match(/de\s+(\d+)\s*(?:,|y|e)\s*(\d+)/);
    if (sueltas)
      for (const n of sueltas.slice(1)) {
        const edad = Number(n);
        if (edad <= 17 && !ninos.includes(edad)) ninos.push(edad);
      }
    ninos.sort((a, b) => a - b);
    if (ninos.length) guardar("ninos", bloque[0].trim());
  }
  if (ninos.length === 0) {
    const mCuantos = t.match(/(\d+|un|dos|tres|cuatro)\s+(?:ninos?|hijos?|peques?)/);
    if (mCuantos) guardar("ninos", mCuantos[0]);
  }

  // --- presupuesto ---
  let presupuesto: number | null = null;
  let porPersona: boolean | null = null;
  // «3mil», «3 mil» y «3.000» son la misma cifra escrita como la escribe la
  // gente. Se prueba primero la forma con «mil» porque la otra expresion
  // capturaria solo el 3 y daria un presupuesto de tres euros.
  const mMiles = t.match(
    /(?:unos?|sobre|hasta|maximo|menos de|presupuesto de|gastar)?\s*(\d{1,3})\s*mil(?:es)?\s*(?:€|euros?|eur|pavos)?/,
  );
  const mDinero = mMiles ?? t.match(
    /(?:unos?|sobre|hasta|maximo|menos de|presupuesto de|gastar|tienen|tenemos)?\s*(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:€|euros?|eur|pavos)?/,
  );
  if (mDinero) {
    const valor = mMiles ? aNumero(mDinero[1]) * 1000 : aNumero(mDinero[1]);
    if (valor >= 200) {
      presupuesto = valor;
      guardar("presupuesto_total", mDinero[0]);
      if (/(?:por|cada|\/)\s*persona|por cabeza|cada uno|\bpax\b/.test(t)) porPersona = true;
      else if (/en total|los dos|los cuatro|los tres|en conjunto|entre los/.test(t))
        porPersona = false;
    }
  }
  const flexible = /flexible|puede subir|hay margen|si merece la pena|no es problema/.test(t)
    ? true
    : null;

  // --- fechas y duración ---
  // Puede haber mas de un mes en las notas ("se casan en octubre, viajan en
  // noviembre"). Gana el que va detras de una palabra de viaje.
  let mes: number | null = null;
  const aparicion = Object.entries(MESES)
    .map(([nombre, numero]) => ({ nombre, numero, pos: t.indexOf(nombre) }))
    .filter((m) => m.pos !== -1)
    .sort((a, b) => a.pos - b.pos);
  if (aparicion.length === 1) {
    mes = aparicion[0].numero;
    guardar("mes", aparicion[0].nombre);
  } else if (aparicion.length > 1) {
    const deViaje = aparicion.find((m) =>
      /(?:viaje|viajar|viajan|salida|salen|irse|ir|vacaciones|para)\s+(?:en\s+)?$/.test(
        t.slice(Math.max(0, m.pos - 24), m.pos),
      ),
    );
    const elegido = deViaje ?? aparicion[0];
    mes = elegido.numero;
    guardar("mes", elegido.nombre);
  }

  let dias: number | null = null;
  const mNoches = t.match(
    /(\d+|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:dias|noches)/,
  );
  if (mNoches) {
    dias = palabraONumero(mNoches[1]);
    guardar("dias", mNoches[0]);
  } else if (/una semana|1 semana/.test(t)) {
    dias = 7;
    guardar("dias", "una semana");
  } else if (/dos semanas/.test(t)) {
    dias = 14;
    guardar("dias", "dos semanas");
    // "primera quincena de agosto" es cuando viajan, no cuanto: solo cuenta
    // como duracion si no se ha dicho otra cosa.
  } else if (/quincena/.test(t) && !/(primera|segunda|1a|2a)\s+quincena/.test(t)) {
    dias = 15;
    guardar("dias", "quincena");
  } else if (/fin de semana/.test(t)) {
    dias = 3;
    guardar("dias", "fin de semana");
  } else if (/puente/.test(t)) {
    dias = 4;
    guardar("dias", "puente");
  }

  // --- motivación e intensidad ---
  let motivacion: string | null = null;
  const senales: [string, RegExp][] = [
    ["romantico", /romantic|luna de miel|escapada en pareja|aniversario/],
    ["celebracion", /celebrar|cumpleanos|boda|despedida/],
    ["aventura", /aventura|trekking|senderismo|mochil|activo|surf|buce/],
    ["cultura", /cultura|museos?|arte|historic|monument|gastronom/],
    ["descanso", /descans|playa|relax|tranquil|no hacer nada|desconectar/],
  ];
  for (const [clave, patron] of senales) {
    const m = t.match(patron);
    if (m) {
      motivacion = clave;
      guardar("motivacion", m[0]);
      break;
    }
  }
  const intensidad = /no hacer nada|tumbad|relax total/.test(t)
    ? 1
    : /mochil|trekking|ruta|muy activo/.test(t)
      ? 4
      : null;

  // --- restricciones ---
  const restricciones: string[] = [];
  if (
    /movilidad reducida|silla de ruedas|no puede (?:con )?(?:cuestas|andar|caminar)|problemas de rodilla|le cuesta andar/.test(
      t,
    )
  )
    restricciones.push("movilidad reducida");
  // Cubre desde "vuelo corto" hasta "no quieren volar" o "quieren ir en coche":
  // el agente escribe como habla, no como un formulario.
  if (
    /no quier[ea]n? vuelos largos|vuelos? cortos?|cerca de casa|nada de vuelos largos|sin vuelos largos|no quier[ea]n? volar|sin volar|nada de avion|miedo a volar|en coche|por carretera|en tren/.test(
      t,
    )
  )
    restricciones.push("no vuelos largos");
  if (
    /presupuesto ajustado|van justos|poco presupuesto|lo mas barato|que no sea muy caro|sin gastar mucho|economic/.test(
      t,
    )
  )
    restricciones.push("presupuesto ajustado");
  if (restricciones.length) guardar("restricciones", restricciones.join(", "));

  // --- tensión declarada: dos deseos enfrentados ---
  let tension: string | null = null;
  const mTension = notas.match(
    /[^.;]*\b(?:ella|el|él|uno|una|pero)\b[^.;]*\b(?:pero|aunque|mientras que|en cambio|y (?:él|el) dice)\b[^.;]*[.;]?/i,
  );
  if (mTension && /quiere|prefiere|dice|le gusta|se aburre/i.test(mTension[0])) {
    tension = mTension[0].trim().replace(/^[«"']|[»"']$/g, "");
    guardar("tension", tension);
  }

  const noConsta: string[] = [];
  if (adultos === null) noConsta.push("adultos");
  if (presupuesto === null) noConsta.push("presupuesto_total");
  if (mes === null) noConsta.push("mes");
  if (dias === null) noConsta.push("dias");
  if (motivacion === null) noConsta.push("motivacion");

  return {
    adultos,
    ninos,
    presupuesto_total: presupuesto,
    presupuesto_es_por_persona: porPersona,
    flexible,
    mes,
    dias,
    motivacion,
    intensidad,
    restricciones,
    destinos_mencionados: [],
    tension,
    no_consta: noConsta,
    literales,
  };
}

/** Cuántos campos clave se han podido deducir. Sirve para decidir si merece la
 *  pena pedir ayuda al modelo o si la extracción determinista ya es suficiente. */
export function cobertura(p: PerfilExtraido): number {
  const clave = [p.adultos, p.presupuesto_total, p.mes, p.dias, p.motivacion];
  return clave.filter((v) => v !== null && v !== undefined).length / clave.length;
}

/**
 * Segunda pasada con modelo de lenguaje, sobre los huecos que las reglas no han
 * podido llenar.
 *
 * El orden importa y es el argumento entero: las reglas van PRIMERO y lo que
 * encuentran no se toca. El modelo solo puede rellenar lo que quedo vacio, y
 * nunca sobreescribe un dato ya extraido. Asi el sistema funciona sin clave,
 * sin red y sin coste —degradado, pero funcionando—, y cuando hay modelo capta
 * lo que un patron no puede: «ella quiere playa y el se aburre».
 */
export const INSTRUCCION_PERFIL = `Eres el asistente de un agente de viajes. Recibes las notas informales de una llamada y devuelves SOLO los datos que las notas dicen.

REGLA ABSOLUTA: extrae únicamente lo que las notas dicen. No completes, no supongas y no infieras. Si un dato no aparece, déjalo a null. Es preferible un perfil incompleto que el agente completa, a un perfil inventado en el que confía sin darse cuenta.

Devuelve exclusivamente este JSON, sin texto alrededor:
{
  "adultos": entero o null,
  "ninos": [edades como enteros] o [],
  "presupuesto_total": entero en euros o null,
  "presupuesto_es_por_persona": true, false o null si no queda claro,
  "flexible": true solo si las notas dicen que hay margen, si no null,
  "mes": 1-12 o null,
  "dias": entero o null,
  "motivacion": "descanso" | "cultura" | "aventura" | "romantico" | "celebracion" | null,
  "intensidad": 1 (no quieren moverse) a 5 (mochila y ruta) o null,
  "restricciones": ["movilidad reducida", "no vuelos largos", "presupuesto ajustado", ...] o [],
  "destinos_mencionados": [destinos que el cliente nombra, quiera o descarte],
  "tension": "una frase con la contradicción entre los viajeros si las notas la reflejan" o null,
  "literales": {"campo": "el trozo exacto de las notas del que sale cada dato"}
}`;

type Perfil = PerfilExtraido;
type PerfilModelo = Partial<Perfil> & { literales?: Record<string, string> };

/** Fusiona sin pisar: lo que las reglas encontraron manda siempre. */
export function fusionarPerfil(base: Perfil, delModelo: PerfilModelo | null): Perfil {
  if (!delModelo) return base;
  const fusionado: Perfil = { ...base };
  const rellenados: string[] = [];

  const campos = [
    "adultos", "presupuesto_total", "presupuesto_es_por_persona",
    "flexible", "mes", "dias", "motivacion", "intensidad", "tension",
  ] as const;
  for (const campo of campos) {
    const actual = fusionado[campo] as unknown;
    const propuesto = delModelo[campo] as unknown;
    if ((actual === null || actual === undefined) && propuesto !== null && propuesto !== undefined) {
      (fusionado as Record<string, unknown>)[campo] = propuesto;
      rellenados.push(campo);
    }
  }
  if (!fusionado.ninos?.length && delModelo.ninos?.length) {
    fusionado.ninos = delModelo.ninos;
    rellenados.push("ninos");
  }
  for (const r of delModelo.restricciones ?? []) {
    if (!fusionado.restricciones.includes(r)) fusionado.restricciones.push(r);
  }
  for (const d of delModelo.destinos_mencionados ?? []) {
    if (!fusionado.destinos_mencionados.includes(d)) fusionado.destinos_mencionados.push(d);
  }
  for (const [campo, literal] of Object.entries(delModelo.literales ?? {})) {
    if (rellenados.includes(campo) && !fusionado.literales[campo]) {
      fusionado.literales[campo] = literal;
    }
  }
  fusionado.no_consta = fusionado.no_consta.filter((c) => !rellenados.includes(c));
  return fusionado;
}
