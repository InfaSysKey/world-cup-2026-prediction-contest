import { eq } from 'drizzle-orm';

import {
  db,
  predictionsAwards,
  predictionsBestThirds,
  predictionsGroupMatches,
  predictionsGroupStandings,
  predictionsKnockout,
} from '@/lib/db';
import type { UserPredictions } from '@/lib/predictions/types';

// Lee de una sola pasada todas las predicciones del usuario para alimentar el
// stepper (skill add-prediction-type §"Lectura inicial del tab"). El userId
// viene de la sesión, nunca del cliente.
export async function loadUserPredictions(
  userId: number,
): Promise<UserPredictions> {
  const [groupMatches, groupStandings, bestThirds, knockout, awards] =
    await Promise.all([
      db
        .select()
        .from(predictionsGroupMatches)
        .where(eq(predictionsGroupMatches.userId, userId)),
      db
        .select()
        .from(predictionsGroupStandings)
        .where(eq(predictionsGroupStandings.userId, userId)),
      db
        .select()
        .from(predictionsBestThirds)
        .where(eq(predictionsBestThirds.userId, userId)),
      db
        .select()
        .from(predictionsKnockout)
        .where(eq(predictionsKnockout.userId, userId)),
      db
        .select()
        .from(predictionsAwards)
        .where(eq(predictionsAwards.userId, userId)),
    ]);

  return { groupMatches, groupStandings, bestThirds, knockout, awards };
}
