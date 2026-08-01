# Traspaso del proyecto

**Travel Intelligence · plataforma digital B2B de inteligencia turística**
Documento para retomar el trabajo con contexto completo, sin releer el historial.

---

## 1. Qué es y qué problema resuelve

Caso práctico para una entrevista de **Applied AI Engineer en Igeneris**. El
cliente ficticio es una agencia de viajes europea de 80-120 empleados con dos
dolores declarados: no entiende la demanda real por destino, y producir
contenido comercial le cuesta caro y lento.

**La tesis del proyecto, y hay que sostenerla**: el problema no es que los datos
estén dispersos. Si lo fuera, se resolvería con un cuadro de mando, y esos ya se
venden hechos. El problema es que **el criterio comercial de la agencia no está
en ningún sistema: está en la cabeza de tres agentes veteranos**. Un dato que no
cambia una decisión no vale nada. Por eso el producto no termina en un panel,
termina en una propuesta concreta con argumento.

## 2. Los dos principios que ordenan TODO el código

Si se rompe cualquiera de los dos, el proyecto pierde su valor:

**1 · La IA nunca decide.** Descarta el código, ordenan los pesos que configura
la agencia, y el modelo de lenguaje solo lee texto libre al principio y redacta
al final. Responde de antemano a *¿y si alucina?* (no puede: no elige) y
*¿es reproducible?* (sí).

**2 · Ningún dato inventado.** Cuando una fuente no devuelve dato, la métrica
queda vacía, su peso se reparte y **baja la confianza**. Nunca se rellena con
una media, una estimación ni un valor generado. Si una fuente no cubre un
destino (el INE no cubre Bali), es **no aplicable** y no resta confianza.

## 3. Estado actual

**Repositorio**: `github.com/alejandromarinascuesta/viajero-esqueleto-base`
**Desplegado**: `viajero-esqueleto-base.vercel.app` (Vercel, despliegue automático al hacer push a `main`)
**Base de datos**: Supabase, proyecto `recomendador-turismo` (`nxgmvkvzihfkwkbbczjv`)

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Postgres.
Sin servidor persistente. `npm run dev | build | lint | typecheck | test`.

**Pruebas**: 50, todas en verde. `npm test` (compila con esbuild y corre con el
runner de Node).

### Cuatro secciones

| Sección | Qué hace |
|---|---|
| **Radar de demanda** | Entrada. Propuesta de valor, KPIs, ingesta de fuentes, importador de Trends y los 15 destinos con búsqueda, 4 filtros y 4 ordenaciones |
| **Destino 360** | Ficha completa, desglose auditable del Opportunity Score y procedencia de cada dato con su cadencia real |
| **Copiloto** | Formulario guiado (10 campos) o notas libres → 2 propuestas argumentadas, verificadas, con probabilidad de cierre |
| **Criterio comercial** | Los 5 pesos (escala 1-5), campañas y vetos que mueve la dirección |

La arquitectura se explica en un panel lateral, no es una sección navegable.

**Fuera a propósito**: Campaign Studio y Biblioteca. Son la pata de contenido
del brief, y generarlo sin saber qué destino empujar ni a qué perfil es justo lo
que ya le sale caro a la agencia. Es una decisión de priorización, no un olvido.

## 4. Mapa del código

