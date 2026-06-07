// Motor de puntuación de los mejores terceros (scoring-rules.md §3.3).
// El cuerpo se implementa en el slice 5; aquí solo fijamos la firma para que el
// resto del sistema pueda tipar contra ella.
//
// Puntos: 3 por cada selección acertada entre los 8 mejores terceros (sin
// importar el orden interno) + bonus +5 si se clavan los 8 en el orden exacto.
// Máximo 8×3 + 5 = 29 pts.

export type BestThirdsScore = {
  // Selecciones acertadas (equipos que sí están entre los 8 reales).
  hits: number;
  hitPoints: number;
  // +5 si las 8 posiciones coinciden con el orden oficial, 0 en caso contrario.
  exactOrderBonus: number;
  points: number;
};

export async function scoreBestThirds(
  userId: number,
): Promise<BestThirdsScore[]> {
  void userId;
  // TODO(slice-5): aplicar scoring-rules.md §3.3.
  return [];
}
