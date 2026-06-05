# 0003 — Bracket rígido sin rebracket

**Fecha**: 2026-06-05
**Estado**: aceptada

## Contexto

En la porra el usuario predice **el ganador de cada cruce eliminatorio** (1/16 → final). Si falla un cruce de 1/16, el equipo que predijo para cuartos ya no existe en el bracket real. Hay dos formas de manejar esto:

- **Rebracket dinámico**: cuando un equipo del usuario "muere" antes de la ronda donde lo colocó, el motor "recoloca" al equipo real que sí avanzó y permite seguir puntuando.
- **Bracket rígido**: la predicción es literal. Si predijo que España gana cuartos pero España cayó en 1/16, ese cruce y todos los posteriores donde aparezca España no puntúan.

## Decisión

**Bracket rígido**. La predicción del usuario es literal y no se reinterpreta.

## Consecuencias

**Ganamos**:
- Implementación mucho más simple: no hay que mantener un "bracket sombra" por usuario.
- Reglas más fáciles de explicar a los jugadores ("acertaste el cruce o no acertaste").
- Penaliza más fallar en rondas tempranas, lo cual incentiva a pensar bien la fase de grupos y los primeros cruces. Bueno para el juego.
- Tests del motor de scoring drásticamente más simples.

**Perdemos**:
- Usuarios con un único fallo temprano sienten que "están out" del bracket entero, lo cual puede desmotivar a mitad del torneo.
- Diseño menos "generoso". Pero hay 6 categorías más donde sumar puntos (premios, podio, scores exactos, etc.), así que la motivación no depende solo del bracket.

## Alternativas consideradas

- **Rebracket completo**: el motor recoloca al ganador real en la posición predicha y recalcula los siguientes cruces. Complejidad alta (¿qué pasa si el usuario predijo al equipo real en la otra mitad del bracket?), reglas confusas para el jugador. Rechazado.
- **Rebracket parcial**: solo recolocas si el equipo real es el "rival lógico". Aún más confuso. Rechazado.
- **Bonus de consolación**: si fallas el cruce pero acertaste otro equipo en esa ronda, sumas la mitad. Posible mejora futura, pero no en v1. Pospuesto.

## Cómo se documenta al jugador

En la página del formulario (slice 4) habrá una nota visible al inicio del bracket: "Tu predicción es literal: si el equipo que pones en cuartos no llega a cuartos, ese cruce no puntúa."

## Reversibilidad

Reversible solo **antes** del inicio del torneo. Una vez empezado el Mundial, cambiar esta regla obligaría a recalcular todo el bracket de cada usuario, lo cual genera disputas. En el calendario del slice 1 se confirma que la regla se cierra antes del 11 de junio.