```
app/
  page.tsx                  carga datos en servidor y monta el Shell
  api/health                estado, origen de datos y frescura
  api/destinations          los 15 destinos con su Opportunity Score
  api/weather               clima en directo; si falla, última observación real
  api/ai                    notas o perfil → reglas → 2 propuestas verificadas
  api/criterio              GET/PUT pesos, campañas y vetos
  api/ingesta               ejecuta los conectores y guarda observaciones
  api/trends                importa un CSV real de Google Trends
  api/descarte              registra un descarte con su motivo
lib/
  motor.ts                  reglas duras en dos niveles + puntuación. EL NÚCLEO
  scoring.ts                Opportunity Score explicable y ajustado por confianza
  conversion.ts             probabilidad de cierre, con su base declarada
  extraccion.ts             perfil desde texto libre, DETERMINISTA (sin modelo)
  verificar.ts              comprueba que el argumento no inventa nada
  conectores.ts             clima, interés, divisa, INE
  trends.ts                 parser del CSV de Google Trends
  criterio.ts               lee y guarda el criterio comercial
  ai.ts                     cliente del modelo (Anthropic u OpenAI)
  data.ts                   Supabase si está configurado; si no, snapshot real
  pulso.ts                  iconos y acción recomendada por destino
data/snapshot.json          última observación REAL guardada (no es de ejemplo)
docs/                       11 documentos de decisiones, este incluido
tests/                      50 pruebas
```

## 5. Modelo de datos

```
experiencias        15 destinos: precio, noches, temporada, horas de vuelo,
                    visado, apto_ninos, intensidad, margen, cupo, 3 motivos,
                    no_recomendado_si, lat/lon, iata, wiki, en_campana
senales             TODAS las fuentes en la MISMA forma: fuente, destino_id,
                    periodo, metrica, valor, valor_bruto, estado, obtenido_en
                    estado ∈ ok | no_disponible | no_aplicable | obsoleta
pesos               los 5 pesos del criterio comercial, escala 1-5
vetos               destino + mes opcional. Regla INVIOLABLE
recomendaciones     perfil, candidatas, supervivientes, propuestas, traza,
                    resultado (pendiente|reservada|perdida), destino_reservado
descartes           recomendacion_id, destino_id, motivo_agente
conversion_por_destino   vista: decididas y reservadas por destino
```

**La tabla `senales` es el mecanismo de unificación.** No son los conectores: es
que todas las fuentes, por distintas que sean, aterrizan en la misma forma.

## 6. Las reglas del motor

**Relajables** (protegen la calidad de la experiencia; pueden proponerse
avisando si no hay alternativa): presupuesto, duración, temporada, desaconsejado
en julio y agosto.

**Inviolables** (protegen al cliente o a la operación; no aparecen nunca):
vuelo > 6 h con menor de 6 años, «no vuelos largos» con vuelo > 4 h,
restricciones declaradas, no apto para niños, cupo 0, visado sin plazo, y
**veto comercial de la dirección**.

Criterio de separación: *relajable si protege la calidad, inviolable si protege
al cliente o a la operación*. Roma en agosto es calidad. Un vuelo de diez horas
con un bebé acaba en reclamación.

**Los pesos ordenan lo que ya ha sobrevivido a las reglas; nunca las anulan.**
Hay una prueba que lo fija: con el margen al máximo y la Riviera Maya en
campaña, sigue sin proponerse a una familia con un bebé de dos años.

## 7. Opportunity Score

```
35 % momentum de búsquedas    Google Trends si está importado; Wikimedia si no
20 % volumen de atención      Wikimedia · visitas medias/día, escala logarítmica
20 % atractivo económico      margen del catálogo
15 % cupo disponible          catálogo
10 % idoneidad climática      Open-Meteo · archivo histórico
```

Tres reglas: solo se calcula con métricas disponibles; las que **no aplican**
salen del denominador de la confianza; y **el score va ajustado por confianza**
—sin ese ajuste, repartir el peso de una métrica ausente premiaría al destino
por no tener datos, que es lo que pasaba y se corrigió.

## 8. Probabilidad de cierre

Modelo explícito, no un dato. Declara su base y **sobre cuántas observaciones
reales se apoya**. Hoy: 0 propuestas cerradas → base supuesta del 20 %, y la
interfaz lo dice. A partir de 30 propuestas cerradas, la base pasa a ser la tasa
real sin tocar código.

