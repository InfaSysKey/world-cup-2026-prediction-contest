// Motor de puntuación de los marcadores de fase de grupos (scoring-rules.md §3.1).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.

export type GroupMatchScoreReason =
  | 'exact'
  | 'result'
  | 'one_goal'
  | 'wrong'
  | 'empty';

export type GroupMatchScore = {
  matchId: number;
  points: number;
  reason: GroupMatchScoreReason;
};

export async function scoreGroupMatches(
  userId: number,
): Promise<GroupMatchScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.1.
  return [];
}
