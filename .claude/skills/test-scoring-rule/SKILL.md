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

### group-matches (§3.1)
- ✅ Marcador exacto → 5 pts, reason 'exact'.
- ✅ Resultado correcto (mismo ganador), marcador erróneo → 3 pts, reason 'result'.
- ✅ Empate predicho + empate real, marcador distinto (1-1 vs 2-2) → 3 pts, reason 'result'.
- ✅ Solo aciertas goles de UN equipo (2-1 vs 2-0) → 1 pt, reason 'one_goal'.
- ✅ Fallo total (2-1 vs 0-3) → 0 pts, reason 'wrong'.
- ✅ Predicción vacía → -1 pt (penalización §4), reason 'empty'.
- ✅ Partido cancelado (§6.1) → 0 pts, sin penalización, reason 'cancelled'.

### group-standings (§3.2)
- ✅ Acertar 1.º → 4 pts; 2.º → 3; 3.º → 2; 4.º → 1.
- ✅ Orden completo de los 4 clavado → +5 bonus (total 15 en ese grupo).
- ✅ Orden parcial (2 de 4 bien) → suma solo los aciertos, sin bonus.
- ✅ Posición vacía → penalización §4 por hueco.

### best-thirds (§3.3)
- ✅ Cada tercero acertado (sin importar orden interno) → 3 pts.
- ✅ Los 8 en orden exacto → +5 bonus (total 29).
- ✅ 5 de 8 aciertos sin orden → 15 pts, sin bonus.
- ✅ Selección vacía → penalización §4.

### bracket (§3.4)
- ✅ Acierto por fase con sus puntos: 1/16=4, 1/8=6, cuartos=10, semi=15, 3-4=12, final=25.
- ✅ Bracket RÍGIDO (ADR 0003): si el equipo predicho como ganador de cuartos quedó eliminado en 1/16 real, ese cruce NO puntúa (0 pts), aunque el equipo "correcto" hubiera ganado. Test explícito de esto.
- ✅ Cruce vacío → 0 pts (sin penalización en bracket, §4).

### podium (§3.5)
- ✅ Campeón acertado → 20; subcampeón → 12; 3.º → 8.
- ✅ Son ADICIONALES a los puntos del bracket (no se solapan). Test que verifica que acertar la final da 25 (bracket) + 20 (podio champion) = 45.

### awards (§3.6)
- ✅ Bota oro=15, plata=8, bronce=5; balón oro=12, plata=6, bronce=4.
- ✅ Match de nombre de jugador case-insensitive + trim + sin tildes (decisión de 4.7).
- ✅ Jugador retirado/no participa (§6.6) → 0 pts, sin penalización.
- ✅ Premio vacío → 0 pts (sin penalización, §4).

### penalties (§4)
- ✅ Por cada predicción vacía en categorías 3.1–3.3 → -1 pt.
- ✅ Vacíos en bracket/podio/premios → 0 pts, NO penalización adicional.

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

### Ranking y desempates (§7)

Tests de los 8 criterios de desempate en orden, con casos de empate construidos a propósito.

## Anti-patterns (rechazar al revisar)

- ❌ Test escrito después del código que valida la implementación, no la doc.
- ❌ Esperado calculado con la misma función que se testea (circular).
- ❌ Función de scoring que toca BD directamente (deben ser puras: entran datos, salen puntos; la persistencia la hace el orquestador).
- ❌ Número de puntos hardcodeado en el código sin constante nombrada que referencie `scoring-rules.md`.
- ❌ Falta el test de idempotencia.
- ❌ Falta el test de bracket rígido (es la regla más fácil de implementar mal).
- ❌ Penalización aplicada en categorías donde §4 dice que no (bracket/podio/premios).
- ❌ Cambiar un valor de puntos sin actualizar `scoring-rules.md` + bump de versión + ADR.
