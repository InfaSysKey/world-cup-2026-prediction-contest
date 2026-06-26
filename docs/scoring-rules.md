# Reglamento de la Porra — Mundial 2026

Este documento describe **todas las predicciones** que puede hacer un jugador, **cuándo se bloquean**, **cómo se puntúan** y los **criterios de desempate** del ranking general.

Es la referencia única para el motor de puntuación (`scoring engine`) y para el formulario de porra. **La fuente canónica de la puntuación es la pestaña de "Reglas" del Excel del organizador** (compartido el 15-jun-2026); este documento la transcribe a v2.2 (ver `docs/decisions/0009-puntuacion-segun-excel-canonico.md`, la corrección de las posiciones 3.º/4.º en `docs/decisions/0010-correccion-posiciones-grupos-3-4.md`, y la corrección del sumatorio "signo + exacto" en `docs/decisions/0012-correccion-puntos-marcador-exacto.md`). Cualquier cambio aquí implica recálculo retroactivo de la tabla.

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

El jugador completa la porra **antes del pitido inicial del primer partido del torneo** (11 jun 2026, 17:00 UTC). Una vez bloqueada, no se puede modificar nada que ya esté bloqueado.

### 2.1 Fase de grupos (72 partidos)

Para cada partido el jugador predice **el marcador exacto** (goles del local y goles del visitante).

### 2.2 Clasificación de cada grupo

Por cada uno de los 12 grupos, el jugador predice el **orden final** de los 4 equipos: 1.º, 2.º, 3.º y 4.º.

### 2.3 Desempates de grupo (hasta 6 por grupo)

Si la predicción de fase de grupos deja a dos o más equipos del mismo grupo **empatados según los criterios de clasificación** (puntos → diferencia de goles → goles a favor), el jugador define manualmente el orden de desempate.

> **En la app**: este paso se resuelve en el propio formulario de orden de grupo. El motor detecta el empate **solo cuando el grupo está completo** (los 6 marcadores rellenados) y **solo entre equipos iguales en puntos, diferencia de goles y goles a favor**; si la diferencia de goles o los goles a favor ya los separan, no hay nada que desempatar. Cuando sí hay empate, el formulario resalta esos equipos dentro de la lista de orden del grupo y el jugador decide su orden relativo ahí mismo. Ver `docs/decisions/0007-desempate-grupos-gd-gf.md`.

### 2.4 Mejores terceros (ranking de 8)

El jugador ordena los **12 terceros clasificados** y marca cuáles son, en su opinión, los **8 que pasan a 1/16**.

> **No genera puntos propios desde v2.0**. La predicción se mantiene como input lógico para resolver el bracket del jugador (qué tercero juega contra quién en 1/16). Los aciertos sobre quién clasifica realmente a 1/16 se reflejan en §3.4 (Equipos clasificados por fase). Ver `docs/decisions/0009-puntuacion-segun-excel-canonico.md`.

### 2.5 Bracket eliminatorio (32 cruces)

Para cada cruce el jugador predice **el marcador completo** (goles del local y goles del visitante en 90' + prórroga) **y el ganador del cruce** (que decide quién pasa a la siguiente ronda — por penaltis si el marcador queda empate al 120'):

- **1/16**: 16 cruces
- **1/8**: 8 cruces
- **Cuartos**: 4 cruces
- **Semis**: 2 cruces
- **Final**: 1 cruce (campeón)
- **3.º y 4.º puesto**: 1 cruce

> El ganador es obligatorio (es la base del bracket rígido, ADR 0003) y debe coincidir con el lado mayor del marcador salvo si la predicción es empate (en cuyo caso el ganador representa quién pasa en una hipotética tanda de penaltis).

### 2.6 Cuadro de honor (podio)

- 🥇 **Campeón**
- 🥈 **Subcampeón** (perdedor de la final)
- 🥉 **3.º puesto**

> Estos tres se **sugieren** automáticamente desde el bracket (ganador de la final → campeón; el otro finalista → subcampeón; ganador del 3-4 → 3.º), pero se guardan como predicciones explícitas **solo cuando el jugador los confirma o edita** en el formulario; la sugerencia no se persiste por sí sola (ver `docs/decisions/0005-podio-sugerido-no-persistido.md`).

### 2.7 Premios individuales

