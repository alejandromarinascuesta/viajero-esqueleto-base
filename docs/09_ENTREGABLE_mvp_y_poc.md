# El MVP y la prueba de concepto
**Caso práctico · Agencia de Turismo · Applied AI Engineer**

> Estructura tomada literalmente de la slide 4 del brief.
> **MVP**: propuesta de valor · alcance priorizado · flujo de usuario · enfoque de arquitectura · decisiones y trade-offs.
> **Prueba de concepto**: implementación funcional aunque parcial de una parte clave, y demo suficiente para explicar los servicios, cómo se orquestan los flujos y dónde están los puntos críticos.

---

# 0 · El problema, reformulado

El brief declara dos dolores: no entienden la demanda real por destino, y producir contenido les cuesta caro y lento. Y precisa el primero: *tendencias de viaje, intereses de usuarios, reseñas, redes sociales y plataformas de reserva están dispersas en múltiples fuentes*.

Ahí hay una trampa que conviene no morder. **El problema no es que los datos estén dispersos.** Si lo fuera, se resolvería con un cuadro de mando, y cuadros de mando de demanda turística ya se venden hechos. El problema real aparece cuando uno se pregunta qué pasaría el día después de tener todos esos datos unificados en una pantalla:

> El agente seguiría proponiendo lo mismo. Porque **el criterio comercial de la agencia no está en ningún sistema: está en la cabeza de tres agentes veteranos.** Lo que se le ofrece a un cliente depende de a quién le toque atenderle y de qué recuerde ese día. No es reproducible, no es medible y no se puede mejorar.

Un dato que no cambia una decisión no vale nada. Por eso este producto no termina en un panel: **termina en una propuesta concreta que un agente puede defender por teléfono.**

**El usuario principal** es el agente de viajes de la propia agencia — herramienta interna, B2B, no toca al cliente final. **El segundo usuario** es el responsable comercial, y es el que convierte esto en producto: hoy no tiene ninguna forma de que su estrategia llegue a lo que los agentes proponen de verdad.

---

# 1 · Propuesta de valor

> **La plataforma que convierte la demanda del mercado y el criterio comercial de la agencia en una decisión concreta: qué experiencia proponer, a qué cliente y por qué — en el minuto de la llamada, no en el informe del mes que viene.**

Tres promesas, una por usuario:

**Para el agente** — deja de elegir de memoria. Vuelca lo que sabe del cliente en lenguaje natural y sale con dos propuestas concretas, con precio, fechas y tres frases de argumento que puede repetir tal cual. De cuarenta minutos de búsqueda a dos.

**Para la dirección** — su criterio comercial deja de ser una reunión y pasa a ser un parámetro del sistema. Mueve los pesos y cambia lo que proponen los cuarenta agentes, el mismo día, sin tocar código y sin volver a explicarlo persona por persona.

**Para la empresa** — el criterio deja de ser conocimiento tácito de tres personas y pasa a ser un activo: visible, editable, medible y —a partir de la v2— capaz de mejorar solo con cada venta.

### Lo que hace distinto a este producto

La categoría obvia sería «inteligencia turística»: paneles de demanda por destino, para dirección, por suscripción. Ese mercado está resuelto y muy bien resuelto.

**Este producto vive un nivel por debajo: en el punto de venta.** No responde *hacia dónde va el mercado*, responde *qué le digo a este señor que tengo al teléfono*. Y esa diferencia obliga a algo que un panel no necesita: **la recomendación tiene que venir con un argumento defendible**, porque un agente no repite a un cliente algo que no sabe justificar.

Por eso aquí la explicación no acompaña al producto. **La explicación es el producto.**

---

# 2 · Alcance priorizado

El brief plantea tres patas. No valen lo mismo y no van a la vez.

