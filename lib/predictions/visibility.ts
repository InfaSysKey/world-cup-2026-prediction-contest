import { loadAllLocks, type PredictionLocks } from '@/lib/scoring/locks';

import { loadUserPredictions } from '@/app/(porra)/porra/load-predictions';
import type { UserPredictions } from './types';

// Barrera de visibilidad entre jugadores (scoring-rules.md §8): la porra de OTRO
// usuario solo es pública en las categorías ya bloqueadas. Función PURA: entran
// las predicciones + el estado de bloqueo, sale una copia con las categorías no
// bloqueadas vaciadas. Es la línea que impide que una predicción abierta de otro
// jugador llegue al cliente; se aplica SIEMPRE en servidor.
export function filterVisiblePredictions(
  predictions: UserPredictions,
  locks: PredictionLocks,
): UserPredictions {
  return {
    groupMatches: locks.groupMatches ? predictions.groupMatches : [],
    groupStandings: locks.groupStandings ? predictions.groupStandings : [],
    bestThirds: locks.bestThirds ? predictions.bestThirds : [],
    knockout: locks.knockout ? predictions.knockout : [],
    awards: locks.awards ? predictions.awards : [],
  };
}

// Carga la porra de un usuario YA filtrada a lo público (§8). El llamador (la
// página de otro usuario) nunca debe usar loadUserPredictions directamente: esta
// es la única puerta que garantiza que no se filtra nada sin bloquear.
export async function loadVisiblePredictions(
  targetUserId: number,
  now: Date = new Date(),
): Promise<UserPredictions> {
  const predictions = await loadUserPredictions(targetUserId);
  const locks = loadAllLocks(now);
  return filterVisiblePredictions(predictions, locks);
}
