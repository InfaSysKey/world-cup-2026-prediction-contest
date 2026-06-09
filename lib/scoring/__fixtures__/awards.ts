// Casos canónicos de §3.6 (premios individuales). Tripleta picks + oficial →
// esperado, calculado a mano desde la doc. Match de nombre case-insensitive +
// trim + sin tildes (decisión de 4.7). bota oro=15/plata=8/bronce=5,
// balón oro=12/plata=6/bronce=4. Premio vacío o jugador que no participa → 0.

import type { AwardOfficial, AwardPicks, AwardScore } from '../awards';

export type AwardCase = {
  name: string;
  picks: AwardPicks;
  official: AwardOfficial;
  // Orden fijo: boot_gold, boot_silver, boot_bronze, ball_gold, ball_silver, ball_bronze.
  expected: AwardScore[];
};

const OFFICIAL: AwardOfficial = {
  boot_gold: 'Kylian Mbappé',
  boot_silver: 'Harry Kane',
  boot_bronze: 'Julián Álvarez',
  ball_gold: 'Lionel Messi',
  ball_silver: 'Luka Modrić',
  ball_bronze: 'Antoine Griezmann',
};

const EMPTY: AwardPicks = {
  boot_gold: null,
  boot_silver: null,
  boot_bronze: null,
  ball_gold: null,
  ball_silver: null,
  ball_bronze: null,
};

export const awardCases: AwardCase[] = [
  {
    name: 'los 6 premios acertados → 15+8+5+12+6+4',
    picks: { ...OFFICIAL },
    official: OFFICIAL,
    expected: [
      { kind: 'boot_gold', points: 15, hit: true },
      { kind: 'boot_silver', points: 8, hit: true },
      { kind: 'boot_bronze', points: 5, hit: true },
      { kind: 'ball_gold', points: 12, hit: true },
      { kind: 'ball_silver', points: 6, hit: true },
      { kind: 'ball_bronze', points: 4, hit: true },
    ],
  },
  {
    name: 'match tolerante: mayúsculas + sin tildes + espacios extra → acierta',
    picks: { ...EMPTY, boot_gold: '  KYLIAN   MBAPPE ' },
    official: OFFICIAL,
    expected: [
      { kind: 'boot_gold', points: 15, hit: true },
      { kind: 'boot_silver', points: 0, hit: false },
      { kind: 'boot_bronze', points: 0, hit: false },
      { kind: 'ball_gold', points: 0, hit: false },
      { kind: 'ball_silver', points: 0, hit: false },
      { kind: 'ball_bronze', points: 0, hit: false },
    ],
  },
  {
    name: 'jugador equivocado (§6.6 no participa / fallo) → 0',
    picks: { ...EMPTY, ball_gold: 'Erling Haaland' },
    official: OFFICIAL,
    expected: [
      { kind: 'boot_gold', points: 0, hit: false },
      { kind: 'boot_silver', points: 0, hit: false },
      { kind: 'boot_bronze', points: 0, hit: false },
      { kind: 'ball_gold', points: 0, hit: false },
      { kind: 'ball_silver', points: 0, hit: false },
      { kind: 'ball_bronze', points: 0, hit: false },
    ],
  },
  {
    name: 'todos los premios vacíos → 0, sin penalización (§4)',
    picks: { ...EMPTY },
    official: OFFICIAL,
    expected: [
      { kind: 'boot_gold', points: 0, hit: false },
      { kind: 'boot_silver', points: 0, hit: false },
      { kind: 'boot_bronze', points: 0, hit: false },
      { kind: 'ball_gold', points: 0, hit: false },
      { kind: 'ball_silver', points: 0, hit: false },
      { kind: 'ball_bronze', points: 0, hit: false },
    ],
  },
  {
    name: 'premio oficial aún desconocido (null) con pick presente → 0',
    picks: { ...EMPTY, boot_gold: 'Kylian Mbappé' },
    official: { ...OFFICIAL, boot_gold: null },
    expected: [
      { kind: 'boot_gold', points: 0, hit: false },
      { kind: 'boot_silver', points: 0, hit: false },
      { kind: 'boot_bronze', points: 0, hit: false },
      { kind: 'ball_gold', points: 0, hit: false },
      { kind: 'ball_silver', points: 0, hit: false },
      { kind: 'ball_bronze', points: 0, hit: false },
    ],
  },
];
