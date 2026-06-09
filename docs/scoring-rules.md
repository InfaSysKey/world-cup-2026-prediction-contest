# Reglamento de la Porra — Mundial 2026

Este documento describe **todas las predicciones** que puede hacer un jugador, **cuándo se bloquean**, **cómo se puntúan** y los **criterios de desempate** del ranking general.

Es la referencia única para el motor de puntuación (`scoring engine`) y para el formulario de porra. Cualquier cambio aquí implica recálculo retroactivo de la tabla.

---

## 1. Contexto del torneo

- **Formato**: 48 selecciones, 12 grupos (A–L) de 4 equipos.
- **Fase de grupos**: 72 partidos (6 por grupo).
- **Clasifican a 1/16**: los 2 primeros de cada grupo (24) + los 8 mejores terceros = **32 equipos**.
- **Eliminatorias**: 1/16 → 1/8 → Cuartos → Semis → Final. Más partido por el 3.º puesto.
- **Total de partidos**: 104.
- **Fechas**: 11 jun – 19 jul 2026.

---

## 2. Predicciones que hace el jugador

El jugador completa la porra **antes del pitido inicial del primer partido del torneo** (11 jun 2026, 19:00 hora España). Una vez bloqueada, no se puede modificar nada que ya esté bloqueado.

### 2.1 Fase de grupos (72 partidos)

Para cada partido el jugador predice **el marcador exacto** (goles del local y goles del visitante).

### 2.2 Clasificación de cada grupo

Por cada uno de los 12 grupos, el jugador predice el **orden final** de los 4 equipos: 1.º, 2.º, 3.º y 4.º.

### 2.3 Desempates de grupo (hasta 6 por grupo)

Si la predicción de fase de grupos genera empates a puntos entre equipos del mismo grupo, el jugador define manualmente el orden de desempate. El Excel permite hasta 6 desempates por grupo (Empate1L/V, Empate2L/V… Empate6L/V).

> **En la app**: este paso se resuelve en el propio formulario de orden de grupo. Si el motor detecta empate matemático según los marcadores predichos, el formulario obliga al jugador a arrastrar los equipos empatados en el orden que él decida.

### 2.4 Mejores terceros (ranking de 8)

El jugador ordena los **12 terceros clasificados** y marca cuáles son, en su opinión, los **8 que pasan a 1/16**.

> Esta predicción depende de la 2.2: los terceros que el jugador elija deben ser coherentes con las posiciones 3.ª predichas en cada grupo.

### 2.5 Bracket eliminatorio

Para cada eliminatoria el jugador predice el **ganador** del cruce (sin marcador):

- **1/16 de final**: 16 ganadores
- **1/8 de final**: 8 ganadores
- **Cuartos**: 4 ganadores
- **Semifinales**: 2 ganadores
- **Final**: 1 ganador (campeón)
- **3.º y 4.º puesto**: 1 ganador (3.º del Mundial)

### 2.6 Cuadro de honor (podio)

- 🥇 **Campeón**
- 🥈 **Subcampeón** (perdedor de la final)
- 🥉 **3.º puesto**

> Estos tres se **sugieren** automáticamente desde el bracket (ganador de la final → campeón; el otro finalista → subcampeón; ganador del 3-4 → 3.º), pero se guardan como predicciones explícitas **solo cuando el jugador los confirma o edita** en el formulario; la sugerencia no se persiste por sí sola (ver `docs/decisions/0005-podio-sugerido-no-persistido.md`). Mientras un puesto siga como sugerencia sin confirmar, el formulario lo marca como "revisar".

### 2.7 Premios individuales

- **Bota de Oro** (máximo goleador), **Bota de Plata** (2.º), **Bota de Bronce** (3.º).
- **Balón de Oro** (mejor jugador), **Balón de Plata** (2.º), **Balón de Bronce** (3.º).

Texto libre, con autocompletado contra un catálogo de jugadores que el admin importa.

---

## 3. Sistema de puntuación

### 3.1 Partidos de fase de grupos (por partido)

| Acierto | Puntos |
|---|---|
| Marcador exacto (ej. predicción 2–1, real 2–1) | **5** |
| Resultado correcto, marcador erróneo (ej. predijo 2–1, real 3–1 → ambos victoria local) | **3** |
| Solo el número de goles de **un** equipo (ej. predijo 2–1, real 2–0) | **1** |
| Empate predicho y resultado empate, marcador erróneo (ej. predijo 1–1, real 2–2) | **3** |
| Predicción no rellenada | **−1** (puntos penalizados) |