- **Bota de Oro** (máximo goleador), **Bota de Plata** (2.º), **Bota de Bronce** (3.º).
- **Balón de Oro** (mejor jugador), **Balón de Plata** (2.º), **Balón de Bronce** (3.º).

Texto libre, con autocompletado contra un catálogo de jugadores que el admin importa.

---

## 3. Sistema de puntuación

Tabla canónica del Excel del organizador (ADR 0009 + ADR 0012). La regla del Excel es **acumulativa por línea**: cada partido suma 3 por acertar el signo 1X2 + 0 por la "Diferencia de goles con 1X2 acertado" (línea desactivada por el organizador) + 5 adicionales por acertar el marcador exacto. Total para un marcador exacto = 3 + 0 + 5 = **8 pts**. El motor lo modela como tres reglas excluyentes (`exact = 8`, `result = 3`, `wrong = 0`) que ya absorben el sumatorio.

### 3.1 Partidos de fase de grupos (por partido)

| Acierto | Puntos |
|---|---|
| Marcador exacto = signo 1X2 + marcador exacto (ej. predicción 2–1, real 2–1) | **3 + 5 = 8** |
| Acierto del signo 1X2 con marcador no exacto (ej. predijo 2–1, real 3–1 → ambos victoria local) | **3** |
| Resto (incluida predicción vacía) | **0** |

**Acumulado máximo en fase de grupos por partidos**: 72 × 8 = **576 pts**.

### 3.2 Clasificación de grupo (por grupo)

| Acierto | Puntos |
|---|---|
| Acertar 1.º del grupo | **2** |
| Acertar 2.º del grupo | **2** |
| Acertar 3.º del grupo | **2** |
| Acertar 4.º del grupo | **2** |

**Máximo por grupo**: 2+2+2+2 = 8. Total 12 grupos: **96 pts**.

### 3.3 Cruces eliminatorios (por cruce)

Mismo esquema que §3.1, aplicado al **marcador en 90' + prórroga** (sin penaltis).

| Acierto | Puntos |
|---|---|
| Marcador exacto al 120' = signo 1X2 + marcador exacto | **3 + 5 = 8** |
| Acierto del signo 1X2 al 120' con marcador no exacto | **3** |
| Resto | **0** |

> Un cruce que termina empate al 120' y se decide por penaltis se evalúa así: el signo 1X2 es **empate** (no "gana X por penaltis"). Si el jugador predijo empate, acierta 1X2; si predijo a uno ganando, no.

**Acumulado máximo**: 32 × 8 = **256 pts**.

### 3.4 Equipos clasificados por fase

Por cada equipo que el jugador predijo y que efectivamente llega a una fase, **2 pts**. Esta categoría es ortogonal al marcador del cruce: premia la quiniela del bracket, no la lectura táctica del partido.

| Fase | Equipos que llegan | Máx. |
|---|---|---|
| 1/16 | 32 (24 standings 1.º/2.º + 8 mejores terceros) | 64 |
| Octavos | 16 (ganadores de 1/16) | 32 |
| Cuartos | 8 (ganadores de octavos) | 16 |
| Semis | 4 (ganadores de cuartos) | 8 |
| 3.º-4.º puesto | 2 (perdedores de semis) | 4 |
| Final | 2 (ganadores de semis) | 4 |

**Máximo total**: **128 pts**.

> Implementación: la lista de "equipos predichos a fase X" se deriva del estado de la porra del jugador (standings + mejores terceros para 1/16; `predictions_knockout.winner_team_code` filtrado por phase para el resto). La lista oficial sale de `actual_group_standings` + `actual_best_thirds` + `matches.real_winner_team_code`. Los puntos son `2 × |predicted ∩ actual|` por fase.
>
> **Puntuación parcial (ADR 0013)**: la categoría es **por-equipo**. En cuanto un equipo se confirma (su grupo se cierra, o entra en `actual_best_thirds`, o gana su cruce), el jugador que lo predijo suma sus 2 pts inmediatamente — aunque queden otros equipos por confirmar en la misma fase. Equipos cuyo estado aún no se conoce no penalizan. No hay "all-or-nothing" por fase.

### 3.5 Cuadro de honor

| Acierto | Puntos |
|---|---|
| Campeón | **30** |
| Subcampeón | **20** |
| 3.º puesto | **10** |

