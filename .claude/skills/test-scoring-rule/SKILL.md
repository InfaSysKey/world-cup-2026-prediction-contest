---
name: test-scoring-rule
description: Use this skill when adding or modifying any scoring logic in lib/scoring/. Triggers when the user mentions the scoring engine, points calculation, scoring rules, penalties, the calculateUserScore function, or anything that computes points from predictions vs official results.
---

# test-scoring-rule

El motor de puntuación es la pieza más crítica del proyecto: si calcula mal, toda la clasificación pierde sentido y los 15 jugadores pierden la confianza. Esta skill impone **TDD estricto** y define los casos canónicos que cada regla debe pasar.

## Principio innegociable: test antes que código

Para CADA función de scoring:

1. Lee la sección correspondiente de `docs/scoring-rules.md`.
2. Escribe los tests PRIMERO, derivados de la doc, NO de tu implementación imaginada.
3. Corre los tests → todos en rojo (porque no hay código aún).
4. Escribe el código mínimo para pasarlos.
5. Refactoriza con los tests en verde.

**Anti-pattern fatal**: escribir el código primero y luego tests que validan lo que el código hace. Eso valida la implementación contra sí misma, no contra las reglas. Si te descubres haciéndolo, borra y empieza por el test.

## Fuente de verdad

`docs/scoring-rules.md` §3 (puntuación) y §4 (penalizaciones). Cada número de punto sale de ahí. Si un test necesita un valor que no está en la doc, PARA: o la doc está incompleta (actualízala con un ADR) o estás inventando.

## Ubicación y naming

- Tests unitarios junto al código: `lib/scoring/group-matches.ts` → `lib/scoring/group-matches.test.ts`.
- Test de integración del orquestador: `lib/scoring/index.test.ts`.
- Fixtures compartidos: `lib/scoring/__fixtures__/` (predicciones de ejemplo + resultados oficiales + scores esperados).

## Formato de fixture

Cada caso es una tripleta explícita: **predicción del usuario + resultado oficial → puntos esperados**. Nunca derivar el esperado con la misma lógica que se testea.

```typescript
// lib/scoring/__fixtures__/group-matches.ts
export const cases = [
  {
    name: 'marcador exacto',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official:   { golesLocal: 2, golesVisitante: 1 },
    expected:   { points: 5, reason: 'exact' },
  },
  {
    name: 'resultado correcto, marcador erróneo',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official:   { golesLocal: 3, golesVisitante: 1 },
    expected:   { points: 3, reason: 'result' },
  },
  // ...
];
```

El esperado se calcula **a mano** leyendo la doc, y se escribe literal en el fixture. Es la red de seguridad.

## Casos canónicos obligatorios por categoría

Cada función de scoring debe cubrir AL MENOS estos casos (derivados de `scoring-rules.md`):

### group-matches (§3.1) — v2.0
- ✅ Marcador exacto → 5 pts, reason 'exact'.
- ✅ Acierto del signo 1X2 (mismo ganador o empate), marcador no exacto → 3 pts, reason 'result'.
- ✅ Empate predicho + empate real, marcador distinto (1-1 vs 2-2) → 3 pts, reason 'result'.
- ✅ Fallo de 1X2 (incluso si aciertas los goles de un equipo) → 0 pts, reason 'wrong'.
- ✅ Predicción vacía → 0 pts (v2.0 no penaliza), reason 'empty'.
- ✅ Partido cancelado (§6.1) → 0 pts, reason 'cancelled'.

### group-standings (§3.2) — v2.0
- ✅ Acertar 1.º → 2 pts; 2.º → 2; 3.º → 1; 4.º → 1.
- ✅ Sin bonus por clavar el orden completo (el Excel no lo lista). Máximo por grupo = 6.
- ✅ Orden parcial: suma solo los aciertos.
- ✅ Posición vacía → 0 pts (v2.0 no penaliza), se reporta emptyPositions para el banner.