**Acumulado máximo en fase de grupos por partidos**: 72 × 5 = **360 pts**.

### 3.2 Clasificación de grupo (por grupo)

| Acierto | Puntos |
|---|---|
| Acertar 1.º del grupo | **4** |
| Acertar 2.º del grupo | **3** |
| Acertar 3.º del grupo | **2** |
| Acertar 4.º del grupo | **1** |
| Bonus: clavar el orden completo de los 4 | **+5** |

**Máximo por grupo**: 4+3+2+1+5 = 15. Total 12 grupos: **180 pts**.

### 3.3 Mejores terceros

| Acierto | Puntos |
|---|---|
| Cada selección acertada entre los 8 mejores terceros (sin importar el orden interno) | **3** |
| Bonus: los 8 en el orden exacto | **+5** |

**Máximo**: 8 × 3 + 5 = **29 pts**.

### 3.4 Bracket eliminatorio

Los puntos aumentan con la fase. Acertar el ganador de un cruce vale lo siguiente:

| Fase | Puntos por acierto | Nº cruces | Máximo fase |
|---|---|---|---|
| 1/16 | 4 | 16 | 64 |
| 1/8 | 6 | 8 | 48 |
| Cuartos | 10 | 4 | 40 |
| Semifinales | 15 | 2 | 30 |
| 3.º/4.º puesto | 12 | 1 | 12 |
| Final | 25 | 1 | 25 |

> **Importante**: el acierto se cuenta solo si el equipo predicho **realmente jugó** ese cruce y lo ganó. Si por culpa de un fallo anterior el jugador colocó en cuartos a un equipo que ya quedó eliminado en 1/16, ese cruce ya no puede puntuar (no se "regenera" el bracket del usuario al avanzar las rondas).
> Excepción: si la app permite "rebracket" automático (recolocar al equipo que sí pasó en la siguiente ronda predicha por el usuario), se anota así en la `data-model.md`. **Decisión por defecto: NO rebracket. La predicción del usuario es rígida.**

**Máximo bracket**: **219 pts**.

### 3.5 Cuadro de honor

| Acierto | Puntos |
|---|---|
| Campeón | **20** |
| Subcampeón | **12** |
| 3.º puesto | **8** |

> Si los puntos del bracket ya incluyen el ganador de la final (25 pts) y del 3.º/4.º (12 pts), los puntos del cuadro de honor son **adicionales** (es decir, premiar nominalmente al campeón da más peso a esa predicción concreta, que es lo simbólico de la porra).

**Máximo**: **40 pts**.

### 3.6 Premios individuales

| Premio | Puntos |
|---|---|
| Bota de Oro | **15** |
| Bota de Plata | **8** |
| Bota de Bronce | **5** |
| Balón de Oro | **12** |
| Balón de Plata | **6** |
| Balón de Bronce | **4** |

**Máximo**: **50 pts**.

### 3.7 Puntuación máxima posible

| Categoría | Máx. |
|---|---|
| Fase de grupos (marcadores) | 360 |
| Clasificación de grupos | 180 |
| Mejores terceros | 29 |
| Bracket eliminatorio | 219 |
| Cuadro de honor | 40 |
| Premios individuales | 50 |
| **TOTAL** | **878** |

---

## 4. Puntos penalizados (sanción por porra incompleta)

El Excel marca explícitamente "**Puntos penalizados**" si quedan apuestas sin rellenar. Reglas en la app:

- Si al cierre de inscripciones (ver §5) un jugador tiene huecos, **NO se le elimina**: se le penaliza con **−1 punto por cada predicción vacía** en las categorías 3.1 a 3.3 (fase de grupos, clasificación de grupos, mejores terceros).
- En el bracket, el cuadro de honor y los premios individuales, la falta de predicción se traduce simplemente en **0 puntos** en ese acierto (sin penalización adicional, porque la pérdida ya es lo bastante grande).
- El formulario debe avisar de forma muy visible "PORRA INCOMPLETA" hasta que esté 100 % rellena (replicando el comportamiento del Excel).

---

## 5. Bloqueo temporal de predicciones

