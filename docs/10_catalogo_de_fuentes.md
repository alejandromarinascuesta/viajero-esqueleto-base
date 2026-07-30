# Catálogo de fuentes
**Qué podemos saber, qué no, y cada cuánto**

> El brief dice que *tendencias de viaje, intereses de usuarios, reseñas, redes sociales y plataformas de reserva están dispersas en múltiples fuentes*. Este documento es la respuesta completa: qué fuente cubre cada cosa, cuánto cuesta, cada cuánto se refresca, y **qué se queda fuera del alcance de cualquier fuente**.

---

## 1. Primero, la corrección sobre la frecuencia

Actualizar todas las fuentes cada hora es un error de diseño, no una mejora. Las vistas de página se publican una vez al día. El clima histórico de agosto no cambia nunca. Los festivos, una vez al año.

**El diseño correcto es un planificador que corre cada hora y solo ejecuta lo que toca.** Cada fuente declara su cadencia y su caducidad; el planificador mira qué está vencido y solo llama a eso.

```
cada hora  →  ¿qué fuentes están vencidas?  →  ejecutar solo esas
```

Qué compra esto: **coste** (no se paga por llamadas que devuelven lo mismo), **cuota** (las APIs con límite no se agotan en refrescos inútiles), **velocidad** (una ronda horaria tarda segundos, no minutos) y **honestidad** (la interfaz puede decir la antigüedad real de cada dato en vez de fingir que todo es de hace una hora).

Y da la frase para la entrevista: *la frescura no es una virtud uniforme; cada dato tiene su ritmo, y tratarlos igual es pagar por precisión que nadie usa.*

---

## 2. Las preguntas de negocio, y si tienen respuesta

Antes del catálogo, lo que de verdad importa: qué necesita saber la agencia y hasta dónde llega el dato.

| Lo que necesitan saber | ¿Se puede saber? | Con qué |
|---|---|---|
| ¿Qué destinos están captando atención ahora? | **Sí** | Vistas de página, tendencias de búsqueda |
| ¿Por qué sube uno en concreto? | **Sí, en parte** | Eventos, conectividad aérea, precio del vuelo, clima |
| ¿Cuánto cuesta llegar, y va a subir? | **Sí** | Precios y calendario de vuelos |
| ¿Cuándo conviene ir? | **Sí** | Clima histórico y previsión, temporada, festivos y calendario escolar |
| ¿Es seguro y qué papeles hacen falta? | **Sí** | Avisos oficiales de viaje, requisitos de visado |
| ¿Qué opinan los que ya fueron? | **Sí, pagando** | APIs oficiales de reseñas |
| ¿Cuánta gente ha ido realmente? | **Sí, con retraso** | Estadística oficial de turismo |
| ¿Qué se está reservando **ahora** en el mercado? | **Solo con contrato comercial** | Datos de GDS en producción |
| ¿Qué se dice en redes sociales? | **No de forma legítima** | Ver apartado 5 |
| ¿Qué busca **mi** cliente concreto? | **No desde fuera** | Solo su CRM |
| ¿Qué convierte en **mi** agencia? | **No desde fuera** | Solo su histórico — y es el activo que este producto fabrica |

**Las tres últimas filas son la conclusión estratégica del documento.** Todo lo externo describe el mercado. Solo el dato propio describe el negocio. Por eso la señal comprada es un andamio y el bucle de aprendizaje es el cimiento.

---

## 3. El catálogo, por bloques

Leyenda de estado: **✅ implementada** · **🔑 lista, requiere clave** · **📋 diseñada**

### A · Atención e interés

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Wikimedia Pageviews** | Vistas diarias del artículo de cada destino. Tendencia 28 días vs 28 anteriores | 24 h | Gratis, sin clave | ✅ |
| **Google Trends** vía proveedor con licencia | Interés de búsqueda relativo, con intención (`viajar a X`) | 24 h | Nivel gratuito limitado | 📋 |
| **Wikidata** | Metadatos del destino: población, coordenadas, tipo | Anual | Gratis, sin clave | 📋 |

