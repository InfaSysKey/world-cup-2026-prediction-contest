import { requireEnv } from '@/lib/env';

// Bloqueo temporal de predicciones (scoring-rules.md §5).
//
// MVP: toda la porra se bloquea a la vez al pitido inicial del partido
// inaugural (TOURNAMENT_START_AT). El bloqueo granular por bloque (cada partido,
// cada grupo, cada cruce) llega en una iteración posterior; por eso las
// funciones por categoría delegan de momento en el lock global. Cuando ese
// bloqueo granular consulte la BD, estas firmas pasarán a ser async.
//
// Funciones puras: reciben `now` para poder testearlas con una fecha fija.

export function tournamentStartAt(): Date {
  return new Date(requireEnv('TOURNAMENT_START_AT'));
}

export function isGlobalPredictionLocked(now: Date = new Date()): boolean {
  return now.getTime() >= tournamentStartAt().getTime();
}

export function isGroupMatchPredictionLocked(now?: Date): boolean {
  return isGlobalPredictionLocked(now);
}

export function isGroupStandingsLocked(now?: Date): boolean {
  return isGlobalPredictionLocked(now);
}

export function isBestThirdsLocked(now?: Date): boolean {
  return isGlobalPredictionLocked(now);
}

export function isKnockoutLocked(now?: Date): boolean {
  return isGlobalPredictionLocked(now);
}

// Cuadro de honor y premios: bloqueo al pitido inicial de la final
// (scoring-rules.md §5). En el MVP delega en el bloqueo global como el resto.
export function isAwardsPredictionLocked(now?: Date): boolean {
  return isGlobalPredictionLocked(now);
}

export type PredictionLocks = {
  groupMatches: boolean;
  groupStandings: boolean;
  bestThirds: boolean;
  knockout: boolean;
  awards: boolean;
};

// Calcula el estado de bloqueo de todas las categorías de una vez, para que el
// server component lo pase al stepper sin recomputarlo por tab.
export function loadAllLocks(now: Date = new Date()): PredictionLocks {
  return {
    groupMatches: isGroupMatchPredictionLocked(now),
    groupStandings: isGroupStandingsLocked(now),
    bestThirds: isBestThirdsLocked(now),
    knockout: isKnockoutLocked(now),
    awards: isAwardsPredictionLocked(now),
  };
}
