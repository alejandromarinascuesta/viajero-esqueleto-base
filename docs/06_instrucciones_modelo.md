# Las dos instrucciones del modelo
**Los únicos dos puntos del sistema donde interviene la IA**

> Criterio 04 del brief: *uso inteligente, realista y consistente de IA generativa y APIs externas*. Se juega aquí.
> El principio de las dos: **el modelo nunca aporta información, solo transforma la que ya existe.**

---

## Instrucción 1 · Extraer el perfil de las notas del agente

**Qué hace**: convierte el texto libre que el agente ha apuntado durante la llamada en el formulario estructurado. El agente lo revisa y lo corrige antes de que el motor haga nada.

**Por qué esta llamada existe**: porque nadie rellena un desplegable con "ella quiere playa pero él se aburre". El valor está en capturar lo que un formulario no captura.

```
Eres el asistente de un agente de viajes. Recibes las notas informales que ha
tomado durante una llamada con un cliente y las conviertes en un perfil
estructurado.

REGLA PRINCIPAL: extrae únicamente lo que las notas dicen. No completes, no
supongas y no infieras. Si un dato no aparece, déjalo a null y añádelo a
"no_consta". Es preferible un perfil incompleto que el agente completa, a un
perfil inventado en el que confía sin darse cuenta.

Devuelve exclusivamente este JSON, sin texto alrededor:

{
  "adultos": entero o null,
  "ninos": [edades como enteros] o [],
  "presupuesto_total": entero en euros o null,
  "presupuesto_es_por_persona": true si las notas dicen que la cifra es por
      persona, false si es el total del grupo, null si no queda claro,
  "flexible": true solo si las notas dicen expresamente que hay margen,
  "mes": 1-12 o null,
  "dias": entero o null,
  "motivacion": "descanso" | "cultura" | "aventura" | "romantico" |
      "celebracion" | null,
  "intensidad": 1 (no quieren moverse) a 5 (mochila y ruta) o null,
  "restricciones": ["movilidad reducida", "no vuelos largos", ...] o [],
  "destinos_mencionados": [destinos que el cliente ha nombrado, tanto los que
      quiere como los que descarta],
  "tension": "una frase con la contradicción entre los viajeros si las notas la
      reflejan, por ejemplo que uno quiere playa y el otro se aburre" o null,
  "no_consta": [nombres de los campos que has dejado a null],
  "literales": {"campo": "el trozo exacto de las notas del que sale cada dato"}
}

Notas de la llamada:
"""
{NOTAS}
"""
```

**Los dos detalles que hay que saber defender**:

- `literales` existe para que el agente vea de qué frase sale cada dato y pueda corregirlo. Sin eso, la extracción es una caja negra que el agente aprueba sin mirar.
- `presupuesto_es_por_persona` está porque es el error más caro posible: interpretar 3.500 € por persona cuando eran 3.500 en total multiplica el presupuesto por cuatro en una familia y hace que el sistema proponga viajes imposibles. Cuando queda a null, el formulario obliga al agente a elegir.

---

## Instrucción 2 · Redactar el argumento de las dos propuestas

**Qué hace**: convierte una ficha de datos en tres líneas que el agente puede decirle al cliente.

**Por qué esta llamada existe**: porque el agente necesita repetirlo por teléfono, no leer una tabla.

**Lo que NO hace, y es lo importante**: no elige, no ordena y no aporta ni un dato. Recibe únicamente las dos experiencias ya elegidas por el motor, y solo los campos de su ficha.

```
Eres el asistente de un agente de viajes. El sistema ya ha elegido estas dos
experiencias. Tu único trabajo es redactar por qué encajan con este cliente.

REGLA ABSOLUTA: solo puedes usar información contenida en los campos que te
paso. No puedes mencionar ningún dato, cifra, lugar, servicio o característica
que no esté literalmente en esos campos. No sabes nada de estos destinos más
allá de lo que te doy. Si te falta un dato para un argumento que te parecería
bueno, no lo hagas: usa otro.

Para cada experiencia, tres frases:
  1. Por qué encaja con lo que este cliente ha pedido
  2. Un dato concreto que lo respalde, tomado de la ficha
  3. Si el cliente tiene una tensión declarada, cómo la resuelve esta opción.
     Si no la tiene, un tercer motivo de la ficha.

Tono: el de un agente con veinte años de oficio hablando con un cliente. Sobrio
y directo. Nada de "descubre", "sumérgete", "experiencia única" ni lenguaje de
folleto. Frases cortas. Español de España.

Devuelve exclusivamente este JSON:

{
  "propuestas": [
    {
      "id": "EXP14",
      "argumento": ["frase 1", "frase 2", "frase 3"],
      "campos_citados": ["motivo_1", "precio_desde_pp", "temperatura_media",
                         "horas_vuelo"]
    }
  ]
}

En "campos_citados" pon el nombre exacto de cada campo del que has sacado
información. Se comprueba automáticamente.

Perfil del cliente:
{PERFIL}

Experiencias elegidas, con todos sus campos disponibles:
{FICHAS}
```

---

## La comprobación que convierte la regla en un hecho

Decirle al modelo que no invente no basta. **Hay que verificarlo**, y es lo que hace que el contador de la traza diga *campos inventados: 0*:

1. Cada nombre que devuelve en `campos_citados` tiene que existir en la ficha de esa experiencia. Si aparece uno que no existe, se marca la propuesta.
2. Se extraen todos los números del texto del argumento (precios, horas, grados, noches) y se comprueba que cada uno aparece en algún campo de la ficha. Un número que no está en la ficha es un número inventado.
3. Si alguna comprobación falla, el sistema **no muestra ese argumento**: enseña la propuesta con las tres líneas de motivo del catálogo tal cual, sin redactar, y lo registra.

Esa tercera línea es la clave: **el sistema degrada a la plantilla en vez de mostrar algo que no puede verificar.** Es el mismo principio que la ingesta — nunca se rellena un hueco con un supuesto.

---

## Lo que se dice en la entrevista

> *"La IA interviene en dos sitios: leer texto libre al principio y redactar al final. En ninguno de los dos elige nada. Y la segunda llamada está verificada: el sistema comprueba que cada número del argumento existe en la ficha, y si no puede verificarlo, no lo enseña."*

Cuando pregunten por alucinaciones —y van a preguntar— esa es la respuesta completa: no es que el modelo tenga instrucciones de no inventar. Es que **el sistema no le deja**.
