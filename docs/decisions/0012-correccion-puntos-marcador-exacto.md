# 0012 — Corrección del sumatorio de marcadores: exacto = 8, no 5

**Fecha**: 2026-06-25
**Estado**: aceptada (revisa parcialmente `0009-puntuacion-segun-excel-canonico.md`)

## Contexto

El ADR 0009 (15-jun-2026) adoptó el Excel del organizador como fuente única de verdad de la puntuación y modeló las reglas de §3.1 y §3.3 como tres alternativas **excluyentes**:

> Fase de grupos (por partido): 5 (exacto) / 3 (signo 1X2) / 0 (resto).

Esa lectura interpretó las tres líneas del Excel ("Signo 1X2", "Diferencia/Distancia de goles con 1X2 acertado", "Resultado exacto") como mutuamente exclusivas. El motor de puntuación devolvía `points = 5` para un marcador exacto y `points = 3` para un acierto-solo-de-signo.

El 25-jun-2026, al comparar la clasificación de la app con la del Excel de uno de los amigos del grupo (Uzbekos), Carlos detectó que las puntuaciones no cuadraban. La hoja del Excel mostraba columnas con **máximos teóricos por categoría** que no encajaban con la lectura del ADR 0009:

| Columna del Excel | Máx. declarado | Máx. si exacto=5 (ADR 0009) | Máx. si exacto=3+5=8 |
|---|---:|---:|---:|
| F. Grupos (72 partidos) | **576** | 72×5 = 360 | 72×8 = **576** ✓ |
| Partidos 1/16 | **128** | 16×5 = 80 | 16×8 = **128** ✓ |
| Partidos 1/8 | **64** | 8×5 = 40 | 8×8 = **64** ✓ |
| Partidos 1/4 | **32** | 4×5 = 20 | 4×8 = **32** ✓ |
| Partidos 1/2 | **16** | 2×5 = 10 | 2×8 = **16** ✓ |
| Partido 3-4 | **8** | 1×5 = 5 | 1×8 = **8** ✓ |
| Partido Final | **8** | 1×5 = 5 | 1×8 = **8** ✓ |

Los máximos por partido del Excel son **8**, lo que solo es consistente con una lectura **acumulativa** de las tres líneas: cada partido suma de manera **aditiva** el "Signo 1X2" (3) + "Diferencia con 1X2 acertado" (0, desactivada) + "Resultado exacto" (5). Un marcador exacto, al cumplirse las tres condiciones, da 3 + 0 + 5 = 8 pts.

La diferencia exacta entre el total máximo del Excel (1160) y el de nuestro código previo (848) es **312 = 104 partidos × 3**: los 3 pts del signo que se "perdían" en cada marcador exacto a lo largo de los 104 partidos del torneo.

## Decisión

Corregir las constantes a:

- `GROUP_MATCH_POINTS.exact` = **8** (era 5)
- `KNOCKOUT_MATCH_POINTS.exact` = **8** (era 5)

`result` (3) y `wrong` (0) no cambian. La estructura del motor (`scoreMatch` devuelve "exact O result O wrong" excluyentes) **se conserva**: simplemente, el valor de "exact" ahora absorbe el sumatorio (3+5) en una sola constante. Es matemáticamente equivalente a "siempre +3 por signo + (adicional +5 si exacto)".

`docs/scoring-rules.md` pasa de **v2.1** a **v2.2** con entrada de changelog y referencia a este ADR.

Impacto numérico:

| | v2.1 (ADR 0010, incorrecto) | v2.2 (ADR 0012) |
|---|---:|---:|
| Máx. por partido | 5 | **8** |
| Máx. categoría `group_matches` (72) | 360 | **576** |
| Máx. categoría `bracket` (32) | 160 | **256** |
| Máximo total de la porra | 848 | **1160** |

## Consecuencias

**Ganamos**:

- Paridad real con el Excel del organizador y con las clasificaciones de los Excels que llevan los amigos a mano. Cualquier jugador puede pegar su porra en el Excel y obtener exactamente los mismos puntos que la app reporta.
- El motor sigue siendo idempotente: solo cambian dos constantes; el resto del algoritmo es invariante.

**Perdemos**:

- **Recálculo retroactivo** de las categorías `group_matches` y `bracket` para todos los usuarios. Como el lock global está activo desde el 11-jun-2026 y ya hay marcadores oficiales escritos, los puntos por marcadores exactos van a subir 3 por cada acierto exacto. El recálculo se dispara con `npx tsx lib/db/seed/recalc-all.ts --reason "ADR 0012 — Marcador exacto vale 8 (3 signo + 5 exacto)"`. Queda fila de auditoría en `score_recalculations`.
- Cambios significativos de ranking: jugadores con muchos exactos van a subir más que los que solo aciertan signos. El snapshot del recálculo registra el delta ▲/▼.
- Tres ADRs encadenados (0009, 0010, 0012) tocando el mismo Excel canónico — señal de que la primera transcripción del 15-jun fue apresurada. Próximas adopciones de tablas externas deberían validarse contra los máximos declarados y contra al menos una porra real antes de aceptarlas como canónicas.

## Alternativas consideradas

- **Refactorizar `scoreMatch` para sumar 3 + 5 explícitamente** en lugar de cambiar la constante de exact a 8: más expresivo en código, pero matemáticamente equivalente. Rechazado: cambio mínimo, menos diff, menos riesgo.
- **Mantener exact=5 y avisar al organizador del desajuste**: rompe el contrato "lo que pone el Excel manda" del ADR 0009. Rechazada: el Excel es la fuente única, no la transcripción.

## Impacto en `scoring-rules.md`

Bump a **v2.2**. Cambios concretos:

- §3 cabecera: explica explícitamente que la regla es acumulativa por línea y cómo el motor la modela.
- §3.1: tabla pasa de "5 / 3 / 0" a "3+5=8 / 3 / 0". Máximo por categoría 360→576.
- §3.3: idem para knockouts. Máximo 160→256.
- §3.7: totales recalculados (total general 848→1160).
- Changelog: entrada v2.2 con referencia a este ADR.

## Impacto en código

- `lib/scoring/points.ts`: `exact: 5 → 8` en GROUP_MATCH_POINTS y KNOCKOUT_MATCH_POINTS, comentarios actualizados.
- `lib/scoring/group-matches.ts` + `knockout.ts`: cabeceras explicando el sumatorio (3 + 5 = 8).
- Fixtures: `__fixtures__/group-matches.ts` y `__fixtures__/knockout.ts` con `points: 8` en los casos exactos.
- Tests: `group-matches.test.ts` y `knockout.test.ts` con máximo por partido 5 → 8. `compute.test.ts` SCENARIO con `group_matches: 5→8`, `bracket: 5→8` y total 78→84. `podium.test.ts` con la suma 5+30=35 → 8+30=38.

## Impacto operativo

Disparar el recálculo total tras el merge del fix:

```
npx tsx lib/db/seed/recalc-all.ts --reason "ADR 0012 — Marcador exacto vale 8 (3 signo + 5 exacto)"
```

El script reutiliza `recalculateAll`, registra una única fila en
`score_recalculations` con snapshot de posiciones del ranking (deltas ▲/▼) y
deja `scores.calculated_at` actualizado para todas las filas de las 6
categorías. Las puntuaciones de la app pasarán a coincidir con las del Excel
de los amigos.
