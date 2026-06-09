// Motor de puntuación del orden de cada grupo (scoring-rules.md §3.2).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.
//
// Puntos por grupo: acertar 1.º=4, 2.º=3, 3.º=2, 4.º=1, y bonus +5 si se clava
// el orden completo de los 4. Máximo por grupo 15; total 12 grupos = 180 pts.

export type GroupStandingScore = {
  groupLetter: string;
  // Puntos por posición acertada (sin contar el bonus).
  positionPoints: number;
  // +5 si las 4 posiciones del grupo son correctas, 0 en caso contrario.
  exactOrderBonus: number;
  points: number;
};

export async function scoreGroupStandings(
  userId: number,
): Promise<GroupStandingScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.2.
  return [];
}
