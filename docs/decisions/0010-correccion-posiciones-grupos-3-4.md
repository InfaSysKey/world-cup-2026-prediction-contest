# 0010 — Corrección de las posiciones 3.º/4.º de grupos (1 → 2 pts)

**Fecha**: 2026-06-25
**Estado**: aceptada (revisa parcialmente `0009-puntuacion-segun-excel-canonico.md`)

## Contexto

El ADR 0009 (15-jun-2026) adoptó el Excel del organizador como fuente única de
verdad de la puntuación y transcribió `docs/scoring-rules.md` a v2.0. En esa
transcripción, la "Clasificación de grupo" (§3.2) quedó registrada como
**2/2/1/1 puntos** para las posiciones 1.ª, 2.ª, 3.ª y 4.ª respectivamente, con
nota explícita de que las cifras estaban *"todas confirmadas con el
organizador"*.

El 25-jun-2026, al revisar el motor de puntuación porque "no se estaba haciendo
bien", el organizador comparte el JSON literal de la pestaña "Reglas" del Excel.
La cuadrícula muestra:

```
FASE DE GRUPOS - Posición exacta (1º): 2
FASE DE GRUPOS - Posición exacta (2º): 2
FASE DE GRUPOS - Posición exacta (3º): 2
FASE DE GRUPOS - Posición exacta (4º): 2
```

Es decir, las cuatro posiciones valen 2 pts cada una. La transcripción del ADR
0009 leyó 2/2/1/1 — probablemente al confundir el Excel con la versión "v1.2"
heredada de scoring-rules.md, que sí daba 4/3/2/1 antes de adoptar el Excel.

Resto de reglas comparadas regla a regla contra el JSON del organizador:
coinciden 1:1 con lo implementado (5/3/0 en marcadores de grupos y knockouts,
2 pts por equipo clasificado a cada fase, 30/20/10 podio, 10/7/5 botas y
balones, diferencia de goles con 1X2 = 0 desactivada). La única discrepancia es
la de §3.2.

## Decisión

Corregir `GROUP_STANDING_POSITION_POINTS` a **`[2, 2, 2, 2]`** y propagar el
cambio a documentación, fixtures, tests y al recálculo retroactivo de
`group_standings`. Se mantiene intacto el resto del ADR 0009.

Impacto numérico:

| | v2.0 (ADR 0009, incorrecto) | v2.1 (ADR 0010) |
|---|---:|---:|
| Máximo por grupo | 6 | **8** |
| Máximo categoría `group_standings` | 72 | **96** |
| Máximo total de la porra | 824 | **848** |

`docs/scoring-rules.md` pasa de **v2.0** a **v2.1** con entrada de changelog y
referencia a este ADR.

## Consecuencias

**Ganamos**:

- Paridad real con el Excel del organizador. Cualquier jugador puede pegar su
  porra en el Excel y obtener exactamente los puntos que la app reporta.
- El motor sigue siendo idempotente: una sola constante cambia, el resto del
  algoritmo (función `scoreGroupStanding`) es invariante.

**Perdemos**:

- **Recálculo retroactivo** de la categoría `group_standings` para todos los
  usuarios. Como el lock global está activo desde el 11-jun-2026, las
  predicciones de orden de grupo de los 7 jugadores ya están fijas; los puntos
  oficiales solo se han escrito para los grupos cuyas posiciones reales ya
  cerró el admin. El recálculo se dispara con
  `npx tsx lib/db/seed/recalc-all.ts --reason "ADR 0010 — Posiciones 3.º/4.º
  a 2 pts"`. Queda fila de auditoría en `score_recalculations`.
- Posibles cambios de ranking: si dos usuarios estaban empatados y uno tenía
  más posiciones 3.º/4.º acertadas, ahora se separan. El snapshot del recálculo
  registra el delta ▲/▼.

## Alternativas consideradas

- **Mantener 2/2/1/1 y avisar al organizador del desajuste**: rompe el contrato
  "lo que pone el Excel manda" del ADR 0009. Rechazada: el Excel es la fuente
  única, no la transcripción.
- **Revisar el ADR 0009 in-place en vez de levantar un ADR nuevo**: opaca la
  historia. Un ADR es inmutable: si la decisión cambia, se levanta uno nuevo
  que cite al anterior. Es lo que recomienda el propio `0001-stack-tecnico.md`
  y la plantilla de la sección §12 de `CLAUDE.md`.

## Impacto en `scoring-rules.md`

Bump a **v2.1**. Cambios concretos:

- §3.2: tabla pasa de 2/2/1/1 a 2/2/2/2. Máximo por grupo 6→8.
- §3.7: total `group_standings` 72→96. Total general 824→848.
- Changelog: entrada v2.1 con referencia a este ADR.
- Encabezado: "transcribe a v2.0" → "transcribe a v2.1" y se cita este ADR
  junto al 0009.

## Impacto en código

- `lib/scoring/points.ts`: constante a `[2, 2, 2, 2]` y comentario.
- `lib/scoring/group-standings.ts`: comentario de cabecera.
- `lib/scoring/__fixtures__/group-standings.ts`: 4 de los 9 casos esperados
  cambian (orden completo, solo 3.º, solo 4.º, parcial 1.º+3.º, hueco en 2.º).
- `lib/scoring/group-standings.test.ts`: máximo 6→8.
- `lib/scoring/compute.test.ts`: el escenario calculado a mano tenía
  `group_standings: 10` (6 + 4) → ahora `14` (8 + 6); total general 74→78.

## Impacto operativo

Disparar el recálculo total tras el merge del fix:

```
npx tsx lib/db/seed/recalc-all.ts --reason "ADR 0010 — Corrección posiciones 3.º/4.º a 2 pts"
```

El script reutiliza `recalculateAll`, registra una única fila en
`score_recalculations` con snapshot de posiciones del ranking (deltas ▲/▼) y
deja `scores.calculated_at` actualizado para todas las filas
`group_standings`.