### bracket (knockout marcador, §3.3) — v2.0
- ✅ Marcador exacto al 120' (90'+prórroga, sin penaltis) → 5 pts, reason 'exact'.
- ✅ Acierto del signo 1X2 al 120', marcador no exacto → 3 pts, reason 'result'.
- ✅ Empate al 120' decidido en penaltis: el 1X2 oficial es "empate", no "gana X". Si el usuario predijo empate, acierta 1X2; si predijo a uno ganando, no.
- ✅ Fallo de 1X2 → 0 pts.
- ✅ Predicción vacía / cruce cancelado (§6.1) → 0 pts.

### team-advancement (§3.4) — v2.0
- ✅ 2 pts × cada equipo predicho que efectivamente llega a esa fase. 6 fases (1/16, 1/8, cuartos, semi, 3-4, final).
- ✅ Bracket RÍGIDO (ADR 0003): si el equipo predicho como ganador de 1/16 cayó antes en su grupo, no aparece en `actual['1/16']` y no puntúa. Sin rebracket. Test explícito.
- ✅ Una fase con `actual: null` (no cerrada todavía) → 0 hits, 0 pts.
- ✅ Predicción con duplicados → cada equipo cuenta una sola vez.
- ✅ Máximo total = 32+16+8+4+2+2 = 64 aciertos × 2 = 128 pts.

### podium (§3.5) — v2.0
- ✅ Campeón acertado → 30; subcampeón → 20; 3.º → 10.
- ✅ Son ADICIONALES a los puntos del bracket y de team_advancement. Test que verifica que marcador exacto en final (5) + campeón (30) = 35.

### awards (§3.6) — v2.0
- ✅ Bota oro=10, plata=7, bronce=5; balón oro=10, plata=7, bronce=5.
- ✅ Match de nombre de jugador case-insensitive + trim + sin tildes (decisión de 4.7).
- ✅ Jugador retirado/no participa (§6.6) → 0 pts.
- ✅ Premio vacío → 0 pts.

### Sin categoría `penalties` ni `best_thirds` en v2.0
- ❌ La penalización −1 por hueco se eliminó (ADR 0009): los vacíos valen 0 en todas las categorías.
- ❌ Mejores terceros dejaron de generar categoría propia: la predicción del ranking se conserva como input para `resolve-bracket.ts`, sin puntos.

## Tests transversales obligatorios

### Idempotencia (crítico)

`calculateUserScore(userId)` ejecutado dos veces seguidas deja la BD EXACTAMENTE igual. Test:

```typescript
it('es idempotente', async () => {
  await calculateUserScore(userId);
  const first = await db.select().from(scores).where(eq(scores.userId, userId));
  await calculateUserScore(userId);
  const second = await db.select().from(scores).where(eq(scores.userId, userId));
  expect(second).toEqual(first);
});
```

### Recálculo selectivo

Editar UN resultado de partido recalcula solo las categorías afectadas, no todo. Test que verifica que `recalculateAfterResultChange(matchId)` no toca filas de `scores` de categorías no relacionadas.

### Test de integración con desglose

Dado un usuario con porra conocida + resultados oficiales conocidos, el desglose en `scores` (una fila por categoría) coincide con una tabla calculada a mano en el test. Este es el test que da confianza de que el total es correcto.

### Ranking y desempates (§7 v2.0)

Tests de los 7 criterios de desempate en orden + sorteo (§7.8):
1. exactGroupMatches
2. exactKnockoutMatches
3. teamAdvancementHits
4. championHit
5. runnerUpHit
6. thirdHit
7. awardHits

Casos de empate construidos a propósito; los empatados genuinos comparten rango y `needsDraw=true`.

## Anti-patterns (rechazar al revisar)

- ❌ Test escrito después del código que valida la implementación, no la doc.
- ❌ Esperado calculado con la misma función que se testea (circular).
- ❌ Función de scoring que toca BD directamente (deben ser puras: entran datos, salen puntos; la persistencia la hace el orquestador).
- ❌ Número de puntos hardcodeado en el código sin constante nombrada que referencie `scoring-rules.md`.
- ❌ Falta el test de idempotencia.
- ❌ Falta el test de bracket rígido (es la regla más fácil de implementar mal).
- ❌ Penalización aplicada en cualquier categoría (v2.0 ya no penaliza huecos).
- ❌ Cambiar un valor de puntos sin actualizar `scoring-rules.md` + bump de versión + ADR.
