# Qué compro y qué construyo
**El estudio de lo que ya existe, y por qué aun así hay producto**

> Este documento responde a la negrita del brief: *"la forma más rápida apalancándose en servicios existentes con un desarrollo propio"*. La pregunta no es si existe algo parecido — existe. La pregunta es dónde queda el hueco.

---

## 1. Lo que ya existe, por capas

### Capa de datos de demanda · **se compra, y ya la compro**

| Producto | Qué hace | Por qué no lo construyo |
|---|---|---|
| **ForwardKeys** (empresa de Amadeus) | Vista completa del viaje: reservas aéreas, geolocalización, comportamiento y gasto. Su plataforma Nexus da tendencias globales en tiempo real | Es exactamente la señal de demanda que necesito, con datos de reservas reales. Construir esto sería reinventar una empresa entera |
| **Mabrian** | Inteligencia turística sobre más de 30 fuentes distintas, presente en 40 países | Es la respuesta comercial a "reseñas y redes sociales dispersas" — lo que el brief nombra como problema, ellos ya lo agregan |
| **Lighthouse** (antes OTA Insight) | Inteligencia de negocio y precios de competencia | Cubre la parte de precio de mercado |
| **Amadeus Self-Service** | Destinos más reservados, más viajados, periodos punta | La versión accesible de lo anterior. **Es la que he integrado** |

**Conclusión de esta capa**: hay un mercado maduro. Cualquier intento de construir un producto de datos de demanda compite con empresas que llevan diez años haciéndolo. Por eso la señal se compra.

### Capa de motor de reglas · **se compra la mecánica, se construye el contenido**

| Producto | Qué hace | Decisión |
|---|---|---|
| **json-rules-engine** | Reglas de negocio declaradas en JSON puro, Node.js, ligera y con tracción | Candidata real |
| **GoRules ZEN** | Motor de reglas multiplataforma en Rust con enlaces para Node | Candidata real, más potente |
| **Drools** | El clásico empresarial, algoritmo Rete | Sobredimensionado para 30 filas y 8 reglas |

**Lo que aportarían**: que el administrador pudiera *escribir reglas nuevas* sin desplegar código, no solo mover pesos.

**Por qué no las he metido todavía**: con 8 reglas duras, un motor de reglas añade una capa de abstracción, un formato que aprender y una dependencia, a cambio de flexibilidad que hoy nadie ha pedido. Es la decisión correcta **hoy** y la equivocada al año siguiente — por eso está en el roadmap y no en el MVP. Cuando la agencia quiera crear reglas nuevas sola, se sustituye la función de reglas duras por `json-rules-engine` sin tocar nada más: ya está aislada en un módulo.

### Capa de recomendador · **existe, y no me sirve**

| Producto | Qué hace | Por qué no encaja |
|---|---|---|
| **Gorse** | Motor de recomendación autoalojado, filtrado colaborativo y contenido | Necesita **historial de interacciones masivo**. Con 30 productos y cero histórico, un colaborativo no tiene de dónde aprender |
| **LightFM** | Híbrido colaborativo + contenido, rápido y escalable | Mismo problema: el arranque en frío es total |
| **Recombee, Algolia Recommend** | Recomendación como servicio | Optimizan clics en catálogos de miles de artículos, no una decisión de 3.000 € que un humano tiene que defender por teléfono |

**Esta es la conclusión importante del estudio.** Los recomendadores del mercado están construidos para catálogos grandes con muchísimas interacciones, donde el objetivo es maximizar el clic. Aquí el catálogo tiene decenas de referencias, no hay histórico, y el objetivo no es acertar estadísticamente: es **darle a un agente un argumento que pueda defender**. Un recomendador colaborativo no sabe explicar por qué recomienda algo, y aquí la explicación *es el producto*.

### Repositorios abiertos de recomendación de viajes · **no integrables**

Hay decenas en GitHub —`Personalized-Travel-Recommendation-System`, `Travelix`, `TripOpt`, `Intelligent-Travel-Recommendation-System`— y todos comparten el mismo perfil: proyectos académicos o de fin de carrera, sin mantenimiento, sin pruebas, sin licencia clara y atados a un conjunto de datos concreto.

**Sirven como referencia de enfoques, no como dependencia.** Meter uno en un sistema que se entrega a un cliente sería asumir deuda técnica que nadie mantiene.

---

## 2. Dónde queda el hueco, entonces

Después de mirar el mercado, lo que **no** se compra hecho es exactamente lo que he construido:

1. **El criterio comercial de esta agencia, explícito y editable.** Ningún producto del mercado sabe que esta agencia no vende vuelos de más de seis horas a familias con bebés, ni que su dirección quiere empujar Grecia este trimestre. Eso no es un algoritmo: es conocimiento de negocio codificado.
2. **La unificación de fuentes en una forma común.** Los productos de inteligencia venden su propio panel. Ninguno se integra en la decisión concreta de qué proponerle a un cliente.
3. **El argumento verificable.** Un recomendador comercial devuelve un orden. Aquí hay que devolver tres frases que el agente pueda decir por teléfono, y garantizar que cada cifra existe en la ficha.
4. **El bucle propietario.** Cada recomendación y cada descarte generan el único dato que ningún proveedor puede vender: qué funciona en *esta* agencia.

---

## 3. La frase para la entrevista

> *"Miré qué existe antes de construir. La señal de demanda tiene un mercado maduro — ForwardKeys, Mabrian, Lighthouse — así que la compro. Los motores de reglas también existen y están en el roadmap, pero con ocho reglas añaden abstracción sin resolver nada. Y los recomendadores del mercado no me sirven, y esa es la parte interesante: están hechos para catálogos enormes con mucho histórico y para maximizar el clic. Aquí el catálogo tiene treinta referencias, no hay histórico, y el objetivo no es acertar estadísticamente sino darle al agente algo que pueda defender delante del cliente. La explicación no acompaña a la recomendación: la explicación es el producto."*

---

## Fuentes

- [ForwardKeys — Travel Intelligence Solutions](https://forwardkeys.com/)
- [Mabrian — Smart destinations](https://mabrian.com/solutions/destinations/)
- [Lighthouse — Business Intelligence (Hotel Tech Report)](https://hoteltechreport.com/revenue-management/business-intelligence/forwardkeys)
- [json-rules-engine](https://github.com/CacheControl/json-rules-engine)
- [GoRules ZEN Engine](https://github.com/gorules/zen)
- [Gorse — recommender system engine](https://github.com/gorse-io/gorse)
- [Lista de repositorios de recomendación de viajes](https://github.com/topics/trip-planner)
