// Casos canónicos de §3.5 (cuadro de honor / podio), v2.0 del Excel (ADR 0009).
// Tripleta picks + oficial → esperado, calculado a mano desde la doc. El podio
// oficial fijo es {champion: ARG, runner_up: FRA, third: CRO}; cada caso varía
// los picks.
// champion=30, runner_up=20, third=10. Son adicionales a §3.3 y §3.4.

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
    name: 'los 3 puestos acertados → 30 + 20 + 10',
    picks: { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 30, hit: true },
      { kind: 'runner_up', points: 20, hit: true },
      { kind: 'third', points: 10, hit: true },
    ],
  },
  {
    name: 'solo el campeón → 30',
    picks: { champion: 'ARG', runner_up: 'BRA', third: 'GER' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 30, hit: true },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 0, hit: false },
    ],
  },
  {
    name: 'solo el subcampeón → 20',
    picks: { champion: 'BRA', runner_up: 'FRA', third: 'GER' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 20, hit: true },
      { kind: 'third', points: 0, hit: false },
    ],
  },
  {
    name: 'solo el 3.º puesto → 10',
    picks: { champion: 'BRA', runner_up: 'GER', third: 'CRO' },
    official: OFFICIAL,
    expected: [
      { kind: 'champion', points: 0, hit: false },
      { kind: 'runner_up', points: 0, hit: false },
      { kind: 'third', points: 10, hit: true },
    ],
  },
  {
    name: 'podio totalmente vacío → 0, sin penalización',
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
