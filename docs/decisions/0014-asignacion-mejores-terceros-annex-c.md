# 0014 — Asignación de mejores terceros sigue Annex C de FIFA

**Fecha**: 2026-06-28
**Estado**: aceptada

## Contexto

`lib/results-importer/advance-bracket.ts` resolvía los slots de tipo `3XYZW...` (mejor tercero cuyo grupo está en {X,Y,Z,W,...}) con un **greedy single-pass**: iteraba por posición 1..8 de `actual_best_thirds` y devolvía el primer tercero cuyo grupo encajara en el set. El comentario asumía:

> "Asumimos que solo UN tercero clasificado tiene su grupo en ese set (la FIFA define los 8 paquetes para que sea así)."

**Esa asunción es falsa.** Los 8 cruces que enfrentan a un ganador de grupo contra un mejor tercero tienen slot_refs solapados (ej. cruce 74 = `3ABCDF`, cruce 81 = `3BEFIJ`). Cuando los 8 terceros reales vienen de 8 grupos concretos, hay varios matchings perfectos posibles entre cruces y terceros. El greedy elige siempre el primero (por position), asignando el **mismo equipo a varios cruces**.

Detectado el 28-jun en producción: Suecia aparecía como visitante en 5 cruces de 1/16 (matches 74, 77, 79, 81, 85), Ecuador en 2. La UI de `/partidos` mostraba esos cruces duplicados.

Investigando la regla oficial:

- FIFA publica en **Annex C del Reglamento WC 2026** la tabla con las **495 combinaciones** posibles de C(12,8) (grupos que aportan tercero) y la asignación canónica a cada uno de los 8 cruces.
- La asignación NO es derivable algorítmicamente. Ni un greedy, ni un matching bipartito puro coinciden con FIFA en el caso general — pueden existir múltiples matchings perfectos válidos y FIFA elige UNO concreto.
- Confirmado contra Wikipedia ([2026 FIFA World Cup knockout stage](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage)) para la combinación real del Mundial actual: grupos B, D, E, F, I, J, K, L → asignación específica de 8 cruces.

## Decisión

1. **Nuevo archivo** `lib/results-importer/best-thirds-allocation.ts` con una tabla `ANNEX_C: Record<combinationKey, Record<slotRef, group>>`. Para el alcance de este Mundial, hardcodear **solo la entrada correspondiente a la combinación real `BDEFIJKL`** (8 cruces × 1 línea). Si por descalificación retroactiva o cambio administrativo apareciera otra combinación, el lookup devolverá null y el orquestador reportará `THIRDS_COMBINATION_UNKNOWN` con la clave observada en el detalle, y se añade aquí la nueva entrada (1 fila).

2. **Refactor** `lib/results-importer/advance-bracket.ts`:
   - El brazo de `resolveSlotRef` para slot `3XYZ...` deja de hacer greedy single-pass.
   - Construye la combinación canónica (`buildCombinationKey`) a partir de los grupos representados en `actual_best_thirds`.
   - Hace lookup en Annex C (`lookupBestThirdGroupForSlot`) para obtener el grupo asignado al cruce.
   - Devuelve el tercero cuyo grupo coincide con el asignado.
   - Nueva razón de pending: `THIRDS_COMBINATION_UNKNOWN`.

3. **Reset puntual de BD**: 5 cruces de 1/16 (matches 74, 79, 81, 82, 85) tienen `away_team_code` incorrecto en producción (los otros 3 cruces afectados — 77, 80, 87 — quedaron bien por casualidad). UPDATE SQL manual para corregirlos. **`predictions_*` no se tocan**.

4. La tabla cubre solo los cruces que enfrentan ganador-vs-tercero. Los cruces que enfrentan 1.º vs 2.º o 2.º vs 2.º (8 de los 16) no usan Annex C — siguen resolviéndose por `1X` / `2X` directos.

## Consecuencias

- **Ganado**: la UI de partidos y los puntos por knockout (cuando se jueguen los partidos) usan los cruces correctos. La porra cuadra con la realidad FIFA.
- **Ganado**: monotonicidad — la asignación es determinista y no cambia con re-corridas.
- **Perdido**: dependencia de mantener la tabla. Si en un futuro Mundial cambia la regla o hay otra combinación, hay que añadir entradas.
- **Limitado**: el código solo cubre la combinación real de este Mundial. Si surgiera otra (improbable: los terceros ya están cerrados), el importer lo reporta y se añade. No es un bug.
- **Tests**: nuevo test que verifica los 8 cruces de la combinación real. Tests de "combinación parcial" y "combinación desconocida" cubren los casos degradados.
- **Recálculo retroactivo**: tras el UPDATE manual, ejecutar `npm run scores:recalc-all` para que las categorías afectadas (bracket, team_advancement) usen los cruces correctos. Solo escribe `scores` + `score_recalculations`; predicciones intactas.

## Alternativas consideradas

- **Greedy por position (intento previo)**: iterar 1..8 y asignar al primer cruce libre que acepte. Probado contra la combinación real: 3 de 8 cruces coinciden con FIFA por casualidad, 5 mal. Es DETERMINISTA pero NO coincide con Annex C. Descartado.

- **Matching bipartito completo** (Hungarian o backtracking): garantiza encontrar UN matching perfecto si existe. Pero como múltiples matchings perfectos pueden ser válidos, FIFA fija la elección — un algoritmo "neutral" puede devolver una asignación legal pero distinta de la oficial. No resuelve el problema.

- **Embeber las 495 entradas de Annex C** desde el PDF oficial: lo correcto a largo plazo. Descartado por ahora por coste (parseo de PDF, mantenimiento) frente al beneficio (solo aplica a este Mundial y no veremos otra combinación porque ya están cerrados los terceros). Si el código se reutiliza en otra edición, añadir.

- **Resolver desde la app a mano**: el admin meter los cruces de 1/16 vía panel admin manualmente. Posible pero anti-ergonómico y deja el importer roto para corridas futuras.
