# La capa de ingesta y unificación
**Cómo cinco fuentes dispersas acaban en una recomendación**

> Esta es la respuesta al problema 01 del brief. Y es la parte de la que el brief dice: *"demo suficiente para explicar los servicios, cómo se orquestan los flujos y dónde están los puntos críticos"*.

---

## 1. El principio: ingesta y consumo, desacoplados

**El motor de recomendación no llama nunca a una fuente externa.** Un proceso en lote lee cada fuente, la normaliza y la deja escrita. Cuando el agente pide una recomendación, se lee lo que ya está cocinado.

Cuatro razones, y conviene tenerlas todas a mano:

| Motivo | Concreto |
|---|---|
| **Latencia** | Consultar cinco APIs en caliente son 4–8 segundos. Un agente con un cliente delante no espera |
| **Coste** | Se pagaría por llamada y por recomendación. En lote se paga una vez al día por destino |
| **Reproducibilidad** | El mismo cliente con las mismas reglas debe dar la misma respuesta. Con llamadas en vivo, no está garantizado |
| **Resiliencia** | Si una fuente cae, la señal envejece. Sin desacoplar, el producto entero cae |

---

## 2. El mecanismo de unificación

El truco no es tener muchos conectores. Es que **todas las fuentes, por distintas que sean, aterrizan en la misma forma**:

```
senales
├── fuente          catalogo | busquedas | clima | vuelos | calendario
├── destino_id      EXP14 / Creta
├── periodo         2026-08          (mes al que se refiere el dato)
├── metrica         interes_relativo | temp_media | precio_vuelo_ida_vuelta | ...
├── valor           numérico, normalizado 0-100 cuando aplica
├── valor_bruto     el original, sin tocar, para poder auditar
├── obtenido_en     timestamp
└── estado          ok | obsoleta | no_disponible
```

Una tabla, una forma. Da igual que una fuente sea un Excel que actualiza una persona a mano, otra una serie temporal semanal y otra una API de precios que cambia cada hora: **al llegar aquí todas son comparables**. Eso es lo que significa unificar datos dispersos, y es la frase que hay que decir en la entrevista.

Encima de eso, la **ficha unificada de destino** — una fila por destino y mes, que es lo único que el motor consulta:

```
ficha_destino  (destino_id, mes)
├── del catálogo:   precio, noches, cupo, margen, motivos, apto_niños, horas_vuelo
├── de búsquedas:   interés actual, tendencia 4 semanas vs 4 anteriores
├── de clima:       temperatura media, días de lluvia
├── de vuelos:      precio ida y vuelta desde Madrid, banda histórica
├── de calendario:  si el mes cae en ventana escolar
└── meta:           frescura de cada señal y cuáles faltan
```

---

## 3. Los cinco conectores

Todos implementan la misma interfaz: `obtener() → normalizar() → escribir()`. Añadir una sexta fuente es escribir un conector, no tocar el motor.

### 3.1 Catálogo de la agencia — *interna, manual*
- **Origen**: CSV/Excel exportado del sistema de la agencia (aquí, `catalogo_experiencias.csv`, 30 experiencias)
- **Frecuencia**: cuando la agencia lo actualiza
- **Sin clave**. Es el único dato propietario, y el único que no puede faltar
- **Si falla**: no hay producto. Es la dependencia dura

### 3.2 Búsquedas — *externa, serie temporal semanal*
- **Origen**: Google Trends. Consulta `viajar a {destino}` con `geo=ES`, ventana `today 3-m`
- **Por qué esa consulta y no el destino a secas**: "Bali" también lo busca quien ve un documental. "viajar a Bali" sesga hacia intención de viaje
- **Normalización**: media de las últimas 4 semanas contra las 4 anteriores → índice de tendencia
- **Frecuencia**: semanal. Diaria es ruido
- **Si falla**: se usa la última lectura y se marca `obsoleta`. El peso de demanda se reduce proporcionalmente a la antigüedad
- **Límite reconocido**: mide interés, no intención de compra

### 3.3 Clima — *externa, numérica, estable*
- **Origen**: Open-Meteo, archivo histórico. Gratis y **sin clave**
- **Consulta**: por `lat`/`lon` de cada destino (ya están en el catálogo), medias del mismo mes de los 3 años anteriores
- **Frecuencia**: una vez y a correr. El clima de agosto en Creta no cambia esta semana
- **Si falla**: prácticamente nunca, porque se cachea de forma permanente
- **Para qué sirve de verdad**: no es un adorno. Es lo que permite que el argumento diga *"26 grados de media en agosto"* en vez de *"buen tiempo"*. Y es lo que puede **contradecir la temporada que dice el catálogo** — un caso interesante que enseñar

### 3.4 Precios de vuelo — *externa, volátil, con clave*
- **Origen**: Amadeus for Developers, entorno de test (alta instantánea, gratuita)
- **Consulta**: precio ida y vuelta MAD → destino para el mes objetivo
- **Frecuencia**: diaria
- **Si falla**: **degradación controlada**. El destino no desaparece: cae a la banda de precio estática del catálogo y la señal se marca `no_disponible`. La traza lo muestra
- **Por qué es la señal más valiosa**: cruzada con la de búsquedas da la mejor lectura de negocio que tiene este sistema — *"sube el interés y el vuelo aún no ha subido: momento de empujarlo"*. Ninguna de las dos fuentes por separado dice eso
- **Es el punto crítico número uno** del sistema, y por eso es el que lleva el plan de degradación explícito

