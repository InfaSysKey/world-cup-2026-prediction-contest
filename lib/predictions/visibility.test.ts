import { describe, expect, it } from 'vitest';

import type { PredictionLocks } from '@/lib/scoring/locks';

import { filterVisiblePredictions } from './visibility';
import type { UserPredictions } from './types';

// Visibilidad de predicciones entre jugadores (scoring-rules.md §8). PUNTO DE
// FUGA: una predicción NO bloqueada de otro jugador no puede salir nunca del
// servidor. filterVisiblePredictions es la barrera pura; el loader la aplica
// antes de mandar nada al cliente.
//
// El esperado se razona desde §8 (solo lo bloqueado es público), no del código.

// Predicciones de muestra, una entrada por categoría (contenido irrelevante: lo
// que importa es si la categoría sobrevive al filtro o no).
const SAMPLE: UserPredictions = {
  groupMatches: [
    {
      id: 1,
      userId: 9,
      matchId: 1,
      golesLocal: 2,
      golesVisitante: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  groupStandings: [
    {
      id: 1,
      userId: 9,
      groupLetter: 'A',
      position: 1,
      teamCode: 'ESP',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  bestThirds: [
    {
      id: 1,
      userId: 9,
      position: 1,
      teamCode: 'MEX',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  knockout: [
    {
      id: 1,
      userId: 9,
      matchId: 73,
      winnerTeamCode: 'BRA',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  awards: [
    {
      id: 1,
      userId: 9,
      kind: 'champion',
      teamCode: 'ARG',
      playerName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

const ALL_LOCKED: PredictionLocks = {
  groupMatches: true,
  groupStandings: true,
  bestThirds: true,
  knockout: true,
  awards: true,
};

const NONE_LOCKED: PredictionLocks = {
  groupMatches: false,
  groupStandings: false,
  bestThirds: false,
  knockout: false,
  awards: false,
};

describe('filterVisiblePredictions (§8)', () => {
  it('todo bloqueado → todas las predicciones son visibles', () => {
    expect(filterVisiblePredictions(SAMPLE, ALL_LOCKED)).toEqual(SAMPLE);
  });

  it('nada bloqueado → ninguna predicción sale (todas las categorías vacías)', () => {
    expect(filterVisiblePredictions(SAMPLE, NONE_LOCKED)).toEqual({
      groupMatches: [],
      groupStandings: [],
      bestThirds: [],
      knockout: [],
      awards: [],
    });
  });

  it('una categoría sin bloquear NUNCA aparece, aunque el resto sí', () => {
    const locks: PredictionLocks = { ...ALL_LOCKED, knockout: false };
    const result = filterVisiblePredictions(SAMPLE, locks);
    expect(result.knockout).toEqual([]);
    // El resto sigue visible.
    expect(result.groupMatches).toEqual(SAMPLE.groupMatches);
    expect(result.awards).toEqual(SAMPLE.awards);
  });

  it('bloqueo parcial inverso: solo lo bloqueado pasa, lo demás se vacía', () => {
    const locks: PredictionLocks = { ...NONE_LOCKED, groupMatches: true };
    const result = filterVisiblePredictions(SAMPLE, locks);
    expect(result.groupMatches).toEqual(SAMPLE.groupMatches);
    expect(result.groupStandings).toEqual([]);
    expect(result.bestThirds).toEqual([]);
    expect(result.knockout).toEqual([]);
    expect(result.awards).toEqual([]);
  });

  it('no muta la entrada original', () => {
    const original = structuredClone(SAMPLE);
    filterVisiblePredictions(SAMPLE, NONE_LOCKED);
    expect(SAMPLE).toEqual(original);
  });
});