| | Pata del brief | Decisión | Por qué |
|---|---|---|---|
| **P1** | Dar soporte a los agentes | **Núcleo del MVP** | Es donde el valor se hace visible. Es también donde el criterio de la agencia se vuelve código |
| **P2** | Entender la demanda | **Dentro del MVP, como entrada del anterior** | No es un producto aparte: es uno de los factores que ordenan la recomendación. Un panel que nadie acciona es un informe |
| **P3** | Generar contenido audiovisual | **Reducida a su pieza útil, la última en construirse** | Ver abajo |

### El criterio de priorización, en una frase

**Primero la decisión, después la ejecución.** El contenido es ejecución: producirlo sin saber qué destino empujar ni a qué perfil es exactamente lo que ya les está saliendo caro. Cuando P1 y P2 dicen qué producir y para quién, el mismo gasto en contenido rinde el doble.

Pero descartarla del todo sería desperdiciar algo que el flujo ya regala. Así que **P3 entra reducida a una sola pieza: convertir la recomendación en el correo de propuesta al cliente.** Los datos ya están —las dos opciones, el precio, el argumento verificado—; falta darles forma de correo. Es la única parte de la pata 3 que no abre un frente nuevo, y va la última porque depende de que todo lo anterior funcione. En el apartado 7 está su propuesta de arquitectura.

### Qué se compra y qué se construye

**Se compra** todo lo que no diferencia y ya existe resuelto: el modelo de lenguaje, las señales de demanda, la infraestructura, la autenticación, los datos de clima y de reservas.

**Se construye** el criterio: el modelo de datos que describe cliente y experiencia, las reglas duras que descartan lo imposible, el sistema de pesos que la agencia configura, la verificación del argumento y el circuito que registra qué se propuso y qué se descartó.

> *La señal de demanda no la construyo porque ya existe comprada. Lo que no se compra en ningún sitio es el criterio que convierte esa señal en una propuesta para un cliente concreto.*

### Fuera de alcance, dicho antes de que lo pregunten

No reserva. No cobra. No habla con el cliente final. No sustituye al agente: la decisión final es siempre suya, y el sistema está diseñado para que pueda contradecirla.

---

# 3 · Flujo de usuario a alto nivel

### Flujo A · El agente atiende a un cliente

1. **Entrada en lenguaje natural.** El agente escribe lo que le está contando el cliente, con sus palabras: *«Pareja de 45 con dos niños de 5 y 8. Unos 3.500 en total, primera quincena de agosto, una semana. Ella quiere playa y él dice que en la playa se aburre.»*
2. **Perfil extraído y revisable.** El sistema devuelve el perfil estructurado y, junto a cada campo, **el trozo exacto de la frase del que sale**. El agente corrige lo que no cuadre. Si no queda claro si el presupuesto es total o por persona, el sistema **se niega a continuar** hasta que lo confirme.
3. **Descarte.** Las reglas duras eliminan lo imposible: fuera de presupuesto, mal mes, vuelo demasiado largo con niños pequeños, veto comercial, visado sin plazo, sin cupo. Esto lo hace código.
4. **Orden.** Lo que sobrevive se ordena con los pesos que ha configurado la agencia, incluida la señal de demanda del destino.
5. **Salida.** **Dos opciones concretas** con precio por persona, total del grupo, noches y tres frases de argumento construidas solo con datos de la ficha.
6. **Iteración.** Si no encajan, el agente descarta una diciendo por qué, o afina (*«más barato»*, *«vuelo más corto»*) y recalcula. **Cada descarte queda registrado con su motivo.**
7. **Sin resultados.** Si nada cumple, el sistema no devuelve una pantalla vacía: enseña las que menos incumplen indicando qué regla rompen y por cuánto. Y si lo único que queda incumple una regla **inviolable**, no propone nada y lo explica.

### Flujo B · La dirección ajusta el criterio

Entra al panel y mueve palancas de negocio en una escala de 1 a 5: cuánto pesa el encaje con el cliente, la demanda del destino, el margen, los destinos de campaña y liquidar cupo. Marca destinos de campaña y añade vetos por destino y mes. Guarda, y desde ese momento **todos los agentes recomiendan con el criterio nuevo**.

