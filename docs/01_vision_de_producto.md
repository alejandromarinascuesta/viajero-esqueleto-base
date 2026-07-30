# MVP — Visión de producto
**Caso práctico · Agencia de Turismo · Applied AI Engineer**

> Estructura tomada literalmente de la slide 4 del brief: propuesta de valor · alcance priorizado · flujo de usuario · enfoque de arquitectura · decisiones y trade-offs.

---

## 0. El problema, tal y como lo leo

La agencia tiene dos dolores declarados: no entiende la demanda real por destino, y produce contenido caro y lento. El segundo es consecuencia del primero — se produce contenido caro precisamente porque no se sabe qué merece la pena promocionar ni a quién.

Pero el problema, formulado con precisión, no es "no entendemos la demanda". Es esto:

> **El criterio comercial de la agencia vive en la cabeza de tres agentes veteranos, no en ningún sistema.** Cuando entra un cliente, lo que se le propone depende de a quién le toque atenderle y de qué recuerde ese día. No es reproducible, no es medible y no se puede mejorar.

Un problema de datos dispersos no se resuelve con más datos. Se resuelve convirtiendo el criterio en algo explícito, editable y medible.

**El usuario**: el agente de viajes de la propia agencia — herramienta interna, B2B, no toca al cliente final. Y un segundo usuario que es el que convierte esto en producto: el **responsable comercial**, que hoy no tiene ninguna forma de que su estrategia llegue a lo que los agentes proponen de verdad.

---

## 1. Propuesta de valor

> La plataforma que convierte la demanda del mercado y el criterio comercial de la agencia en una recomendación concreta: **qué experiencia promover, a qué cliente y en qué destino** — argumentada y en minutos.

Para el **agente**: deja de elegir de memoria. Vuelca lo que sabe del cliente y sale con dos propuestas concretas que puede defender delante de él.

Para la **dirección**: su estrategia comercial deja de ser una reunión y pasa a ser un parámetro del sistema. Cambia los pesos y cambia lo que proponen los cuarenta agentes, el mismo día, sin tocar código.

Para la **empresa**: el criterio deja de ser conocimiento tácito de tres personas y pasa a ser un activo de la compañía — visible, editable y, a partir de la v2, capaz de mejorar solo.

---

## 2. Alcance priorizado

El brief plantea tres patas. No valen lo mismo y no van a la vez.

| | Pata | Decisión | Por qué |
|---|---|---|---|
| **P1** | Dar soporte a los agentes | **Núcleo del MVP** | Es donde el valor se hace visible. Una señal de demanda que no cambia lo que se le propone a un cliente real no vale nada |
| **P2** | Entender la demanda | **Dentro del MVP, como entrada del anterior** | No es un producto aparte: es uno de los factores que ordenan la recomendación. Un panel de tendencias que nadie acciona es un informe, no un producto |
| **P3** | Generar contenido audiovisual | **Fuera del alcance inicial, primer paso del roadmap** | Es el problema declarado nº 2, pero generar contenido sin saber qué destino empujar ni a qué perfil es exactamente lo que ya les está saliendo caro. Tiene sentido cuando P1 y P2 le dicen qué producir y para quién |

**El criterio de priorización, en una frase**: primero la decisión, después la ejecución. El contenido es ejecución.

### Qué construyo yo y qué compro hecho

Lo que **compro**: el modelo de lenguaje, la señal de demanda (datos públicos de búsqueda), la infraestructura, la autenticación. Nada de esto me hace especial y todo está resuelto en el mercado.

Lo que **construyo**: el criterio. Las fichas que describen cliente y experiencia, las reglas duras que descartan lo imposible, el sistema de pesos que la agencia configura, y el circuito que registra qué se propuso y qué se descartó.

> *La señal de demanda no la construyo porque ya existe comprada. Lo que no se compra en ningún sitio es el criterio que convierte esa señal en una propuesta para un cliente concreto.*

### Fuera de alcance, y lo digo yo primero
No reserva. No cobra. No habla con el cliente final. No sustituye al agente: la decisión final siempre es suya.

---