Ajustes multiplicativos visibles: encaje con el cliente, holgura de presupuesto,
cupo escaso, vuelo largo con niños, destino ya visitado.

## 9. Fuentes

| Fuente | Estado | Cadencia real | Clave |
|---|---|---|---|
| Catálogo de la agencia | activa | manual | — |
| Clima · Open-Meteo | activa | archivo histórico, estable | no |
| Interés · Wikimedia | activa | vistas diarias, 28d vs 28d | no |
| Divisa · BCE | activa | cada día laborable | no |
| INE · viajeros por provincia | activa, solo España | mensual, 2 meses de retraso | no |
| Google Trends | importador de CSV | manual | no |
| Amadeus · vuelos y reservas | diseñado | diaria | **sí, pendiente** |
| Ticketmaster · eventos | diseñado | diaria | **sí, pendiente** |

**Descartadas con motivo**: Google Ads Keyword Planner (sin gasto real devuelve
rangos, no volúmenes), Google Flights (no tiene API desde 2018), Skyscanner
(solo socios B2B), scraping de comparadores y redes sociales (incumple términos,
frágil, y contradice la decisión de que la señal se compra).

## 10. Variables de entorno

Ninguna es obligatoria: sin ellas sirve la última observación real y lo indica.

```
SUPABASE_URL                 https://nxgmvkvzihfkwkbbczjv.supabase.co
SUPABASE_SERVICE_ROLE_KEY    (secreta, en Vercel)
Claude_LLM                   clave del modelo. También valen IA_API_KEY,
                             ANTHROPIC_API_KEY u OPENAI_API_KEY.
                             Se detecta el proveedor por el prefijo
INE_TABLA                    opcional, por defecto 2074
AMADEUS_CLIENT_ID / _SECRET  pendientes
```

## 11. Lo que falta, por orden de valor

1. **Ejecutar la ingesta** con las fuentes nuevas (botón «Refrescar fuentes») e
   importar los CSV de Trends. El snapshot es del 30 de julio y no trae volumen.
2. **Conector de vuelos de Amadeus** con fechas concretas, para que el precio
   deje de ser solo el del paquete del catálogo.
3. **Eventos (Ticketmaster)**: convierte «Lisboa sube un 30 %» en «sube porque
   hay un festival el 12 de agosto». De dato a explicación.
4. **Cerrar el bucle**: marcar recomendaciones como reservadas o perdidas para
   que la probabilidad de cierre pase de supuesta a empírica.
5. **Generación de contenido** (pata 3 del brief), reducida al correo de
   propuesta: el modelo solo redacta saludo y transición; datos y precios entran
   tal cual, sin pasar por él.
6. **Las slides de la presentación**: 5 bloques que pide la slide 4 del brief.
   Están sin empezar y es lo único que el brief dice que van a puntuar.

## 12. Reglas de trabajo que conviene mantener

- Antes de empujar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Los cuatro en verde.
- Commits firmados con `alejandromarinascuesta@gmail.com`. Con otro correo,
  Vercel bloquea el despliegue (*No Seat, No Build*).
- No editar `next-env.d.ts` ni los tipos generados de Supabase.
- Cuando una fuente falle, guardar el **motivo** en `valor_bruto`: el sistema se
  autodiagnostica en vez de decir solo «sin dato».
- Cualquier número que se muestre tiene que poder rastrearse hasta su origen.

## 13. Los tres momentos fuertes para la demo

1. **Familia con un bebé de 2 años pide la Riviera Maya** → el sistema se niega:
   10 h de vuelo con un menor de 6 es regla inviolable. Protege de una venta que
   acabaría en reclamación.
2. **Piden Roma o Sevilla en agosto** → el sistema lleva la contraria al cliente
   y explica por qué. El criterio está codificado, no es un buscador.
3. **Modo técnico** → «campos citados: 6 · campos inventados: 0». Responde a la
   pregunta de las alucinaciones con un hecho medido, no con una promesa.
