# Travel Intelligence

**Plataforma digital B2B de inteligencia turística.** Convierte señales de demanda en decisiones
comerciales y en propuestas que un agente puede defender delante de un cliente.

---

## El problema

Una agencia europea de tamaño medio declara dos dolores: no entiende la demanda real por destino, y
producir contenido comercial le cuesta caro y lento. El brief precisa el primero: *tendencias de viaje,
intereses de usuarios, reseñas, redes sociales y plataformas de reserva están dispersas en múltiples
fuentes*.

Ahí hay una trampa. **El problema no es que los datos estén dispersos.** Si lo fuera, se resolvería con un
cuadro de mando — y cuadros de mando de demanda turística ya se venden hechos. El problema aparece al
preguntarse qué pasaría el día después de tener todas esas fuentes unificadas en una pantalla:

> El agente seguiría proponiendo lo mismo. Porque el criterio comercial de la agencia no está en ningún
> sistema: está en la cabeza de tres agentes veteranos. Lo que se le ofrece a un cliente depende de a quién
> le toque atenderle y de qué recuerde ese día.

Un dato que no cambia una decisión no vale nada. Por eso esta plataforma no termina en un panel: termina
en una propuesta concreta, con argumento.

## Propuesta de valor

Para el **agente**: vuelca lo que sabe del cliente en lenguaje natural y sale con dos propuestas con precio,
fechas y tres frases que puede repetir por teléfono.

Para la **dirección**: su criterio comercial deja de ser una reunión y pasa a ser un parámetro del sistema.

Para la **empresa**: el criterio deja de ser conocimiento tácito y pasa a ser un activo visible, editable y
medible.

---

## El principio que ordena todo el código

> **La IA nunca decide.** Descarta el código, ordenan los pesos que configura la agencia, y el modelo de
> lenguaje solo lee texto libre al principio y redacta al final.

Eso responde de antemano a las dos preguntas que siempre llegan: *¿y si alucina?* (no puede: no elige) y
*¿es reproducible?* (sí: mismo cliente y mismas reglas, misma respuesta).

## Ningún dato inventado

Todo indicador visible procede de una de estas cuatro cosas:

1. Una API real consultada en el momento.
2. Un dato del catálogo de la agencia.
3. Una observación real guardada previamente.
4. Un cálculo determinista sobre las anteriores.

**No existe un quinto camino.** Cuando una fuente no devuelve dato, la métrica queda vacía, su peso se
reparte entre las disponibles y **baja la confianza**. Nunca se rellena con una media, una estimación ni un
valor generado.

Estados de frescura que usa la interfaz: `En directo`, `Actualizado`, `Último dato oficial`,
`Dato real guardado`, `Sin actualizar`, `Sin datos`.

---

## Las cinco secciones

| Sección | Qué resuelve |
|---|---|
| **Overview** | El estado del negocio en quince segundos: oportunidades, confianza media y estado de las fuentes |
| **Radar de demanda** | Comparar los 30 destinos con búsqueda, cuatro filtros y cuatro ordenaciones |
| **Destino 360** | La ficha completa, con el desglose de cómo se calcula su score y de dónde sale cada dato |
| **Copiloto** | De las notas de una llamada a dos propuestas argumentadas y verificadas |
| **Arquitectura** | Cómo se orquesta, qué cuesta cada decisión y dónde están los puntos críticos |

*Campaign Studio y Biblioteca quedan fuera de esta versión de forma deliberada: son la pata de contenido
del brief, y generarlo sin saber qué destino empujar ni a qué perfil es justo lo que ya le sale caro a la
agencia.*

## El Opportunity Score

Fórmula explicable, determinista y auditable desde la interfaz:

| Componente | Peso | Origen |
|---|---|---|
| Tendencia de interés | 35 % | Wikimedia Pageviews · ventanas de 28 días |
| Atractivo económico | 25 % | Catálogo de la agencia |
| Cupo disponible | 20 % | Catálogo de la agencia |
| Idoneidad climática | 20 % | Open-Meteo · archivo histórico |

Si falta un componente, su peso se reparte entre los disponibles y la **confianza** baja: la confianza es,
literalmente, la proporción del peso total que se ha podido calcular con datos reales.

## Las reglas duras, en dos niveles

| Nivel | Reglas | Qué implica |
|---|---|---|
| **Relajables** | presupuesto, duración, temporada, desaconsejado en julio y agosto | Pueden proponerse si no hay alternativa, avisando y diciendo por cuánto se pasan |
| **Inviolables** | vuelo largo con menores de 6, restricciones declaradas, no apto para niños, cupo, visado | No aparecen nunca |

El criterio: una regla es relajable si protege la **calidad de la experiencia**, e inviolable si protege al
**cliente o a la operación**. Que Roma sea incómoda en agosto es calidad. Un vuelo de diez horas con un bebé
acaba en reclamación.

---

## Arranque

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run build
npm test             # 24 pruebas
```

**Funciona sin ninguna variable de entorno.** Sin base de datos sirve la última observación real guardada
en `data/snapshot.json`; sin clave de modelo, la extracción del perfil sigue funcionando —es determinista—
y el argumento cae a los motivos del catálogo.

### Variables opcionales

| Variable | Para qué |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Histórico de observaciones en Postgres |
| `IA_API_KEY`, `IA_URL`, `IA_MODELO` | Redacción del argumento. Cualquier proveedor compatible con OpenAI |

## Despliegue en Vercel

Importar el repositorio. No hace falta `vercel.json` ni configuración especial: sin variables arranca en
modo de última observación real y lo indica en la interfaz.

## API

| Ruta | Qué devuelve |
|---|---|
| `GET /api/health` | Estado, origen de los datos y frescura |
| `GET /api/destinations` | Los 30 destinos con su Opportunity Score |
| `GET /api/destinations?id=EXP14` | Un destino concreto. 404 con código `DESTINATION_NOT_FOUND` |
| `GET /api/weather?destinationId=EXP14` | Clima en directo, o la última observación real si falla |
| `POST /api/ai` | Notas → perfil → reglas → dos propuestas verificadas |

---

## Guion de demo · seis minutos

1. **El problema** (40 s). No es que los datos estén dispersos: es que el criterio no está en ningún sistema.
2. **Overview** (40 s). Oportunidades, confianza media del dato y estado de las fuentes.
3. **Radar** (60 s). Filtrar por prioridad alta, ordenar por crecimiento, elegir un destino.
4. **Destino 360** (80 s). Abrir el desglose del score y enseñar un componente **sin dato**: la confianza baja
   y no se rellena.
5. **Copiloto** (120 s). Pegar las notas de la familia con un bebé de dos años que pide la Riviera Maya. El
   sistema se niega y explica por qué. Descartar una opción y recalcular.
6. **Modo técnico** (30 s). Abrir la traza: qué descartó cada regla y campos citados frente a inventados.
7. **Arquitectura** (30 s). Las cuatro capas, los cuatro trade-offs y los cinco puntos críticos.

## Limitaciones reconocidas

- Las vistas de página miden **interés, no intención de compra**. La señal buena es el histórico de reservas
  de la agencia, que no existe todavía y que este producto está diseñado para fabricar.
- El catálogo modelado tiene 30 experiencias. El sistema escala igual con 3.000; escribir bien las fichas es
  trabajo de la agencia.
- Los pesos iniciales son una hipótesis. Se corrigen con lo que se venda a partir de la v2.
- Reservas de Amadeus: implementado en el proyecto anterior y desactivado, porque su entorno de pruebas solo
  publica periodos históricos y una señal de demanda con datos de hace años no es una señal de demanda.
