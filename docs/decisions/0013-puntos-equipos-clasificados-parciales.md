# 0013 — Puntos de "Equipos clasificados por fase" se otorgan parcialmente

**Fecha**: 2026-06-26
**Estado**: aceptada

## Contexto

`docs/scoring-rules.md` §3.4 dice:

> "Por cada equipo que el jugador predijo y que efectivamente llega a una fase, **2 pts**."

Por-equipo, no por-conjunto. Conforme el torneo avanza y se confirman equipos, los puntos se otorgan de forma incremental.

El motor (`lib/scoring/index.ts`) tenía hasta hoy una lógica **all-or-nothing**: hasta que el set completo de una fase no estaba cerrado (ej. 32 equipos en `1/16` = 12 grupos cerrados + 8 mejores terceros), la categoría devolvía `null` y otorgaba **0 pts a todos los usuarios**.

Diagnosticado el 26-jun a media tarde, con 6 de 12 grupos cerrados (A-F):

- El Excel canónico del organizador da ya **20 pts** a Carlos por los equipos confirmados de A-F que coinciden con su predicción.
- La app daba **0 pts a todos** porque faltaban los grupos G-L.

La diferencia exacta entre el Excel y la app de cada jugador (entre −18 y −22 pts) coincide al céntimo con sus puntos de "Equipos 1/16" en el Excel. No había otra discrepancia.

## Decisión

El motor pasa a otorgar puntos **por-equipo** conforme se vayan confirmando, en línea con el reglamento:

1. `actualRoundOf32` (`lib/scoring/index.ts`) deja de devolver `null` si falta algún 1.º/2.º o mejor tercero. Devuelve la lista de los equipos **positivamente confirmados** hasta el momento.
2. Se elimina el bloque que reseteaba a `null` los `actual[phase]` cuyo tamaño no encajara con `PHASE_COUNTS`. Cada fase trabaja ya con su lista natural (parcial mientras la fase no haya terminado).
3. La semántica del `actual` de `TeamAdvancementInputs` queda documentada explícitamente: **conjunto incompleto = lista parcial confirmada, no `null`**. `null` solo se usa cuando no hay nada todavía confirmado en esa fase (caso defensivo, ya no producido por el orquestador).

Equipos cuya clasificación aún no se sabe (grupo abierto, mejor tercero sin calcular, cruce no jugado) **no se penalizan**: simplemente no aparecen en `actual`. Cuando se confirme su estado, el siguiente recálculo los incluirá y el jugador sumará.

Aplica a las **6 fases** (1/16, 1/8, cuartos, semi, 3-4, final), no solo a 1/16. La nueva semántica también beneficia a fases knockout parcialmente jugadas (ej. 4 de 8 cuartos disputados → ya se cuentan los 4 ganadores confirmados).

## Consecuencias

- **Ganado**: el motor cuadra con el Excel canónico durante todo el torneo, no solo al cierre de cada fase. El ranking refleja realidad parcial en lugar de quedarse en 0 hasta el siguiente hito.
- **Ganado**: monotonicidad — los puntos solo pueden subir conforme se confirman equipos, nunca bajar. Sin re-rebajadas al cerrar un grupo.
- **Perdido**: ninguna funcionalidad. El "all-or-nothing" anterior no estaba documentado ni justificado en ningún ADR. Lo introdujo la implementación inicial.
- **Recálculo retroactivo**: tras el deploy hay que disparar `recalculateAll` en el VPS para que `team_advancement` sume lo que toca. Solo escribe en `scores` y `score_recalculations`; no toca `predictions_*`.
- **Tests**: añadido caso de `actual` parcial en `lib/scoring/team-advancement.test.ts`. El test existente con `actual=null` se mantiene porque la función pura sigue aceptando ese caso defensivo.

## Alternativas consideradas

- **Mantener all-or-nothing y esperar al cierre completo de cada fase**. Descartada: contradice el reglamento literal ("por cada equipo"). Y produce un ranking que distorsiona la realidad durante la mitad del torneo. El Excel canónico (la fuente de verdad) puntúa parcialmente, así que la app debería también.

- **Puntuar parcial pero "previsionalmente" descontar al final si el equipo no clasifica**. Descartada: las reglas v2.0 no penalizan; solo premian aciertos. Y un score que sube y baja confunde al usuario.

- **Mostrar los puntos parciales en otro indicador ("provisional") y dejar el ranking oficial vacío hasta el cierre**. Descartada: complejidad innecesaria y diverge del Excel. La verdad es la del reglamento: por-equipo.
