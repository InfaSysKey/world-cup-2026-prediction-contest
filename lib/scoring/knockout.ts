// Motor de puntuación del bracket eliminatorio (scoring-rules.md §3.4).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.
//
// Puntos por acertar el ganador de un cruce: 1/16 → 4, 1/8 → 6, cuartos → 10,
// semis → 15, 3.º/4.º puesto → 12, final → 25. Máximo 219 pts. Bracket RÍGIDO
// (ADR 0003): el acierto solo cuenta si el equipo predicho jugó realmente ese
// cruce y lo ganó.

import type { Phase } from '@/lib/db';

export type KnockoutScore = {
  matchId: number;
  phase: Phase;
  points: number;
  hit: boolean;
};

export async function scoreKnockout(userId: number): Promise<KnockoutScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.4.
  return [];
}
