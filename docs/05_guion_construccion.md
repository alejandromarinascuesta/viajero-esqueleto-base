# Guion de construcción
**De cero a plataforma funcional desplegada, en tres pasos**

> Cada mensaje a Lovable consume créditos. Estos tres están escritos para que cada uno produzca algo que funciona y se pueda comprobar antes de seguir. No improvises mensajes intermedios: si algo falla, corrige con una instrucción concreta sobre lo que falla.

---

## Paso 0 · Base de datos (gratis, sin Lovable)

1. Crea un proyecto nuevo en Supabase (o usa uno vacío).
2. Abre el editor SQL y pega entero `seed_catalogo.sql`.
3. Comprueba: `select count(*) from experiencias;` → debe devolver **30**.

Con esto ya tienes el esquema completo (experiencias, señales, pesos, vetos, recomendaciones, descartes) y el catálogo cargado. Lovable solo construye la aplicación encima.

---

## Paso 1 · La plataforma funcional mínima

**Objetivo**: meter un perfil y que salgan dos propuestas. Sin IA, sin fuentes externas, sin panel. Si esto funciona, el resto es añadir capas.

> Copia desde aquí:

Construye una aplicación web interna para agentes de una agencia de viajes, conectada a mi proyecto de Supabase, donde las tablas ya existen y el catálogo ya está cargado. No crees tablas ni datos de ejemplo.

Una sola pantalla, "Nueva recomendación", con dos zonas:

**Izquierda — perfil del cliente**: adultos (número), niños (número y edad de cada uno), presupuesto total en euros, casilla "presupuesto flexible", mes del viaje, días disponibles, motivación (descanso / cultura / aventura / romántico / celebración), intensidad deseada (1 a 5), restricciones (selección múltiple: movilidad reducida, no vuelos largos, presupuesto ajustado), destinos ya visitados (selección múltiple del catálogo) y un campo de texto libre "tensión declarada". Botón "Recomendar".

**Derecha — resultado**: las dos experiencias recomendadas, cada una como una tarjeta con nombre, destino, precio por persona, precio total para el grupo, noches, y tres líneas de argumento tomadas de los campos motivo_1, motivo_2 y motivo_3 de esa experiencia. Nada más: no inventes texto.

La lógica va en una función de servidor, en dos fases separadas y en este orden:

**Fase 1, reglas duras.** Descartan y no se negocian. Precio por persona = presupuesto_total / (adultos + niños); descarta si precio_desde_pp lo supera, con un 10% de margen solo si "flexible" está marcado. Descarta si noches > días disponibles. Descarta si hay algún niño menor de 6 años y horas_vuelo > 6. Descarta si el mes está fuera de temporada_agencia (formato "4-10", y ojo que "10-4" significa de octubre a abril cruzando el año). Descarta si hay niños y apto_ninos es "bajo". Descarta si alguna restricción del cliente aparece en el campo no_recomendado_si. Descarta si el mes es julio o agosto y no_recomendado_si contiene "julio y agosto". Descarta si cupo es 0.

**Fase 2, puntuación.** Ordena las supervivientes con los pesos que están en la tabla `pesos` (encaje_cliente 40, demanda 15, margen 20, campana 15, cupo 10). Cada factor se normaliza entre 0 y 1:
- encaje_cliente: 0,5 si el tipo de la experiencia encaja con la motivación (descanso→playa, cultura→cultural o ciudad, aventura→aventura o naturaleza, romántico→playa o ciudad), más 0,3 por cercanía entre intensidad de la experiencia y la deseada, más 0,2 si hay niños y apto_ninos es "alto". Resta 0,3 si el destino está en los ya visitados.
- demanda: por ahora 0,5 fijo para todas (se conectará después).
- margen: margen_pct normalizado entre el mínimo y el máximo del catálogo.
- campana: 0 por ahora.
- cupo: mayor cuanto menor sea el cupo restante.

**Si ninguna experiencia sobrevive a las reglas duras**: muestra igualmente las dos que menos incumplen, marcadas claramente, indicando qué regla rompen y por cuánto (por ejemplo "420 € por encima del presupuesto" o "fuera de temporada, disponible de mayo a octubre"), y un aviso al agente de que afine la búsqueda.

