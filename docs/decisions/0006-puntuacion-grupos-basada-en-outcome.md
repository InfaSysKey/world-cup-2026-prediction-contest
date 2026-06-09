# 0006 — Puntuación de marcadores de grupos basada en outcome (1X2)

**Fecha**: 2026-06-09
**Estado**: aceptada

## Contexto

Al empezar el slice 5 (motor de puntuación) implementamos §3.1 de `scoring-rules.md` (marcadores de fase de grupos) con TDD estricto. Al derivar los casos canónicos directamente de la doc, sus propios ejemplos resultaron **mutuamente contradictorios** bajo cualquier regla simple:

| Predicción | Real | Doc v1.0 | Outcome 1X2 |
|---|---|---|---|
| 2–1 | 3–1 | **3** (resultado) | ambos victoria local → mismo |
| 2–1 | 2–0 | **1** (un equipo) | ambos victoria local → **mismo** |
| 1–1 | 2–2 | **3** (resultado) | ambos empate → mismo |

`2–1 vs 2–0` y `2–1 vs 3–1` tienen el **mismo outcome** (victoria local) y en ambos se acierta exactamente los goles de un equipo, pero la doc puntuaba uno con 3 y otro con 1. Una regla basada en el resultado 1X2 da 3 a ambos; la única regla que respetaba los tres ejemplos literales premiaba específicamente acertar los goles del equipo **perdedor**, lo cual es poco intuitivo y dejaba casos sin definir (p. ej. `2–1 vs 5–3`).

## Decisión

Adoptamos la **regla basada en outcome (1X2)**, estándar en quinielas, y corregimos el ejemplo erróneo de la doc:

1. **Marcador exacto** (ambos goles) → **5** (`exact`).
2. **Acierto del 1X2** (mismo ganador, o ambos empate) con marcador no exacto → **3** (`result`).
3. **Fallo del 1X2** pero acierto de los goles de exactamente un equipo → **1** (`one_goal`).
4. **Fallo total** → **0** (`wrong`).
5. **Predicción vacía** → **−1** (`empty`, penalización §4).
6. **Partido cancelado/anulado** (§6.1) → **0** (`cancelled`), sin penalización.

Bajo esta regla `2–1 vs 2–0` puntúa **3** (acierto de outcome), no 1. El ejemplo de la doc se sustituye por uno coherente con `one_goal`: `2–1 vs 2–3` (outcome distinto, se acierta el local) → 1.

## Consecuencias

**Ganamos**:
- Regla intuitiva y consistente; sin casos huérfanos sin definir.
- Función pura trivial de testear (un solo eje: outcome + cuántos goles coinciden).

**Perdemos**:
- Cambia el comportamiento respecto a la lectura literal de la doc v1.0 en el caso "aciertas solo los goles del ganador con outcome correcto" (antes habría sido 1, ahora 3). Como aún no hay torneo jugado ni puntuaciones reales, no hay recálculo retroactivo que registrar.

## Alternativas consideradas

- **R2 (literal, premiar al perdedor)**: respeta los tres ejemplos de la doc sin tocarla, pero la regla es contraintuitiva y deja casos sin especificar. Rechazada.
- **Dejar la doc como está**: imposible, sus ejemplos se contradicen y el motor no puede implementar una regla inconsistente.

## Impacto en `scoring-rules.md`

Se corrige el ejemplo de la fila `one_goal` en §3.1 y se bumpea la versión del documento a **v1.1** con su entrada de changelog en §10.