| Bloque | Se bloquea al... |
|---|---|
| Marcador de cada partido de grupos | Pitido inicial **de ese partido concreto** |
| Clasificación de cada grupo | Pitido inicial del **último partido** de ese grupo |
| Mejores terceros | Pitido inicial del **primer partido de 1/16** |
| Cada cruce del bracket | Pitido inicial **de ese cruce concreto** |
| Cuadro de honor | Pitido inicial de la **final** |
| Bota / Balón de Oro/Plata/Bronce | Pitido inicial de la **final** |

> **Excepción de la versión MVP**: para simplificar, la app puede bloquear **toda la porra a la vez al pitido inicial del partido inaugural (11 jun, México–Sudáfrica)** y permitir modificaciones hasta entonces. Esto es lo que hace el Excel original.
> **Recomendación**: empezar con bloqueo global (MVP) y migrar al bloqueo por bloques en una segunda iteración.

Tras el bloqueo, la fila de esa predicción queda **read-only** en la UI, con marca de agua "BLOQUEADA".

---

## 6. Reglas especiales y casos límite

### 6.1 Si un equipo se retira del Mundial

Los partidos no jugados se tratan como **anulados**: ninguna predicción de ese partido suma ni resta puntos. El bracket sigue avanzando con el rival.

### 6.2 Prórroga y penaltis (eliminatorias)

En las eliminatorias **solo cuenta el resultado final** (incluyendo prórroga y penaltis). Si el usuario predijo "gana X", y X gana en penaltis, **acierta**.

### 6.3 Goles de plata, oro o reglas raras

No aplica. FIFA juega con prórroga de 30' + tanda de penaltis si sigue empate.

### 6.4 Predicción con empate en fase de grupos

En la fase de grupos los empates están permitidos en cualquier partido (es lo habitual). Las reglas de §3.1 ya contemplan estos casos.

### 6.5 Predicción con empate en eliminatorias

En el bracket el usuario predice **el ganador**, no el marcador, así que no hay empates posibles en su predicción.

### 6.6 Jugadores que dejan de existir (Bota/Balón)

Si el jugador predicho se retira, lesiona o no participa, su predicción **vale 0** en esa categoría (no se penaliza).

### 6.7 Empate de jugadores en goles (Bota)

Si dos jugadores empatan en goles para la Bota de Oro, **FIFA aplica criterio de asistencias y luego minutos**. La app respeta el ganador oficial de FIFA. Si el usuario predijo a cualquiera de los empatados que NO ganó el premio, no acierta.

---

## 7. Ranking general y desempates

El ranking general se ordena por **puntos totales descendentes**. Si dos o más jugadores empatan a puntos al final del Mundial, se aplican estos criterios **en orden**:

1. Más **marcadores exactos** acertados en fase de grupos.
2. Más **ganadores de cruce** acertados en eliminatorias.
3. Si acertó al **campeón**.
4. Si acertó al **subcampeón**.
5. Si acertó al **3.º puesto**.
6. Más **clasificaciones de grupo** clavadas (los 4 en orden).
7. Más **premios individuales** acertados (cualquiera de los 6).
8. Sorteo público (último recurso, lo organiza el admin con `random.org`).

---

## 8. Visibilidad de predicciones entre jugadores

- **Antes del bloqueo de cada predicción**: cada jugador solo ve la suya. Esto evita copias y "porras gemelas".
- **Después del bloqueo de cada predicción**: la predicción de cada jugador es pública para el resto de jugadores autenticados.
- En el ranking, los puntos de cada categoría son siempre visibles (transparencia).

---

## 9. Resumen para el motor de puntuación

El motor (`scoreEngine.calculateUserScore(userId)`) debe:

1. Cargar todas las predicciones del usuario.
2. Cargar todos los resultados oficiales registrados por el admin (`matches.goles_local`, `matches.goles_visitante`, `matches.ganador`, ranking real de grupos, terceros oficiales, podio real, premios oficiales).
3. Para cada categoría 3.1–3.6, aplicar la tabla correspondiente.
4. Para predicciones vacías, aplicar §4 (penalización).
5. Guardar el desglose en `scores` (una fila por categoría + usuario), no solo el total.
6. Recalcular el ranking general aplicando §7 si hay empates.
7. Disparar recálculo **idempotente** cada vez que el admin actualiza un resultado.

---

## 10. Versionado de las reglas

Este documento es **v1.0**. Cualquier cambio en puntos, reglas de bloqueo o desempate genera **v1.x** con changelog. Los recálculos retroactivos quedan registrados en una tabla `score_recalculations` con timestamp, motivo y diff.