Interfaz sobria, tipo herramienta interna: sin degradados, sin iconos decorativos, sin textos de marketing. Español de España.

> Hasta aquí.

**Comprueba antes de seguir**: mete 2 adultos + niños de 5 y 8, 3.500 €, agosto, 7 días → deben salir opciones nacionales de playa. Mete 2 adultos + niño de 2, 8.000 €, julio, 10 días → la Riviera Maya **no puede aparecer**.

---

## Paso 2 · El panel de la dirección y el registro

> Copia desde aquí:

Añade dos cosas a la aplicación.

**Una segunda pantalla, "Criterio comercial"**, para el responsable de la agencia: cinco deslizadores que editan la tabla `pesos` (encaje del cliente, demanda del destino, margen, destinos de campaña, liquidar cupo), mostrando siempre la suma de los cinco. Debajo, una lista donde puede marcar destinos como "de campaña" y añadir vetos por destino y mes, que se guardan en la tabla `vetos` y se aplican como reglas duras. Los cambios afectan de inmediato a las recomendaciones.

**Iteración y registro en la pantalla del agente**: bajo cada tarjeta, un botón "descartar" que pide un motivo breve y vuelve a calcular sin esa experiencia. Cada recomendación se guarda en la tabla `recomendaciones` (perfil, número de candidatas, número de supervivientes, propuestas) y cada descarte en `descartes` con su motivo. Añade también un campo rápido "afinar" donde el agente escribe algo como "más barato" o "vuelo más corto" y se recalcula.

> Hasta aquí.

---

## Paso 3 · Las fuentes externas, la IA y el modo técnico

> Copia desde aquí:

Añade tres capas.

**Ingesta en lote.** Cinco funciones programadas que escriben todas en la tabla `senales` con la misma estructura, una por fuente: catálogo (interno), búsquedas por destino, clima por destino y mes (Open-Meteo, gratis y sin clave, usando lat y lon de cada experiencia), precio de vuelo (Amadeus) y calendario escolar español. Ninguna se llama durante una recomendación: el motor solo lee `senales`. Si una fuente falla, la señal se marca como no disponible y el peso de ese factor se reduce; nunca se inventa un valor.

**La IA, en dos sitios y solo dos.** Primero: un campo de texto libre donde el agente pega sus notas de la llamada y un modelo de lenguaje las convierte en el formulario ya relleno, que el agente puede corregir antes de recomendar. Segundo: la redacción del argumento de las dos propuestas finales, con una instrucción estricta de usar únicamente datos presentes en la ficha de esa experiencia (motivos, precio, noches, temperatura, horas de vuelo). Si un dato no está en la ficha, no puede mencionarlo. La IA no interviene en ningún momento en el descarte ni en el orden.

**Modo técnico.** Un interruptor en la cabecera que abre un panel lateral con la traza de la última recomendación: estado y antigüedad de cada una de las cinco fuentes, cuántas experiencias entraron y cuántas descartó cada regla, los pesos aplicados, el tiempo y el coste de cada llamada al modelo, y cuántos campos citó el argumento. La aplicación arranca siempre con el modo técnico apagado.

> Hasta aquí.

---

## Paso 4 · Despliegue

Desde Lovable, publicar y conectar a Vercel. Comprobar en el dominio público que las dos pantallas cargan y que una recomendación completa funciona de principio a fin.

**Regla de seguridad para la presentación**: haz el despliegue el penúltimo día, no el último. Y ten una captura de pantalla de cada uno de los tres casos de prueba guardada en local, por si el día de la entrevista falla la conexión.

---

## Orden de prioridad si se acaba el tiempo

1. **Paso 1** — sin esto no hay nada
2. **Paso 2** — es lo que convierte el algoritmo en plataforma, y es lo que distingue tu caso del de otro candidato
3. **Paso 3, la IA** — dos usos, ambos rápidos
4. **Paso 3, el modo técnico** — lo pide el brief explícitamente, no lo dejes caer
5. **Paso 3, las cinco fuentes** — si solo da tiempo a dos, que sean clima (gratis, no falla) y búsquedas
