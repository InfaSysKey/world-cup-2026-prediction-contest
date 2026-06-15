# 0009 — La porra se puntúa exactamente como el Excel canónico

**Fecha**: 2026-06-15
**Estado**: aceptada

## Contexto

`docs/scoring-rules.md` v1.2 fue redactado al arrancar el proyecto a partir de
una lectura libre del Excel original (plantilla ExcelFutbol Mundial 2026) y de
conversaciones con el organizador del grupo. Durante el slice 1 nadie pasó por
la pestaña de "Reglas" del propio Excel, así que las cifras que documentamos
acabaron divergiendo del cuadro de puntos que el organizador publica a los
jugadores.

El 15-jun-2026, con el torneo ya en marcha (lock global activo desde el 11-jun)
y las 7 porras importadas, el organizador comparte la tabla literal del Excel —
primero como imagen y luego como JSON estructurado. Las divergencias respecto a
`scoring-rules.md` v1.2 son sustanciales:

1. **Knockouts**: el Excel **sí puntúa marcador y signo 1X2** en los 32 cruces
   eliminatorios (5 / 3 pts), no solo el ganador. Nuestro motor solo guardaba
   `winner_team_code` en `predictions_knockout` y daba 4/6/10/15/12/25 pts según
   la fase por acertar al ganador.
2. **Posiciones de grupo**: el Excel da 2/2/1/1 (1.ª–4.ª) sin bonus por orden
   completo. Nuestra doc daba 4/3/2/1 + 5 de bonus.
3. **Nueva categoría "Equipo clasificado para X"**: 2 pts por cada equipo que
   el jugador predijo y que efectivamente llega a esa fase. Inexistente en
   nuestra doc; suma hasta 128 pts a lo largo del torneo.
4. **Mejores terceros**: el Excel no los puntúa explícitamente. La predicción
   del ranking sigue siendo necesaria como input lógico para resolver el
   bracket (ADR 0003: bracket rígido) pero deja de generar puntos propios.
5. **Cuadro de honor**: 30 / 20 / 10 (no 20 / 12 / 8).
6. **Premios individuales**: 10/7/5 botas y 10/7/5 balones (no 15/8/5 y 12/6/4).
7. **Penalización por hueco**: el Excel no la lista. Se elimina la categoría
   `penalties`.
8. **"Diferencia/Distancia de goles (con 1X2 acertado)"**: regla listada en el
   Excel con **0 pts** — desactivada explícitamente por el organizador. No se
   implementa.

El cambio afecta al motor de scoring entero, al schema (`predictions_knockout`
necesita `goles_local` / `goles_visitante`), al importador desde Excel (hoy
descarta los goles de los cruces) y al estado en BD: las 7 porras ya
importadas tienen marcadores knockout disponibles en sus Excels pero no en BD.

## Decisión

Adoptamos la tabla del Excel como **fuente única de verdad** de la puntuación.
`docs/scoring-rules.md` se reescribe a **v2.0** reflejando exactamente ese JSON.
Decisiones concretas, todas confirmadas con el organizador:

- **Fase de grupos (por partido)**: 5 (exacto) / 3 (signo 1X2) / 0 (resto).
- **Clasificación de grupo**: 2/2/1/1 por posición acertada. Sin bonus.
- **Eliminatorias (por cruce)**: 5 (exacto) / 3 (signo 1X2) / 0 (resto). El
  "signo 1X2" y el "exacto" se evalúan sobre el **marcador al final de la
  prórroga (120')**, sin penaltis (convención FIFA y coincide con cómo
  `matches.real_goles_local/visitante` ya se describen en `data-model.md` §3.2).
- **Equipo clasificado para X**: 2 pts × equipo predicho que efectivamente
  llega a esa fase. Seis fases (1/16, octavos, cuartos, semis, 3-4, final).
  Máximo 128 pts. Se calcula como nueva categoría `team_advancement`.
- **Cuadro de honor**: 30 / 20 / 10.
- **Premios**: 10/7/5 cada terna (botas y balones).
- **Mejores terceros**: la predicción se mantiene como input para resolver el
  bracket; no genera puntos propios; la categoría `best_thirds` desaparece de
  `scores.category`.
- **Penalización −1 por hueco**: eliminada. La categoría `penalties` desaparece
  de `scores.category`.

Máximo total bajo v2.0: **824 pts** (frente a los 878 de v1.2).

## Consecuencias

**Ganamos**:

- Coincidencia 1:1 con el Excel que el organizador comparte con los jugadores.
  Cualquier jugador puede pegar su porra al Excel y obtener los mismos puntos
  que nuestra app.
- Categorías de scoring más limpias: pasamos de 7 a **6** (`group_matches`,
  `group_standings`, `bracket`, `team_advancement`, `podium`, `awards`).
- El sistema premia tanto la lectura del cruce (1X2/exacto) como la quiniela
  del bracket (qué equipos avanzan), separando los dos ejes.

**Perdemos**:

- **Recálculo retroactivo completo**. Todas las filas de `scores` se invalidan;
  los 7 usuarios necesitan recalcularse contra la nueva tabla. Queda registro
  en `score_recalculations` con motivo "Adopción reglas v2.0 (ADR 0009)".
- **Re-importación de las 7 porras**: el importer hoy descarta los goles de
  los cruces. Hay que aplicar el importer corregido a los 7 Excels en
  `porras-excel/` para rellenar `predictions_knockout.goles_local/visitante`.
- **UI bracket sigue read-only**. El lock global está activo desde el 11-jun.
  No reabrimos inputs; los marcadores knockout que falten en BD para usuarios
  que no tengan Excel disponible quedan a `null` (no aplica al grupo actual:
  los 7 vinieron de Excel).
- Migración SQL nueva (0002): `predictions_knockout` añade dos columnas
  nullable; la nullabilidad refleja el hueco temporal entre la migración y la
  re-importación, no es estado permanente.

## Alternativas consideradas

- **Mantener la doc tal cual y avisar a los jugadores del desfase**: rompe el
  contrato "lo que ves en tu Excel es lo que cuenta en la app". Rechazada: el
  Excel manda.
- **Adoptar solo los cambios de podio y premios, sin reescribir el motor de
  knockouts**: deja la mitad del trabajo hecha y crea la ilusión de paridad
  con el Excel. Rechazada por ser un parche.
- **Diferencia/Distancia de goles con 1X2 acertado = 1 (en vez del 0 del
  Excel)**: meter una bonificación intermedia entre 1X2 (3) y exacto (5).
  Atractivo, pero el Excel deja explícitamente la regla a 0 — el organizador
  ya la valoró y la dejó fuera. Rechazada por respeto a la fuente canónica.

## Impacto en `scoring-rules.md`

Documento completo a **v2.0**: §3 reescrito, §3.3 (mejores terceros) eliminado,
§3.7 (equipos clasificados por fase) nuevo, §4 (penalización) reformulado como
"ya no aplica", §3.4 y §3.5 con valores nuevos. Changelog con entrada v2.0.

## Impacto en `data-model.md`

Bumpe a **v1.1**: §4.4 añade `goles_local` y `goles_visitante` a
`predictions_knockout` (smallint, nullable, CHECK 0–20). §5.4 actualiza
`SCORE_CATEGORIES` a la nueva lista de 6.

## Impacto operativo

Recálculo registrado en `score_recalculations` con un único disparador admin,
`affected_categories` = las 6 categorías nuevas, snapshot de posiciones para el
delta ▲/▼ del ranking (slice 10).