## 3. Flujo de usuario a alto nivel

### Flujo A — El agente atiende a un cliente

1. **Entrada.** Pega las notas de la llamada tal cual (*"pareja de 40 y pico, dos niños de 5 y 8, unos 3.500, agosto, ella quiere playa pero él se aburre"*) y la IA rellena el formulario. O lo rellena a mano. Puede corregir lo que la IA haya entendido mal antes de seguir.
2. **Descarte.** Las reglas duras eliminan lo imposible: fuera de presupuesto, mal mes, vuelo demasiado largo con niños, visado sin tiempo. Esto lo hace código, no la IA.
3. **Orden.** Lo que sobrevive se ordena según los pesos que la agencia ha configurado, incluida la señal de demanda del destino.
4. **Salida.** **Dos opciones concretas, con precio y fechas**, cada una con su argumento — construido solo con datos reales de la ficha.
5. **Iteración.** Si no encajan, el agente afina (*"más barato"*, *"sin playa"*, *"vuelo más corto"*) y vuelve a pedir. **Cada descarte queda registrado.**
6. **Sin resultados.** Si nada cumple las reglas duras, el sistema enseña lo más cercano indicando qué regla incumple (*"Zanzíbar, 400 € por encima"* / *"lo mismo en mayo, dentro de presupuesto"*) y le pide al agente que afine.

### Flujo B — La dirección ajusta el criterio

Entra al panel y mueve palancas de negocio: destinos a empujar este trimestre, margen mínimo, vetos por temporada, cuánto pesa la señal de demanda frente al encaje con el cliente. Guarda, y a partir de ese momento todos los agentes recomiendan con el criterio nuevo.

### Flujo C — El bucle (diseñado, v2)

El resultado real de cada propuesta (reservada / descartada / perdida) vuelve al sistema. Los pesos dejan de ser una opinión de la dirección y pasan a corregirse con lo que se vende de verdad.

---

## 4. Enfoque de arquitectura

**El principio que ordena todo**: *la IA nunca elige, solo ordena y explica lo que ha sobrevivido a las reglas.*

Tres capas, con jerarquía estricta:

1. **Reglas duras — código.** Presupuesto, fechas, composición familiar, horas de vuelo, visado. No se saltan nunca. Si algo se sale del presupuesto, no aparece jamás en pantalla.
2. **Pesos comerciales — configuración de la agencia.** Empujar un destino, margen mínimo, señal de demanda, liquidar stock. Pesan, pero no pueden romper las reglas duras.
3. **IA generativa — solo dos trabajos.** Leer las notas del agente y convertirlas en un perfil estructurado (que el humano revisa), y redactar el argumento de cada opción **citando exclusivamente campos reales de la ficha**. Si el dato no está en la ficha, no puede mencionarlo.

**Lo que esto compra**: el sistema no puede inventar un precio ni saltarse un presupuesto, y el mismo cliente con las mismas reglas da siempre la misma respuesta. Reproducible y auditable frase por frase.

**Servicios externos** (todo lo intercambiable, aislado detrás de una interfaz propia): modelo de lenguaje, señal de demanda, base de datos y despliegue. Cualquiera de los cuatro se puede sustituir sin tocar la lógica de criterio, que es lo propio.

---

## 5. Principales decisiones de producto y trade-offs asumidos

