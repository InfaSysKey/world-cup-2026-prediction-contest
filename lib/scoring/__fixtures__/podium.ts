// Casos canónicos de §3.5 (cuadro de honor / podio). Tripleta picks + oficial →
// esperado, calculado a mano desde la doc. El podio oficial fijo es
// {champion: ARG, runner_up: FRA, third: CRO}; cada caso varía los picks.
// champion=20, runner_up=12, third=8. Adicionales a los del bracket (§3.5).

import type { PodiumOfficial, PodiumPicks, PodiumScore } from '../podium';

export type PodiumCase = {
  name: string;
  picks: PodiumPicks;
  official: PodiumOfficial;
  // Siempre en orden [champion, runner_up, third].
  expected: PodiumScore[];
};

const OFFICIAL: PodiumOfficial = {
  champion: 'ARG',
  runner_up: 'FRA',
  third: 'CRO',
};

export const podiumCases: PodiumCase[] = [
  {
    name: 'los 3 puestos acertados → 20 + 12 + 8',
    picks: { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 20, hit: true },
      { kind: 'runner_up', points: 12, hit: true },
      { kind: 'third', points: 8, hit: true },
    ],
  },
  {
    name: 'solo el campeón → 20',
    picks: { champion: 'ARG', runner_up: 'BRA', third: 'GER' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 20, hit: true },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 0, hit: false },
    ],
  },
  {
    name: 'solo el subcampeón → 12',
    picks: { champion: 'BRA', runner_up: 'FRA', third: 'GER' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 12, hit: true },
      { kind: 'third', points: 0, hit: false },
    ],
  },
  {
    name: 'solo el 3.º puesto → 8',
    picks: { champion: 'BRA', runner_up: 'GER', third: 'CRO' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 8, hit: true },
    ],
  },
  {
    name: 'podio totalmente vacío → 0, sin penalización (§4)',
    picks: { champion: null, runner_up: null, third: null },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 0, hit: false },
    ],
  },
  {
    name: 'los 3 fallados → 0',
    picks: { champion: 'BRA', runner_up: 'GER', third: 'ESP' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 0, hit: false },
    ],
  },
];