*Por qué Wikipedia y no un scraper de Google: es una API oficial, sin clave, que no se rompe y que no incumple términos de nadie. Mide lo mismo — atención sobre un destino.*

### B · Vuelos y conectividad

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Amadeus Flight Offers** | Precio ida y vuelta desde el origen al destino, por fecha | **1 h** | Gratis en pruebas, por llamada en producción | 🔑 |
| **Amadeus Most Booked / Most Traveled** | Destinos más reservados y más viajados desde una ciudad | 24 h | Idem | 🔑 (pruebas solo publica periodos históricos) |
| **Amadeus Flight Inspiration** | «Con 500 € desde Madrid, ¿a dónde llego?» | 6 h | Idem | 📋 |
| **OpenSky Network** | Llegadas reales a un aeropuerto. Tráfico efectivo, no programado | 6 h | Gratis, uso no comercial | 📋 |
| **OpenFlights / OurAirports** | Rutas, aeropuertos, códigos IATA | Anual | Gratis, conjunto abierto | 📋 |

*El precio del vuelo es la única fuente que justifica cadencia horaria. Y cruzado con el interés da la mejor lectura del sistema: **sube la atención y el vuelo todavía no ha subido → momento de empujarlo**.*

### C · Clima

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Open-Meteo Archive** | Temperatura media y lluvia del mismo mes en años anteriores | Anual | Gratis, sin clave | ✅ |
| **Open-Meteo Forecast** | Previsión a 16 días | **1 h** | Gratis, sin clave | 📋 |
| **Open-Meteo Marine** | Temperatura del agua — relevante en destinos de playa | 24 h | Gratis, sin clave | 📋 |

*El clima no es adorno: permite que el argumento diga «26 grados de media en agosto» en vez de «buen tiempo», y puede **contradecir la temporada que declara el catálogo**, que es un caso interesante de enseñar.*

### D · Eventos — por qué sube un destino

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Ticketmaster Discovery** | Conciertos, deporte y espectáculos por ciudad y fecha | 12 h | Clave gratuita | 📋 |
| **PredictHQ** | Eventos **puntuados por impacto en demanda**, 18 categorías, incluidos los no programados | 12 h | Comercial | 📋 |
| **Nager.Date** | Festivos oficiales por país | Anual | Gratis, sin clave | 📋 |
| **Calendario escolar autonómico** | Ventanas reales de viaje familiar | Anual | Tabla propia | 📋 |

