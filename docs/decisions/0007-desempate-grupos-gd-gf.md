# 0007 — Desempate del orden de grupo por la cadena puntos → GD → GF

**Fecha**: 2026-06-10
**Estado**: aceptada

## Contexto

En el tab "Grupos" del formulario de porra, al predecir el orden 1.º–4.º de cada
grupo (§2.2), la app detecta cuándo los marcadores predichos dejan equipos
"empatados" y pide al jugador que los ordene a mano (§2.3).

La implementación inicial (`lib/scoring/group-table.ts`) consideraba empate
**solo la igualdad de puntos**. Esto producía dos problemas de UX:

1. Marcaba como "empatados" equipos que en realidad el reglamento ya separa por
   diferencia de goles o goles a favor. El jugador veía un desempate que no
   existía y el texto afirmaba "tus marcadores empatan a puntos" cuando el orden
   ya estaba determinado.
2. La redacción de §2.3 ("empates **a puntos**") contradecía su propia frase
   siguiente ("empate **matemático**"): en fútbol el empate matemático no es solo
   por puntos, sino por la cadena puntos → diferencia de goles → goles a favor
   (los tres primeros criterios FIFA sobre el total de partidos del grupo).

## Decisión

El motor detecta empate de orden de grupo **solo entre equipos iguales en los
tres criterios, en orden**:

1. **Puntos** (3 victoria / 1 empate / 0 derrota).
2. **Diferencia de goles** (GF − GC) sobre todos los partidos del grupo.
3. **Goles a favor** (GF) sobre todos los partidos del grupo.

Dos equipos con los mismos puntos pero distinta diferencia de goles **no** están
empatados; si coinciden en puntos y diferencia pero difieren en goles a favor,
tampoco. Solo los iguales en los tres entran al bloque de desempate.

Condiciones de presentación (sin cambios respecto a lo ya implementado, se
consolidan aquí):

- El empate **solo se calcula con el grupo completo** (los 6 marcadores
  rellenados). Un grupo a medias produce puntos parciales y no se ofrece
  desempate.
- La resolución vive en la **propia lista de orden del grupo**: las filas
  empatadas se resaltan y el jugador las ordena ahí. No hay un segundo control
  arrastrable (era redundante con la lista principal, que ya es la fuente de
  verdad del orden predicho).

`computeGroupPoints` pasa a devolver, por equipo, `points`, `goalsFor`,
`goalsAgainst` y `goalDifference`; `findTiedBlocks` agrupa por la clave compuesta
`(puntos, diferencia, goles a favor)` y ordena los bloques por esa misma cadena.

## Consecuencias

**Ganamos**:

- El formulario solo pide desempates reales: los casos "empate solo por puntos"
  desaparecen, que eran la inmensa mayoría de falsos empates.
- Coherencia con los criterios de clasificación reales del torneo, que el motor
  de scoring (slice 5) reutilizará al clasificar los grupos oficiales.
- Una sola fuente de verdad del orden de grupo (la lista principal), sin control
  duplicado.

**Perdemos**:

- Nada de puntuación: **no cambia ningún punto otorgado**, solo qué sub-órdenes
  se piden a mano. No hay recálculo retroactivo que registrar (no hay torneo
  jugado y el desempate manual no puntúa por sí mismo; afecta al orden que luego
  evalúa §3.2).

## Alternativas consideradas

- **Mantener solo-puntos y ocultar el desempate con texto más suave**: no
  resuelve el fondo (seguiría pidiendo órdenes ya determinados por GD/GF).
  Rechazada.
- **Head-to-head como primer criterio (estilo UEFA)**: el reglamento del torneo
  y el Excel original ordenan por GD/GF global; añadir head-to-head complica el
  motor sin reflejar la fuente. Descartada para el MVP.

## Impacto en `scoring-rules.md`

Se aclara §2.3 (el empate se evalúa por la cadena puntos → GD → GF y solo con el
grupo completo) y se bumpea el documento a **v1.2** con su entrada de changelog
en §10.