### Flujo C · La dirección decide qué promover al mercado

Distinto del anterior, y conviene no confundirlos. En el cuadro de mando ve los destinos ordenados por demanda, con un indicador de si sube o baja y **qué hacer con cada uno**: empujar ahora, subir precio antes que promocionar, revisar precio o retirar de campaña, liquidar cupo. Esa es una decisión de mercado; el flujo B es cómo esa decisión llega al agente.

### Flujo D · El bucle (diseñado, v2)

El resultado real de cada propuesta —reservada, descartada, perdida— vuelve al sistema. Los pesos dejan de ser una opinión de la dirección y pasan a corregirse con lo que se vende de verdad.

---

# 4 · Enfoque de arquitectura

### El principio que ordena todo

> **La IA nunca decide. Descarta el código, ordenan los pesos de la agencia, y la IA solo lee texto libre al principio y redacta al final.**

Si esa frase se entiende, el sistema se entiende. Y responde de antemano a las dos preguntas que siempre llegan: *¿y si alucina?* (no puede: no elige) y *¿es reproducible?* (sí: mismo cliente y mismas reglas, misma respuesta).

### Las capas

**1 · Fuentes dispersas.** Seis, de naturaleza deliberadamente distinta: el catálogo interno de la agencia (estructurado, manual), el interés por destino (serie diaria externa), el clima (numérico, estable), las reservas reales, el precio de vuelo y el calendario escolar. Que una sea un Excel que actualiza una persona y otra una API que cambia cada hora **es el punto**: si todas fueran iguales, unificarlas no demostraría nada.

**2 · Ingesta en lote, desacoplada del consumo.** Un proceso nocturno lee cada fuente, la normaliza y la deja escrita. **El motor no llama nunca a una API externa durante una recomendación.**

**3 · El almacén unificado.** Aquí está el mecanismo real de la unificación, y no son los conectores: es que **todas las fuentes aterrizan en la misma forma** — qué destino, qué mes, qué métrica, qué valor, de dónde salió, cuándo se obtuvo y en qué estado está. Encima de eso, una **ficha unificada por destino y mes** que es lo único que el motor consulta. Añadir una séptima fuente es escribir un conector, no tocar el motor.

**4 · El motor determinista.** Reglas duras en dos niveles y puntuación ponderada. Sin IA.

**5 · La capa de IA, en tres sitios y solo tres.** Leer las notas del agente, redactar el argumento de las dos propuestas ya elegidas, y responder consultas sobre datos que ya están en la base. En ninguno de los tres decide qué se recomienda.

**6 · Registro y bucle.** Cada recomendación y cada descarte se guardan. Es el activo que hace que el producto valga más cada mes.

### Los dos niveles de regla dura

No todas pesan lo mismo, y tratarlas igual es un error de producto:

| Nivel | Reglas | Qué implica |
|---|---|---|
| **Relajables** | presupuesto, duración, temporada, desaconsejado en julio y agosto | Pueden proponerse como «lo más cercano» si no hay alternativa, siempre con el aviso y la magnitud del incumplimiento |
| **Inviolables** | vuelo largo con menores de 6, restricciones declaradas del cliente, no apto para niños, cupo, visado sin plazo, veto comercial | No aparecen nunca. Ni como alternativa, ni con aviso |

**El criterio de separación**: una regla es relajable si protege la **calidad de la experiencia**, e inviolable si protege al **cliente o a la operación**. Que Roma sea incómoda en agosto es calidad — si el cliente insiste, el agente debe poder vendérselo avisando. Un vuelo de diez horas con un bebé no se negocia: acaba en reclamación.

### La verificación del argumento

Decirle al modelo «no inventes» no vale nada. Hay que comprobarlo, y se comprueba **en código, no en el prompt**:

1. Cada campo que el modelo dice haber citado tiene que existir en la ficha.
2. Se extrae cada número del argumento y se comprueba que aparece en algún campo de esa ficha. El precio total del grupo se acepta como múltiplo del precio por persona.
3. **Si alguna comprobación falla, el argumento no se muestra**: se enseñan los tres motivos del catálogo tal cual y se registra el fallo.

Por eso el sistema puede afirmar «campos inventados: 0» como un hecho medido y no como una promesa.

### Hoy y en producción

| Componente | Hoy | En producción | Por qué cambia |
|---|---|---|---|
| Catálogo | CSV de 30 experiencias | Conector al PMS de la agencia | El catálogo real cambia a diario |
| Ingesta | Funciones programadas | Orquestador con reintentos, alertas y monitorización de frescura | Cuando una fuente falle a las 3 de la mañana alguien tiene que enterarse |
| Almacén | Postgres | **Postgres.** No cambia | Este problema no tiene volumen: decenas de miles de filas. Meter un almacén analítico sería sobreingeniería |
| Motor | Función de servidor | Servicio versionado con registro de qué versión de reglas generó cada recomendación | Auditoría: dentro de un año habrá que explicar por qué se recomendó lo que se recomendó |
| Capa de IA | Proveedor intercambiable por variable de entorno | Modelo pequeño para extraer, caché de argumentos, evaluación automática continua | Coste y control de calidad |
| Interfaz | Aplicación web propia | **Integrada en el CRM donde el agente ya trabaja** | Una herramienta más que abrir es una herramienta que no se usa |
| Seguridad | Autenticación básica | Roles, trazabilidad, retención y anonimización (RGPD) | Se tratan datos personales de clientes reales |

### Lo que se degrada, no lo que se rompe

| Si falla | Qué pasa |
|---|---|
| Señal de interés | Se usa la última lectura y su peso baja según antigüedad |
| Clima | Caché permanente; prácticamente no falla |
| Reservas / precio de vuelo | Cae a la banda estática del catálogo, marcado como no disponible |
| Modelo de lenguaje | **El sistema sigue funcionando**: el perfil se extrae con reglas y el argumento cae a los motivos del catálogo |
| Catálogo | **Esto sí bloquea.** Única dependencia dura, y es interna |

La regla que lo unifica: **una señal que falta nunca se sustituye por un valor inventado.** Se reduce su peso y se marca. Rellenar huecos con supuestos es lo que produce recomendaciones que nadie sabe explicar.

---

# 5 · Principales decisiones de producto y trade-offs asumidos

