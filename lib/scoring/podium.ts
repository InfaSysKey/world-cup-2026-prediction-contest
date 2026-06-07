// Motor de puntuación del cuadro de honor / podio (scoring-rules.md §3.5).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.
//
// Puntos (adicionales a los del bracket): campeón 20, subcampeón 12, tercero 8.
// Máximo 40 pts.

export type PodiumScore = {
  kind: 'champion' | 'runner_up' | 'third';
  points: number;
  hit: boolean;
};

export async function scoreUserPodium(userId: number): Promise<PodiumScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.5.
  return [];
}