> Estos puntos son **adicionales** a los del cruce de la final y del 3-4 (§3.3) y a los de "Equipo clasificado para final/3-4" (§3.4). Es lo simbólico del podio.

**Máximo**: **60 pts**.

### 3.6 Premios individuales

| Premio | Puntos |
|---|---|
| Bota de Oro | **10** |
| Bota de Plata | **7** |
| Bota de Bronce | **5** |
| Balón de Oro | **10** |
| Balón de Plata | **7** |
| Balón de Bronce | **5** |

**Máximo**: **44 pts**.

### 3.7 Puntuación máxima posible

| Categoría | Máx. |
|---|---|
| Fase de grupos (marcadores) | 576 |
| Clasificación de grupos | 96 |
| Cruces eliminatorios (marcadores) | 256 |
| Equipos clasificados por fase | 128 |
| Cuadro de honor | 60 |
| Premios individuales | 44 |
| **TOTAL** | **1160** |

---

## 4. Predicciones vacías

A diferencia de versiones anteriores del reglamento, **el Excel canónico no penaliza con puntos negativos** los huecos: una predicción no rellenada vale **0 pts** en la categoría correspondiente, sin penalización adicional.

El formulario debe seguir avisando de forma muy visible "PORRA INCOMPLETA" hasta que esté 100 % rellena (replicando el comportamiento del Excel y para evitar pérdidas evitables de puntos).

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

> **Excepción de la versión MVP** (activa): la app bloquea **toda la porra a la vez al pitido inicial del partido inaugural (11 jun 2026, 17:00 UTC, México–Sudáfrica)**, replicando el comportamiento del Excel original. Lock global activo desde esa fecha y vigente durante toda la v2.0.

Tras el bloqueo, la fila de esa predicción queda **read-only** en la UI, con marca de agua "BLOQUEADA".

---

## 6. Reglas especiales y casos límite

### 6.1 Si un equipo se retira del Mundial

Los partidos no jugados se tratan como **anulados**: ninguna predicción de ese partido suma ni resta puntos. El bracket sigue avanzando con el rival.

### 6.2 Prórroga y penaltis (eliminatorias)

- **Marcador exacto / signo 1X2 (§3.3)**: se evalúan sobre el marcador al final del 90' + **prórroga**. Los penaltis **no** modifican el marcador para el cómputo de §3.3.
- **Ganador del cruce / "Equipo clasificado para X" (§3.4)**: el ganador real es el que pasa a la siguiente ronda — incluyendo decisión por penaltis. Es el equipo que el admin registra en `matches.real_winner_team_code`.

### 6.3 Goles de plata, oro o reglas raras

No aplica. FIFA juega con prórroga de 30' + tanda de penaltis si sigue empate.

### 6.4 Predicción con empate en fase de grupos

En la fase de grupos los empates están permitidos en cualquier partido (es lo habitual). Las reglas de §3.1 ya contemplan estos casos.

### 6.5 Predicción con empate en eliminatorias

En el bracket el usuario predice un marcador completo: puede predecir empate al 120' y a la vez marcar a un equipo como ganador del cruce (quien pasaría por penaltis). Esto es coherente con §3.3 (el empate cuenta como signo 1X2 si el partido real acaba empate al 120') y con §3.4 (el ganador del cruce cuenta para "Equipo clasificado para X").

### 6.6 Jugadores que dejan de existir (Bota/Balón)

Si el jugador predicho se retira, lesiona o no participa, su predicción **vale 0** en esa categoría (no se penaliza).

### 6.7 Empate de jugadores en goles (Bota)

Si dos jugadores empatan en goles para la Bota de Oro, **FIFA aplica criterio de asistencias y luego minutos**. La app respeta el ganador oficial de FIFA. Si el usuario predijo a cualquiera de los empatados que NO ganó el premio, no acierta.

---

## 7. Ranking general y desempates

El ranking general se ordena por **puntos totales descendentes**. Si dos o más jugadores empatan a puntos al final del Mundial, se aplican estos criterios **en orden**:

1. Más **marcadores exactos** acertados en fase de grupos (§3.1, fila exacto).
2. Más **marcadores exactos** acertados en eliminatorias (§3.3, fila exacto).
3. Más equipos acertados en "Equipos clasificados por fase" (§3.4, total).
4. Si acertó al **campeón**.
5. Si acertó al **subcampeón**.
6. Si acertó al **3.º puesto**.
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