| Decisión | Alternativa descartada | Por qué | Qué sacrifico |
|---|---|---|---|
| **La demanda entra como factor de la recomendación, no como panel independiente** | Un cuadro de mando de tendencias | Un dato que no cambia una decisión no vale nada | La dirección pierde profundidad analítica. Lo compenso con el flujo C |
| **La señal se compra; se construye el criterio** | Desarrollar mi propia lectura de demanda | Está resuelto en el mercado. El desarrollo propio va donde está la ventaja | Dependo de terceros. Acotado: cada fuente es un conector sustituible |
| **Las reglas las configura la agencia, no vienen cableadas** | Reglas fijas escritas por mí | Convierte un algoritmo en plataforma: el criterio pasa a ser un activo, y el producto es vendible a otra agencia | Más superficie de producto, y un administrador al que hay que formar |
| **Jerarquía estricta: reglas > pesos > IA** | Dejar que la IA decida con el catálogo delante | Nunca alucina un precio ni salta un presupuesto, y es reproducible | Pierdo flexibilidad ante matices raros que un modelo suelto captaría mejor |
| **Dos niveles de regla dura** | Tratarlas todas igual | Pasarse 50 € del presupuesto no puede pesar lo mismo que un vuelo de 10 h con un bebé | Una clasificación más que mantener, y discutible caso a caso |
| **Dos opciones, no diez** | Una lista de resultados | Dos opciones obligan a comparar; diez obligan a elegir. Un buscador ya devuelve doscientos resultados y por eso no ayuda | Si las dos fallan, la primera impresión es mala. Lo compenso con la iteración |
| **Extracción determinista como suelo, modelo como mejora** | Depender del modelo para leer las notas | El copiloto funciona sin clave, sin red y sin coste, y da el mismo resultado ante la misma entrada | Las reglas captan menos matiz. Por eso el modelo rellena huecos cuando está |
| **La IA solo argumenta citando campos reales, y se verifica en código** | Redacción libre revisada por el agente | El argumento es verificable frase por frase — condición para que un agente veterano se fíe | Texto más seco que el de un copy humano |
| **Pesos en escala 1-5, no porcentajes** | Reparto porcentual sobre 100 | Quien mueve las palancas es un responsable comercial, no un analista. «Cuánto me importa esto, del 1 al 5» se entiende sin formación | Menos granularidad fina |
| **Cuando nada encaja, enseño lo más cercano y qué regla incumple** | Devolver cero resultados | El agente ve el margen de negociación en vez de una pantalla vacía | Riesgo de acostumbrarse a saltarse reglas. Por eso solo se relajan las relajables |
| **Sin scrapers** | Extraer de comparadores, reseñas y redes sociales | Incumple sus términos de servicio, exige proxies de pago y se rompe cuando cambia una clase de CSS. Y contradice la propia decisión de que la señal se compra | No accedo a reseñas ni a redes. Asumido: una reseña habla de la calidad de la experiencia, no de la demanda |
| **El encaminamiento del chat es determinista** | Que el modelo decida si es consulta o perfil | El mismo texto tiene que ir al mismo sitio siempre | Casos ambiguos que un modelo resolvería mejor |

---

# 6 · Cómo se mide

**Métrica principal: tasa de conversión propuesta → reserva.** Es la única que conecta los dos problemas del brief en una frase: *si no entiendes la demanda, promocionas el destino equivocado y propones lo que no se cierra.*

**Cómo se mide sin histórico**: agentes con la herramienta contra agentes sin ella, mismo periodo y misma cartera. Es la única forma limpia de atribuir el efecto.

**De apoyo**: tiempo por propuesta (la que se demuestra en vivo) y margen medio por reserva (la que le importa a la dirección).

### El orden de magnitud, con los supuestos encima de la mesa

Ninguno de estos números es un dato: son **hipótesis explícitas** para dimensionar si el esfuerzo merece la pena. La estructura importa más que las cifras, porque la agencia puede sustituirlas por las suyas.

| Supuesto | Valor | De dónde sale |
|---|---|---|
| Agentes comerciales | 25 | Hipótesis sobre una plantilla de 80-120 |
| Clientes atendidos por agente y día | 8 | Hipótesis |
| Días laborables al mes | 20 | Dato |
| Conversión actual propuesta → reserva | 20 % | **Hipótesis a validar con su histórico** |
| Ticket medio por reserva | 2.400 € | Hipótesis coherente con el catálogo |
| Margen medio | 22 % → 528 € por reserva | Media del catálogo modelado |

Con eso: **4.000 clientes al mes** y **800 reservas**.

| Si la conversión sube… | Reservas extra/mes | Margen extra/mes | Margen extra/año |
|---|---|---|---|
| +1 punto | 40 | 21.000 € | 253.000 € |
| **+3 puntos** | **120** | **63.000 €** | **760.000 €** |
| +5 puntos | 200 | 106.000 € | 1.270.000 € |

**Contra qué se compara**: el coste del sistema son céntimos por recomendación en llamadas al modelo, más infraestructura. Es decir, **el retorno no depende de acertar la cifra: depende de que el efecto sea distinto de cero.** Un solo punto de conversión ya paga el desarrollo con mucho margen.

