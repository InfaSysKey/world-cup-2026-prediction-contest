// Casos canónicos de §3.4 (bracket eliminatorio), bracket RÍGIDO (ADR 0003).
// Tripleta pick + oficial → esperado, calculado a mano desde la doc. El pick es
// el ganador que el usuario predijo para ese cruce; realWinnerTeamCode es el
// equipo que realmente ganó ese cruce. Solo puntúa si pick === realWinner.

import type { KnockoutMatchScore, KnockoutOfficial } from '../knockout';

export type KnockoutCase = {
  name: string;
  pick: string | null;
  official: KnockoutOfficial;
  expected: KnockoutMatchScore;
};

export const knockoutCases: KnockoutCase[] = [
  {
    name: 'acierto en 1/16 → 4',
    pick: 'ESP',
    official: { phase: '1/16', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 4, hit: true },
  },
  {
    name: 'acierto en 1/8 → 6',
    pick: 'ESP',
    official: { phase: '1/8', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 6, hit: true },
  },
  {
    name: 'acierto en cuartos → 10',
    pick: 'ESP',
    official: { phase: 'cuartos', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 10, hit: true },
  },
  {
    name: 'acierto en semifinales → 15',
    pick: 'ESP',
    official: { phase: 'semi', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 15, hit: true },
  },
  {
    name: 'acierto en el 3.º/4.º puesto → 12',
    pick: 'ESP',
    official: { phase: '3-4', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 12, hit: true },
  },
  {
    name: 'acierto en la final → 25',
    pick: 'ESP',
    official: { phase: 'final', realWinnerTeamCode: 'ESP', cancelled: false },
    expected: { points: 25, hit: true },
  },
  {
    name: 'RÍGIDO (ADR 0003): el equipo predicho quedó eliminado antes; el cruce real lo ganó otro → 0',
    pick: 'ESP',
    official: { phase: 'cuartos', realWinnerTeamCode: 'BRA', cancelled: false },
    expected: { points: 0, hit: false },
  },
  {
    name: 'fallo simple: predijo al perdedor del cruce → 0',
    pick: 'GER',
    official: { phase: 'semi', realWinnerTeamCode: 'FRA', cancelled: false },
    expected: { points: 0, hit: false },
  },
  {
    name: 'cruce vacío (sin pick) → 0, sin penalización (§4)',
    pick: null,
    official: { phase: 'final', realWinnerTeamCode: 'ARG', cancelled: false },
    expected: { points: 0, hit: false },
  },
  {
    name: 'cruce anulado (§6.1) → 0, sin penalización',
    pick: 'ESP',
    official: { phase: 'cuartos', realWinnerTeamCode: 'ESP', cancelled: true },
    expected: { points: 0, hit: false },
  },
];