1. Cargar todas las predicciones del usuario (5 tablas `predictions_*`).
2. Cargar todos los resultados oficiales (`matches.real_goles_*`, `matches.real_winner_team_code`, `actual_group_standings`, `actual_best_thirds`, `actual_awards`).
3. Computar las **6 categorías** de v2.0 (`group_matches`, `group_standings`, `bracket`, `team_advancement`, `podium`, `awards`).
4. Guardar el desglose en `scores` (una fila por categoría + usuario), no solo el total.
5. Recalcular el ranking general aplicando §7 si hay empates.
6. Disparar recálculo **idempotente** cada vez que el admin actualiza un resultado.

---

## 10. Versionado de las reglas

Este documento es **v2.3**. Cualquier cambio en puntos, reglas de bloqueo o desempate genera **v2.x** con changelog. Los recálculos retroactivos quedan registrados en una tabla `score_recalculations` con timestamp, motivo y diff.

### Changelog

- **v2.3** (2026-06-26) — Aclaración de §3.4: la categoría "Equipos clasificados por fase" se evalúa **por-equipo** y se otorga **parcialmente** conforme se confirman los equipos en BD, no esperando al cierre completo de la fase. Cambio de implementación (no de puntos): el motor pasaba 0 pts a todos los jugadores hasta que se cerraban los 32 equipos de 1/16; ahora suma los confirmados conforme se cierran grupos. Disparo recálculo retroactivo de `team_advancement`. Ver `docs/decisions/0013-puntos-equipos-clasificados-parciales.md`.
- **v2.2** (2026-06-25) — Corrección del sumatorio de marcadores (§3.1, §3.3): el Excel canónico es **acumulativo** por línea, no excluyente. Un marcador exacto vale **3 (signo) + 0 (diferencia desactivada) + 5 (exacto) = 8 pts**, no 5. La transcripción en ADR 0009 leyó las tres líneas como mutuamente excluyentes y por eso el motor daba 5 al exacto. Esto explica que los Excels de los amigos puntúen más alto. Máximo grupos 360→**576**, knockouts 160→**256**, total general 848→**1160**. Disparo recálculo retroactivo de `group_matches` y `bracket`. Ver `docs/decisions/0012-correccion-puntos-marcador-exacto.md`.
- **v2.1** (2026-06-25) — Corrección de las posiciones 3.º y 4.º de la clasificación de cada grupo (§3.2): pasan de 1 → 2 pts cada una. La transcripción del Excel en v2.0 (ADR 0009) había leído 2/2/1/1; la revisión directa de la pestaña "Reglas" muestra 2/2/2/2. Máximo por grupo 6→8, categoría 72→96, total general 824→**848**. Disparo recálculo retroactivo de `group_standings`. Ver `docs/decisions/0010-correccion-posiciones-grupos-3-4.md`.
- **v2.0** (2026-06-15) — Reescritura completa para alinear con la tabla canónica del Excel del organizador. Knockouts pasan a puntuar marcador + 1X2 (5/3/0). Nuevas posiciones de grupo 2/2/1/1 sin bonus. Nueva categoría "Equipos clasificados por fase" (2 pts × equipo, máx 128). Podio 30/20/10. Premios 10/7/5 cada terna. Se elimina la puntuación de mejores terceros y la penalización por hueco. Diferencia/distancia con 1X2 = 0 (regla desactivada en el Excel). Total máx = 824. Disparo recálculo retroactivo. Ver `docs/decisions/0009-puntuacion-segun-excel-canonico.md`.
- **v1.2** (2026-06-10) — §2.3: el desempate del orden de grupo se detecta con la cadena puntos → diferencia de goles → goles a favor. Solo afecta a qué sub-órdenes pide el formulario, no a la puntuación. Ver `docs/decisions/0007-desempate-grupos-gd-gf.md`.
- **v1.1** (2026-06-09) — §3.1: regla de marcadores de grupos basada en outcome (1X2) tras detectar incoherencia entre ejemplos. Ver `docs/decisions/0006-puntuacion-grupos-basada-en-outcome.md`.
- **v1.0** — versión inicial.
