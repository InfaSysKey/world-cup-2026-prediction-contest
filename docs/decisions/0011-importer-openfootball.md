# 0011 — Importer automático de resultados desde openfootball/worldcup.json

**Fecha**: 2026-06-25
**Estado**: aceptada

## Contexto

A 25-jun-2026, con el Mundial en marcha y las 7 porras ya bloqueadas (lock global 11-jun), los marcadores oficiales solo entran a la app si el admin los introduce manualmente en `/admin/partidos`. La carga es pesada: 36 partidos de grupos ya jugados, 36 por jugar antes del 27-jun, y luego 32 cruces eliminatorios. Cada partido implica:

- Editar `matches.real_goles_local/visitante` + `real_winner_team_code` (knockouts).
- Cerrar `actual_group_standings` cuando un grupo termina (12 grupos).
- Cerrar `actual_best_thirds` cuando los 12 grupos están.
- Avanzar el bracket: rellenar `matches.home_team_code/away_team_code` de los 32 cruces conforme se van resolviendo standings, best thirds y resultados previos. Esta lógica de avance NO existe en código ni en UI.

El organizador (admin) pidió automatizar el proceso. Las opciones de API públicas se evaluaron (ver discusión):

- **openfootball/worldcup.json** — JSON canónico de dominio público en GitHub, sin auth, sin rate limits. Marcadores y goleadores. NO trae tarjetas. Latencia: lo actualizan los mantenedores tras los partidos.
- **API-Football** — Tiempo real, 100 req/día gratis, requiere API key.
- Servicios pagos (Sportmonks, TheStatsAPI) — overkill para 15 amigos.

## Decisión

Adoptamos **openfootball/worldcup.json** como fuente de resultados oficiales. La integración vive en `lib/results-importer/` y se ejecuta como **cron diario** en el VPS. Decisiones concretas:

1. **URL canónica**: `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`.
2. **Mapping de equipos** (`team-name-map.ts`): nombre EN de openfootball → `teams.code` FIFA 3-letras. 48 equipos + alias defensivos para variantes (Czechia, Türkiye, Côte d'Ivoire, etc.). Si un nombre no se reconoce, se skipea ese partido y se loguea.
3. **Mapping de rondas** (`round-map.ts`): "Matchday 1/2/3" → grupos; "Round of 32/16", "Quarter-finals", "Semi-finals", "Third-place playoff", "Final" → fases knockout.
4. **Match finder**: clave `(phase, home_team_code, away_team_code)`, tolerante a orden invertido (openfootball y nuestro seed no siempre coinciden en quién es local en knockouts).
5. **Knockouts sin teams resueltos**: se skipean con motivo `BRACKET_PENDING`. El bucle iterativo del orquestador los vuelve a intentar tras avanzar el bracket.
6. **Score updater**: para grupos usa `score.ft`; para knockouts usa `score.et` si presente (resultado al 120') y resuelve `winnerTeamCode` por mayoría de goles o, si empate al 120', por `score.p` (penaltis). Sin `score.p` y empate al 120' → skip (raro pero posible en openfootball).
7. **Tie-breaks FIFA**: implementados al pie de la letra hasta donde llegan los datos disponibles (puntos → GD → GF → head-to-head para clasificación de grupo). El paso 5 (disciplina por tarjetas) y el paso 6 (sorteo) NO son automatizables porque openfootball no trae tarjetas. Si el algoritmo llega ahí, marca el bloque empatado como "pendiente admin" y lo loguea sin escribir.
8. **Bracket advancer** (`advance-bracket.ts`): parsea `home_slot_ref`/`away_slot_ref` (formatos `1A`, `2L`, `3ABCDF`, `W74`, `L101`) y resuelve contra el estado actual. Solo escribe `home_team_code`/`away_team_code` cuando ambos lados resuelven; si uno está pendiente, se queda como está.
9. **Orquestador iterativo**: bucle de hasta 8 iteraciones (cota: grupos → standings → best thirds → 1/16 → octavos → cuartos → semis → final). En cada iteración aplica scores, auto-cierra standings, auto-cierra best thirds y avanza bracket. Si una iteración no cambia nada, termina.
10. **Recálculo**: al final, si hubo cualquier cambio, dispara `recalculateAll` (idempotente, fila de auditoría en `score_recalculations`). No usamos recálculos selectivos por escritura para evitar N×M ejecuciones cuando hay muchas escrituras en una sola corrida.
11. **Modo dry-run**: por defecto. El operador inspecciona el reporte estructurado y solo añade `--apply` cuando quiere escribir.
12. **Idempotencia**: relanzar el script sin cambios en openfootball no produce escrituras (cada paso compara antes de escribir).

## Consecuencias

**Ganamos**:

- El admin deja de meter marcadores a mano. Los 72 partidos de grupos + 32 knockouts entran solos vía cron diario.
- Standings y best thirds se cierran automáticamente cuando los datos lo permiten.
- El bracket se rellena solo. Eso desbloquea que `/admin/partidos` permita meter resultados knockout sin pasos manuales previos (hoy rechaza con `MATCH_NOT_RESOLVED` si `home_team_code` es null).
- Reproducibilidad: el report del importer dice exactamente qué pasó (aplicado, idem, skip, pendiente).

**Perdemos**:

- **Latencia**: openfootball se actualiza manualmente. Esperar uno o dos días tras un partido es normal. Para una porra entre 7 amigos no es problema.
- **Sin tarjetas**: si dos terceros empatan en pts/GD/GF y los 8 mejores se decide entre ellos, no podemos cerrar best thirds automáticamente. Esos casos quedan como "pendiente admin". En el Mundial 2026 real puede o no ocurrir.
- **Dependencia externa**: si openfootball desaparece o cambia el formato JSON, el cron rompe. Mitigación: el Zod schema `openfootballFileSchema` lanza con detalle si el JSON no encaja, y el cron exit code != 0 hace que el operador se entere.
- **Sin tests E2E contra openfootball real**: los tests unitarios cubren la lógica con fixtures pequeños; la primera corrida en VPS hará de smoke test.

## Alternativas consideradas

- **API-Football con cron horario**: tiempo real, pero suma una clave de API y rate limits que hay que gestionar. Para una porra entre 7 amigos donde el admin ya cerraba a mano por la noche, el delta de "tiempo real vs diario" no aporta valor real.
- **Solo CLI manual, sin cron**: el admin lanza `npm run results:import --apply` cuando quiere. Más control pero igualmente exige acordarse de hacerlo. El cron lo automatiza sin perder la opción de invocación manual.
- **Auto-resolver desempates por tarjetas con datos externos**: añadir una segunda fuente (e.g. ESPN, BBC) para tarjetas. Demasiado código para un caso de borde. La intervención manual del admin es aceptable.

## Impacto en `docs/`

- Nuevo `docs/results-importer.md` con guía de operación (no es la referencia canónica; este ADR lo es).
- Sin cambios en `docs/scoring-rules.md` (la puntuación no cambia; solo el origen de los resultados oficiales).
- Sin cambios en `docs/data-model.md` (no se crean tablas nuevas; se escriben las existentes).

## Impacto operativo

1. Merge del PR a `main`. Build local en VPS (CI sigue rota por el subdir, fixée pendiente).
2. Lanzar `npm run results:import` (dry-run) primero para revisar el reporte.
3. Si conforme, `npm run results:import -- --apply --reason "Carga inicial de la fase de grupos jugada"`.
4. Instalar el cron diario (ver `infra/scripts/cron-import-results.sh`) que ejecuta el comando con `--apply` cada noche a las 03:30 UTC (después de que openfootball haya tenido tiempo de absorber los partidos del día).
