// Motor de puntuación de los premios individuales (scoring-rules.md §3.6).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.
//
// Puntos: bota oro 15, plata 8, bronce 5; balón oro 12, plata 6, bronce 4.
// Máximo 50 pts. Separado de podium.ts (single responsibility).

export type AwardScore = {
  kind:
    | 'boot_gold'
    | 'boot_silver'
    | 'boot_bronze'
    | 'ball_gold'
    | 'ball_silver'
    | 'ball_bronze';
  points: number;
  hit: boolean;
};

export async function scoreUserAwards(userId: number): Promise<AwardScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.6.
  return [];
}