**La palanca secundaria, que no está en la tabla**: hoy el agente prepara una o dos propuestas porque no le da tiempo a más. Con el sistema puede preparar cinco y descartar tres. Más opciones buenas por cliente es más probabilidad de acertar, y ese efecto se suma al anterior.

**Y lo que hay que decir en voz alta**: estas cifras son una hipótesis, no una promesa. Lo primero que haría en el proyecto real es sustituir cada supuesto por el dato de la agencia. La conversión actual y el ticket medio los tienen ellos.

---

# 7 · Siguientes pasos del producto

**v2 · Se cierra el bucle.** Se conecta el resultado real de cada propuesta. Los pesos dejan de ser una opinión y se corrigen con lo que se vende. Aquí el producto empieza a valer más cada mes que pasa, y la señal externa deja de ser imprescindible: el mejor dato de demanda pasa a ser el histórico propio de la agencia.

**v3 · El correo de propuesta** — la pata 3 del brief, reducida a su pieza útil.

*Propuesta de arquitectura*: al pulsar «enviar propuesta», una función toma las dos opciones ya elegidas, su argumento **ya verificado** y el perfil del cliente, y compone un correo con una plantilla de la agencia. El modelo solo redacta el saludo y la transición entre las dos opciones; los datos, precios y argumentos entran tal cual, sin pasar por él. La misma verificación de números se aplica al texto final antes de mostrarlo. El agente lo revisa y envía desde su propio correo — el sistema no envía nada por su cuenta. Y el envío queda registrado, lo que cierra la última pieza del bucle: propuesta enviada → reserva o no.

Va la última porque **depende de que todo lo anterior funcione**: sin recomendación fiable y sin argumento verificado, generar el correo es automatizar un error.

**v4 · Reglas en lenguaje natural.** El administrador escribe *«en agosto no ofrezcas Caribe, es temporada de huracanes»* y el sistema lo convierte en una regla estructurada que puede revisar y desactivar.

**v5 · Comparación con el mercado.** El sistema le dice al agente cómo está de precio frente a la competencia, para que pueda defender la propuesta delante del cliente.

El orden no es casual: **cada versión necesita el dato que genera la anterior.**

---

# 8 · Prueba de concepto · Qué está implementado

> El brief pide *implementación funcional, aunque sea parcial, de una parte clave del MVP*.

**La parte clave elegida: el circuito completo de decisión.** De las notas de una llamada a dos propuestas argumentadas, pasando por la ingesta de fuentes, las reglas y los pesos. Es la parte que, si no funciona, invalida el resto del producto.

### Funcionando de verdad

- **Ingesta de dos fuentes externas reales**, ambas oficiales, gratuitas y sin clave: interés por destino (vistas diarias, ventanas de 28 días) y clima (archivo histórico por coordenadas). Escriben normalizadas en la tabla de señales.
- **Cuadro de mando de demanda**: destinos ordenados, indicador de subida o bajada, y la acción recomendada para cada uno, calculada con umbrales explícitos.
- **Motor completo**: 8 reglas duras en dos niveles, puntuación con 5 pesos leídos de la base, modo de «lo más cercano» y modo de «no hay nada admisible».
- **Copiloto**: extracción del perfil desde texto libre —determinista, funciona sin modelo—, dos propuestas, detalle, descarte con motivo, iteración y registro.
- **Panel de criterio comercial**: pesos, campañas y vetos, con efecto inmediato.
- **Verificación del argumento** en código, con su contador de campos citados e inventados.
- **Modo técnico** con la traza de la orquestación.
- **33 pruebas automáticas** sobre reglas, verificación del argumento, extracción y acciones del cuadro de mando.

### Diseñado y documentado, no construido