### 3.5 Calendario escolar y festivos — *estática, contexto*
- **Origen**: tabla propia con vacaciones escolares y puentes en España
- **Frecuencia**: una vez al año
- **Para qué**: marca qué meses son ventana real de viaje familiar. Recomendar a una familia con niños una salida en octubre es ignorar que no pueden

---

### 3.6 Reservas reales — *externa, oficial, con clave*
- **Origen**: Amadeus, destinos más reservados desde una ciudad de origen
- **Qué devuelve**: la cuota de reservas efectivas hechas en los sistemas de
  Amadeus, no una estimación
- **Frecuencia**: mensual
- **Si falla**: la señal se marca `no_disponible` con el motivo exacto visible
  en la interfaz. El resto del panel funciona igual
- **Por qué esta fuente y no scrapear un comparador**: un scraper de un portal
  de reservas intentaría aproximar este mismo dato incumpliendo términos de
  servicio, necesitando proxies de pago y rompiéndose cuando alguien cambie una
  clase de CSS. Aquí está servido oficialmente
- **Lo que aporta que ninguna otra da**: *interés es atención, reserva es
  intención consumada*. Wikipedia dice quién mira; Amadeus dice quién compra.
  Cruzar las dos es la lectura de negocio que sirve — un destino con mucho
  interés y pocas reservas es una oportunidad de conversión; con muchas
  reservas y poco interés, un producto que se vende solo
- **Límite reconocido**: son reservas de vuelo, no de paquete, y el entorno de
  pruebas publica periodos históricos concretos

## 3.bis Por qué no hay scrapers en este sistema

Se consideró extraer datos de comparadores, reseñas, redes sociales y portales
de reserva. Se descartó, y la decisión es deliberada:

1. **Términos de servicio.** Esos portales lo prohíben expresamente. Un sistema
   que una consultora entrega a un cliente no puede apoyarse en eso.
2. **Fragilidad.** Un scraper se rompe cuando cambia el HTML, sin avisar y en el
   peor momento.
3. **Coherencia con la decisión de producto.** La señal de demanda se compra
   porque ya existe; lo que no se compra es el criterio. Construir scrapers
   contradiría el propio alcance priorizado.

Las cinco fuentes elegidas son todas oficiales: dos sin clave (clima e interés)
y las demás con credenciales propias del cliente.

## 4. Política de frescura y degradación

Cada señal tiene una caducidad, y el sistema **nunca miente sobre lo que no sabe**:

| Fuente | Caduca a | Al caducar |
|---|---|---|
| Catálogo | — | Bloquea (sin catálogo no hay producto) |
| Interés | 14 días | El peso de demanda se reduce a la mitad; a los 30 días, a cero |
| Reservas | 45 días | Se sigue usando; es un dato de ciclo mensual |
| Clima | 1 año | Se reintenta; se sigue usando el valor viejo |
| Vuelos | 3 días | Cae a banda estática del catálogo |
| Calendario | 1 año | Se sigue usando |

**La regla de oro**: una señal que falta nunca se sustituye por un valor inventado. Se reduce su peso y se marca en la traza. Un sistema que rellena huecos con supuestos es exactamente lo que produce recomendaciones que nadie sabe explicar.

---

## 5. Dónde están los puntos críticos

Esto es lo que el brief pide explícitamente que la demo sepa explicar:

1. **Precios de vuelo** — API externa con clave, cuota limitada y datos volátiles. *Mitigado*: caché diaria y degradación a banda estática.
2. **Google Trends** — no es una API oficial estable y puede limitar por volumen. *Mitigado*: caché semanal, peso degradado por antigüedad, el producto funciona sin ella.
3. **Calidad del catálogo** — si el campo de motivos está mal escrito, el argumento suena a folleto. Ninguna IA lo arregla. *Mitigado*: 30 fichas revisadas a mano, y es trabajo de la agencia, no del sistema.
4. **La extracción del perfil desde las notas** — es el único punto donde la IA interpreta texto libre y puede equivocarse. *Mitigado*: rellena un formulario que el agente ve y corrige antes de que el motor haga nada.
5. **El coste del modelo** — se paga por recomendación. *Mitigado*: la IA solo interviene en dos sitios (leer notas, redactar argumento), y solo sobre las 2 opciones finales, no sobre las 30.

---

## 6. Cómo se enseña esto en la demo

El interruptor de modo técnico abre una traza como esta, junto al resultado:

```
FICHA UNIFICADA        30 destinos · 5 fuentes
  catálogo    30/30  ok       actualizado hoy
  clima       30/30  ok       caché permanente
  búsquedas   30/30  ok       hace 2 días
  vuelos      27/30  ok       hace 4 h  · 3 sin dato → banda estática
  calendario  30/30  ok       estática

REGLAS DURAS           30 → 14
  presupuesto (875 €/pax) ······ descarta 11
  vuelo > 6 h con menores de 6 ·· descarta 4
  fuera de temporada (agosto) ··· descarta 1

PESOS                  14 ordenadas
  encaje cliente 40 · demanda 15 · margen 20 · campaña 15 · cupo 10

IA                     2 opciones
  extracción de perfil   0,9 s   · 1.200 tokens
  redacción argumentos   1,8 s   · 2.400 tokens
  campos citados: 6 · campos inventados: 0
```

Esa última línea — **campos citados: 6 · campos inventados: 0** — es la que responde a la pregunta que van a hacer sí o sí.
