import type {
  PredictionAward,
  PredictionBestThird,
  PredictionGroupMatch,
  PredictionGroupStanding,
  PredictionKnockout,
} from '@/lib/db';

// Snapshot de todas las predicciones de un usuario. El server component las lee
// en una sola pasada y se las pasa al stepper, que reparte cada slice a su tab
// (skill add-prediction-type §"Lectura inicial del tab").
export type UserPredictions = {
  groupMatches: PredictionGroupMatch[];
  groupStandings: PredictionGroupStanding[];
  bestThirds: PredictionBestThird[];
  knockout: PredictionKnockout[];
  awards: PredictionAward[];
};

export const EMPTY_USER_PREDICTIONS: UserPredictions = {
  groupMatches: [],
  groupStandings: [],
  bestThirds: [],
  knockout: [],
  awards: [],
};
