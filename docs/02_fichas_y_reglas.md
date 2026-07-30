# Las fichas y las reglas
**El desarrollo propio del producto — para revisar y discutir**

> Todo lo demás se compra. Esto es lo único que se construye, así que es lo que hay que saber defender campo por campo.

---

## 1. Ficha de experiencia

Cada viaje del catálogo. La regla para incluir un campo: **o sirve para descartar, o sirve para ordenar, o sirve para argumentar.** Si no hace ninguna de las tres, sobra.

| Campo | Ejemplo | Para qué sirve |
|---|---|---|
| `destino` | Creta, Grecia | Identificación |
| `tipo` | playa / ciudad / naturaleza / aventura / cultural / bienestar | Ordenar (encaje con la motivación) |
| `precio_desde_por_persona` | 780 € | **Descartar** |
| `noches` | 7 | **Descartar** (encaje con los días disponibles) |
| `meses_recomendados` | may–oct | **Descartar** (nadie va a Escandinavia en enero) |
| `horas_de_vuelo` | 3,5 | **Descartar** (regla dura con niños pequeños) |
| `visado` | no | **Descartar** (si no da tiempo a tramitarlo) |
| `apto_ninos` | alto / medio / bajo | **Descartar** y ordenar |
| `intensidad` | 1 (tumbado) a 5 (mochila) | Ordenar (el error clásico: mandar a un matrimonio cansado a un trekking) |
| `temperatura_media_mes` | ago: 29 °C | Ordenar y **argumentar** |
| `margen_agencia` | 22 % | Ordenar (peso configurable por la dirección) |
| `cupo_disponible` | 14 plazas | **Descartar** y ordenar (liquidar stock) |
| `tres_motivos` | "playa tranquila", "club infantil", "vuelo directo" | **Argumentar** — la IA solo puede citar de aquí |
| `no_recomendado_si` | movilidad reducida, presupuesto ajustado | **Descartar** |

**El campo que hace el trabajo pesado es `tres_motivos`.** Es donde vive el conocimiento del agente veterano, y es la única fuente de la que la IA puede sacar argumentos. Si está bien escrito, el sistema suena a experto; si está vacío, suena a folleto.

---

## 2. Ficha de cliente

| Campo | Ejemplo | Para qué sirve |
|---|---|---|
| `adultos` | 2 | **Descartar** |
| `ninos` + edades | 2 (5 y 8) | **Descartar** (regla dura de vuelo) |
| `presupuesto_total` | 3.500 € | **Descartar** |
| `presupuesto_flexible` | sí / no | Relajar el descarte de forma controlada |
| `mes` o fechas | agosto, 8–15 | **Descartar** |
| `dias_disponibles` | 7 | **Descartar** |
| `motivacion` | descanso / cultura / aventura / celebración / romántico | Ordenar |
| `intensidad_deseada` | 2 | Ordenar |
| `restricciones` | movilidad, no vuelos largos, alergias | **Descartar** |
| `destinos_previos` | Túnez 2023, Italia 2024 | Ordenar (evitar repetir, y detectar patrón) |
| `tension_declarada` | "ella quiere playa, él se aburre" | Ordenar y **argumentar** |

**El campo diferencial es `tension_declarada`.** Un formulario normal no lo tiene y por eso los buscadores no sirven: el trabajo real del agente es resolver contradicciones entre las personas que viajan juntas. Es también el campo que justifica que la entrada sea texto libre — nadie rellena eso en un desplegable.

---

## 3. Reglas duras (código, no IA — nunca se saltan)

Cada una es una decisión de negocio discutible. Están escritas para poder defenderlas de una en una:

| Regla | Umbral | Por qué |
|---|---|---|
| **Presupuesto** | Descarta si supera el presupuesto total (+10 % si es flexible) | Enseñar algo que no se pueden permitir quema la confianza del cliente en el agente |
| **Vuelo con niños pequeños** | Descarta > 6 h si hay algún niño menor de 6 años | Es el error que más devoluciones y malas reseñas genera |
| **Temporada** | Descarta si el mes está fuera de los recomendados | Vender Tailandia en plena estación de lluvias es vender una mala experiencia |
| **Duración** | Descarta si las noches superan los días disponibles | Obvio, pero es lo que un buscador te deja hacer |
| **Visado** | Descarta si el visado no da tiempo antes de la salida | Fallo operativo, no comercial: la reserva se cae después |
| **Restricciones declaradas** | Descarta si choca con `no_recomendado_si` | Movilidad reducida en un destino con escaleras no es negociable |
| **Cupo** | Descarta si no hay plazas | No se propone lo que no se puede vender |

### Los dos niveles de regla dura

No todas las reglas duras pesan lo mismo, y tratarlas igual es un error de
producto. Se dividen en dos:

| Nivel | Reglas | Qué implica |
|---|---|---|
| **Relajables** | presupuesto, duración, temporada, desaconsejado en julio y agosto | Se pueden proponer como "lo más cercano" si no hay alternativa, siempre con el aviso visible y la magnitud del incumplimiento |
| **Inviolables** | vuelo largo con menores de 6, restricciones declaradas del cliente, "no vuelos largos", no apto para niños, cupo, visado sin plazo, veto comercial | No aparecen nunca. Ni como alternativa, ni con aviso |

El criterio de separación: **una regla es relajable si lo que protege es la
calidad de la experiencia, e inviolable si lo que protege es al cliente o a la
operación.** Que Roma sea incómoda en agosto es un problema de calidad — si el
cliente insiste, el agente debe poder venderlo avisando. Un vuelo de diez horas
con un bebé, o Ibiza solo-adultos con niños, no se negocia: acaba en
reclamación.

**Cuando todo se descarta**: el sistema no devuelve vacío. Enseña las dos opciones que menos incumplen, diciendo qué regla rompen y por cuánto (*"Zanzíbar, 400 € por encima"* / *"lo mismo en mayo, dentro de presupuesto"*), y pide al agente que afine.

---

## 4. Pesos configurables (el panel de la dirección)

Lo que sobrevive a las reglas se ordena con estos pesos. Suman 100 y los mueve la agencia:

| Peso | Por defecto | Qué hace al subirlo |
|---|---|---|
| **Encaje con el cliente** | 40 | El sistema prioriza lo que mejor le va al cliente, aunque deje menos margen |
| **Señal de demanda del destino** | 15 | El sistema empuja lo que el mercado está buscando ahora |
| **Margen de la agencia** | 20 | El sistema prioriza lo que más deja |
| **Destinos de campaña** | 15 | La dirección marca destinos y suben en el orden |
| **Liquidar cupo** | 10 | Sube lo que tiene plazas sin vender y fecha cercana |

**Vetos**: el administrador puede vetar destinos por temporada o por perfil, y esos vetos actúan como reglas duras.

**El deslizador que hace la mejor pregunta de la entrevista**: si subes margen a 60 y bajas encaje a 10, el sistema vende lo que más deja aunque al cliente le encaje peor. El producto lo permite — y lo hace visible. La respuesta que hay que tener preparada es que un sistema que oculta ese trade-off es peor que uno que lo pone en un panel donde alguien tiene que responder por él. Y que a partir de la v2 el propio bucle castiga esa configuración: si empujas margen, baja la conversión, y se ve.

---

## 5. Qué queda para discutir

1. **¿6 horas es el umbral correcto de vuelo con niños?** Es un número inventado por mí. En la entrevista es mejor decir que es una hipótesis configurable que defenderlo como verdad.
2. **¿El margen debe pesar por defecto un 20 %?** Cualquier valor por defecto es una postura ética. Igual el defecto honesto es 0 y que la agencia lo suba conscientemente.
3. **Tamaño del catálogo: 20–30 experiencias.** Suficiente para que las reglas descarten de verdad y el ranking signifique algo, y poco para poder revisar a mano que cada ficha esté bien escrita. Se amplía después. Si preguntan, la respuesta es que el catálogo no es el producto: es el dato del cliente, y el sistema escala igual con 30 que con 3.000.