*Esta es la capa que convierte «Lisboa sube un 30 %» en «Lisboa sube un 30 % **porque** hay un festival el 12 de agosto». Es la diferencia entre un dato y una explicación. [PredictHQ](https://www.predicthq.com/events/travel) es el producto de referencia; [Ticketmaster](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) es la versión gratuita y más limitada.*

### E · Contexto de viaje

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Avisos de viaje oficiales** (MAEC, FCDO, State Dept) | Recomendaciones y alertas por país | 24 h | Gratis | 📋 |
| **Requisitos de visado** | Si hace falta visado y plazo de tramitación | Anual | Conjunto propio | ✅ (en catálogo) |
| **Tipo de cambio** (BCE) | Coste real fuera de la eurozona | 24 h | Gratis, sin clave | 📋 |

*Un aviso oficial de seguridad debería entrar como **regla dura inviolable**, no como peso: no se relaja porque el cliente insista.*

### F · Demanda consumada

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **INE · FRONTUR / EGATUR** | Viajeros y gasto por destino, oficial de España | Mensual | Gratis | 📋 |
| **Eurostat · turismo** | Pernoctaciones por región europea | Mensual | Gratis | 📋 |
| **Amadeus / ForwardKeys producción** | Reservas reales agregadas del mercado | 24 h | Contrato comercial | 📋 |

*Lento pero sólido: es el contrapeso honesto a las señales de atención. Sirve para calibrar si lo que sube en interés acaba en viajes de verdad.*

### G · Reseñas y percepción

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Google Places** | Valoración y reseñas de puntos de interés | 7 días | Por llamada | 📋 |
| **TripAdvisor Content API** | Valoración y contenido oficial, con atribución | 7 días | Nivel gratuito | 📋 |

*Matiz importante: **una reseña habla de la calidad de la experiencia, no de la demanda.** Su sitio no es la señal de demanda sino la **ficha del catálogo** — sirve para escribir mejor los motivos de cada experiencia, que es el campo del que la IA saca el argumento.*

### H · El dato propio

| Fuente | Qué aporta | Cadencia | Coste | Estado |
|---|---|---|---|---|
| **Catálogo de la agencia** (PMS) | Producto, precio, cupo, margen | 1 h | Interno | ✅ (CSV hoy) |
| **Registro de recomendaciones** | Qué se propuso a qué perfil | Continua | Interno | ✅ |
| **Registro de descartes** | Qué rechazó el agente y por qué | Continua | Interno | ✅ |
| **Resultado de reserva** | Qué acabó vendiéndose | Continua | Interno | 📋 v2 |

*Las cuatro son gratis, no las tiene ningún competidor, y son las únicas que responden a «qué funciona en **esta** agencia».*

---

## 4. Cadencias, en una tabla

| Cada hora | Cada 6-12 h | Diario | Mensual | Anual |
|---|---|---|---|---|
| Precio de vuelo | Inspiración de vuelo | Vistas de página | INE / Eurostat | Clima histórico |
| Previsión meteorológica | Llegadas reales | Tendencias de búsqueda | Reservas agregadas | Festivos |
| Catálogo del PMS | Eventos | Avisos de viaje | | Calendario escolar |
| | | Tipo de cambio | | Visados, aeropuertos |

**Una ronda horaria típica toca tres fuentes, no catorce.**

---

## 5. Lo que NO se puede saber, y por qué

Esto es tan importante como el catálogo, y decirlo tú primero vale más que cualquier integración.

**Redes sociales.** No hay ninguna API oficial que dé demanda por destino. Las de investigación de TikTok e Instagram están restringidas a instituciones académicas, y scrapearlas incumple sus términos, exige proxies de pago y se rompe cuando cambia una clase de CSS. **Se descarta con motivo, no por dejadez.** Quien vende esto agregado —Mabrian y similares— lo hace con acuerdos comerciales que una agencia mediana puede comprar, y ese es el camino correcto si lo quieren.

**Lo que se reserva ahora mismo en el mercado.** Existe, pero está detrás de contrato comercial. En pruebas solo hay periodos históricos, y **una señal de demanda con datos de hace años no es una señal de demanda**: es una ilustración. Por eso está implementada y desactivada.

**La intención de compra.** Ninguna fuente externa distingue a quien mira de quien va a comprar. Se puede aproximar cruzando atención con reservas agregadas, pero la única señal real de intención es la del propio embudo de la agencia.

**El cliente concreto.** Nada externo sabe nada de la familia que acaba de llamar. Eso solo está en el CRM, y es la razón de que el producto tenga sentido: el valor no está en el dato de mercado, está en cruzarlo con lo que el agente acaba de escuchar por teléfono.

---

## 6. Qué integraría y en qué orden

Si hubiera que priorizar con tiempo limitado, este es el orden por relación valor/esfuerzo:

1. **Precio de vuelo** — es la única que justifica la cadencia horaria y la que da el cruce accionable con el interés.
2. **Eventos** — convierte «sube» en «sube porque». Es el salto de dato a explicación.
3. **Previsión meteorológica** — barata, sin clave, y mejora el argumento de forma inmediata.
4. **Festivos y calendario escolar** — estática, se hace una vez y evita recomendar fechas imposibles para familias.
5. **Avisos de viaje** — poca frecuencia, alto valor: entra como regla inviolable.
6. **Estadística oficial** — lenta, pero es el contrapeso honesto a las señales de atención.

Y por debajo de todas, la que más rinde y no depende de nadie: **cerrar el bucle con el resultado real de reserva**.
