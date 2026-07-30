# Cómo leer este repositorio

El orden de los archivos es el orden en que se tomaron las decisiones. Eso es
deliberado: primero el criterio, después las pruebas, y solo al final el código.

## docs/ — las decisiones

| Archivo | Qué contiene |
|---|---|
| **`09_ENTREGABLE_mvp_y_poc.md`** | **El entregable. Los cinco bloques del MVP y los dos de la prueba de concepto, en el orden que pide el brief** |
| `01_vision_de_producto.md` | Problema, propuesta de valor, alcance priorizado, flujo de usuario, decisiones y trade-offs |
| `02_fichas_y_reglas.md` | El modelo de datos y las reglas duras, campo por campo, con el porqué de cada umbral |
| `03_ingesta_y_unificacion.md` | Cómo cinco fuentes dispersas acaban en una ficha unificada, y dónde están los puntos críticos |
| `04_arquitectura.md` | Componentes y herramientas, hoy y en producción, con el diagrama de flujo |
| `05_guion_construccion.md` | El plan de construcción por pasos |
| `06_instrucciones_modelo.md` | Las instrucciones del modelo de lenguaje y la verificación que las respalda |
| `07_despliegue_independiente.md` | Cómo desplegar fuera de Lovable y qué variables hacen falta |
| `08_que_compro_y_que_construyo.md` | Estudio de lo que ya existe en el mercado y dónde queda el hueco |
| `arquitectura_flujo.mermaid` | El diagrama, en formato editable |

## data/ — los datos de partida

- `catalogo_experiencias.csv` — las 30 experiencias del catálogo
- `perfiles_test.json` — los 10 perfiles de prueba **con el resultado esperado escrito antes de construir el motor**
- `seed_catalogo.sql` — esquema y carga inicial

## tests/ — la verificación

```
node tests/verificar_reglas.mjs
```

17 pruebas. Diez comprueban que los destinos esperados sobreviven a las reglas.
Siete comprueban lo contrario, que es lo que de verdad importa: que el sistema
**rechaza** lo que debe rechazar, y **en el nivel correcto** — la Riviera Maya a
una familia con un bebé de dos años es inviolable, Roma en agosto solo es
relajable, e Ibiza a un grupo de amigos sin niños debe pasar.

Sin credenciales lee el CSV. Con las variables de entorno del backend puestas,
ataca la base de datos real.

```
npx esbuild tests/verificar_argumento.ts --bundle --platform=node \
  --format=esm --outfile=/tmp/p.mjs && node /tmp/p.mjs
```

5 casos sobre la verificación del argumento redactado: que caza una cifra que no
está en la ficha, que caza un campo citado que no existe, y que **no** da falso
positivo con el precio total del grupo, que es un múltiplo legítimo del precio
por persona.

## Los tres usos del modelo de lenguaje, y solo tres

| Dónde | Qué hace | Qué NO hace |
|---|---|---|
| `copiloto.functions.ts` → `extraerPerfil` | Convierte las notas de la llamada en un perfil estructurado, con el literal del que sale cada dato | No completa lo que las notas no dicen: lo deja a null y lo declara |
| `copiloto.functions.ts` → `redactarArgumentos` | Redacta por qué encajan las dos propuestas **ya elegidas**, citando solo campos de la ficha | No elige, no ordena y no aporta ningún dato |
| `senales.functions.ts` → `consultarCopiloto` | Responde preguntas del agente sobre catálogo, señales y criterio comercial | No recomienda: si se lo piden, remite al motor |

El encaminamiento entre consulta y extracción lo decide una función
determinista en `Copiloto.tsx`, no el modelo, porque tiene que ser reproducible.

## El principio que ordena todo el código

> La IA nunca decide. Descarta el código, ordenan los pesos que configura la
> agencia, y la IA solo lee texto libre al principio y redacta al final.

En `src/lib/recomendador/motor.ts` las reglas duras están separadas en dos
niveles: **relajables** (presupuesto, noches, temporada) e **inviolables**
(vuelo largo con menores, restricciones declaradas, veto comercial, visado,
cupo). Cuando ninguna experiencia sobrevive, el sistema solo puede proponer
las que incumplen reglas relajables. Las inviolables no se negocian nunca.