- Las otras cuatro fuentes: reservas reales, precio de vuelo, calendario escolar y catálogo conectado al PMS. **La de reservas está implementada** pero desactivada, porque su entorno de pruebas solo publica periodos históricos y **una señal de demanda con datos de hace años no es una señal de demanda**.
- El bucle de aprendizaje: el registro ya se escribe; lo que falta es el resultado real de reserva.
- El correo de propuesta.

---

# 9 · La demo · Servicios, orquestación y puntos críticos

> El brief pide *demo suficiente para explicar los servicios, cómo se orquestan los flujos y dónde están los puntos críticos*. La demo está construida para eso, no para lucir.

### Los servicios, y por qué cada uno

| Servicio | Para qué | Interno / externo |
|---|---|---|
| Base de datos Postgres | Catálogo, señales, pesos, vetos, registro | Gestionado |
| Wikimedia · vistas de página | Señal de interés por destino | Externo, oficial, sin clave |
| Open-Meteo · archivo | Clima por destino y mes | Externo, oficial, sin clave |
| Amadeus | Reservas reales y precio de vuelo | Externo, oficial, con clave |
| Modelo de lenguaje | Extraer perfil, redactar argumento, responder consultas | Externo, **intercambiable por variable de entorno** |
| Motor de reglas y pesos | Descartar y ordenar | **Propio** |

### Cómo se orquestan, en dos tiempos

**De noche, en lote**: los conectores leen sus fuentes, normalizan y escriben en la tabla de señales. Nada de esto ocurre durante una recomendación.

**En caliente, al pedir**: notas → extracción (determinista, y modelo si está) → el agente confirma → reglas duras descartan → pesos ordenan → el modelo redacta sobre las dos finalistas → verificación → pantalla. Un solo camino, sin llamadas externas.

**El interruptor de modo técnico** abre la traza real de la última recomendación: estado y antigüedad de cada fuente, cuántas experiencias entraron y cuántas descartó cada regla, los pesos aplicados, el tiempo y los tokens de cada llamada al modelo, y el resultado de la verificación.

### Dónde están los puntos críticos

| # | Punto crítico | Por qué lo es | Cómo está mitigado |
|---|---|---|---|
| 1 | **La calidad del catálogo** | Si los motivos de cada ficha están mal escritos, el argumento suena a folleto y ninguna IA lo arregla | 30 fichas revisadas a mano. Es trabajo de la agencia, no del sistema |
| 2 | **La extracción del perfil** | Único punto donde se interpreta texto libre. Confundir un presupuesto por persona con el total lo multiplica por cuatro | Extracción determinista, cada dato con la frase de la que sale, y **bloqueo** si no está claro si el presupuesto es total o por persona |
| 3 | **Las fuentes externas** | Dependen de terceros y pueden caer o limitar | Ingesta en lote, degradación por antigüedad, y el motor nunca las llama en caliente |
| 4 | **La redacción del argumento** | Es donde un modelo podría inventar | Verificación en código, y si falla no se muestra |
| 5 | **El coste del modelo** | Se paga por recomendación | Solo interviene sobre las 2 finalistas, nunca sobre las 30. Y el sistema funciona sin él |
| 6 | **La adopción** | Un agente veterano no usa una herramienta que le contradice sin explicarse | Por eso el argumento citado no es un adorno: es la condición para que la herramienta se use |

### Lo que este producto no resuelve, y lo reconozco antes de que me lo pregunten

- **Las vistas de página miden interés, no intención de compra.** No son demanda real. La señal buena es el histórico de reservas de la agencia — que no existe todavía, y que este producto está diseñado precisamente para fabricar.
- **Los pesos iniciales son una hipótesis.** El primer mes el sistema recomienda según lo que la dirección *cree*. A partir de la v2, según lo que *funciona*.
- **El catálogo modelado tiene 30 experiencias.** El sistema escala igual con 3.000, pero la calidad de las fichas es un trabajo que alguien tiene que hacer.
- **La conversión que prometo es una hipótesis a validar**, y el primer entregable del proyecto real sería sustituir mis supuestos por sus datos.