| Decisión | Alternativa descartada | Por qué | Qué sacrifico |
|---|---|---|---|
| **La demanda entra como factor de la recomendación, no como panel propio** | Un dashboard de tendencias por destino | Un ranking hay que interpretarlo; una recomendación concreta se juzga sola. El valor solo existe cuando la señal cambia lo que se propone | La dirección pierde una vista analítica que quizá quiera. Va al roadmap |
| **La señal de demanda la compro; construyo el criterio** | Desarrollar mi propia lectura de demanda | Ya está resuelto en el mercado. El desarrollo propio va donde está la ventaja | Dependo de un proveedor externo, y la señal es de mercado, no propia |
| **Las reglas las configura la agencia, no vienen cableadas** | Reglas fijas escritas por mí | Convierte un algoritmo en plataforma B2B: el criterio pasa a ser un activo de la empresa, y el producto es vendible a otra agencia | Más superficie de producto que construir, y un administrador que hay que formar |
| **Jerarquía estricta: reglas > pesos > IA** | Dejar que la IA decida con el catálogo delante | Nunca alucina un precio ni salta un presupuesto, y es reproducible | Pierdo flexibilidad ante matices raros (*"algo tranquilo pero que no aburra a los niños"*) que un modelo suelto captaría mejor |
| **Dos opciones, no diez** | Una lista de resultados | Dos opciones obligan a comparar; diez obligan a elegir. Un buscador ya devuelve doscientos resultados y por eso no ayuda a nadie | Si las dos fallan, la primera impresión es mala. Lo compenso con la iteración |
| **La IA solo argumenta citando campos reales** | Redacción libre revisada por el agente | El argumento es verificable frase por frase — condición para que un agente veterano se fíe | El texto es menos comercial y más seco que el de un copy humano |
| **Panel de controles y pesos, no reglas en lenguaje natural** | Que el administrador escriba la regla en español | El administrador no escribe instrucciones a una IA: mueve palancas de negocio. Si el sistema no hace lo que dice el panel, es un error, no una interpretación | Menos expresivo. Reglas con matiz ("salvo si el cliente ya estuvo") no caben. Va a v2 |
| **Cuando nada encaja, enseño lo más cercano y qué regla incumple** | Devolver cero resultados | El agente ve el margen de negociación en vez de una pantalla vacía | Riesgo de que se acostumbre a saltarse las reglas duras. Por eso siempre se muestra cuál se está incumpliendo |
| **Catálogo propio de la agencia** | Incluir comparación con otras agencias | Coherente con una herramienta interna | El agente no puede justificar el precio frente a la competencia. Va al roadmap |

**El hilo que une todas**: nada de lo que se puede comprar hecho lo construyo, y todo el desarrollo propio está en el mismo sitio — el criterio.

---

## 6. Cómo se mide

**Métrica principal: tasa de conversión propuesta → reserva.** Es la única que conecta los dos problemas del brief en una frase: si no entiendes la demanda, promocionas el destino equivocado y propones lo que no se cierra.

Sin histórico, se mide con agentes que usan la herramienta contra agentes que no, mismo periodo y misma cartera.

**De apoyo**: tiempo por propuesta y margen medio por reserva.

---

## 7. Siguientes pasos del producto

1. **v2 — Se cierra el bucle.** Se conecta el resultado real de cada propuesta. Los pesos dejan de ser una opinión y se corrigen con lo que se vende. Aquí el producto empieza a valer más cada mes.
2. **v3 — Contenido dirigido por demanda** (la pata 3 del brief). Ahora sí tiene sentido: ya sabes qué destino empujar y a qué perfil, así que generar contenido deja de ser un gasto a ciegas.
3. **v4 — Reglas en lenguaje natural.** El administrador escribe *"en agosto no ofrezcas Caribe, es temporada de huracanes"* y el sistema lo convierte en una regla estructurada que puede revisar.
4. **v5 — Comparación con el mercado.** El sistema le dice al agente cómo está de precio frente a la competencia para que defienda la propuesta.

El orden no es casual: **cada versión necesita el dato que genera la anterior.**

---

## 8. Lo que este producto no resuelve, y lo reconozco antes de que me lo pregunten

- **Los datos públicos de búsqueda miden interés, no intención de compra.** No son demanda real. La señal buena es el histórico de reservas de la agencia — que no existe todavía, y que este producto está diseñado precisamente para fabricar.
- **La calidad de la recomendación depende de la calidad del catálogo.** Si las fichas están mal descritas, ninguna IA lo arregla. Eso es trabajo de la agencia.
- **Los pesos iniciales son una hipótesis.** El primer mes el sistema recomienda según lo que la dirección *cree*. A partir de v2, según lo que *funciona*.
- **Adopción.** Un agente veterano no usa una herramienta que le contradice sin explicarse. Por eso el argumento citado no es un adorno: es la condición para que la herramienta se use.
