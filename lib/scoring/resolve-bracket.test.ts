import { describe, expect, it } from 'vitest';

import {
  resolveBracket,
  type BestThirdRef,
  type KnockoutMatchRef,
  type KnockoutPickRef,
  type StandingRef,
} from './resolve-bracket';

// Subconjunto de cruces reales del seed (lib/db/seed/matches.ts) suficiente para
// cubrir los cuatro tipos de slot_ref.
const MATCHES: KnockoutMatchRef[] = [
  { id: 73, phase: '1/16', homeSlotRef: '2A', awaySlotRef: '2B' },
  { id: 74, phase: '1/16', homeSlotRef: '1E', awaySlotRef: '3ABCDF' },
  { id: 75, phase: '1/16', homeSlotRef: '1F', awaySlotRef: '2C' },
  { id: 90, phase: '1/8', homeSlotRef: 'W73', awaySlotRef: 'W75' },
  { id: 97, phase: 'cuartos', homeSlotRef: 'W89', awaySlotRef: 'W90' },
  { id: 98, phase: 'cuartos', homeSlotRef: 'W93', awaySlotRef: 'W94' },
  { id: 101, phase: 'semi', homeSlotRef: 'W97', awaySlotRef: 'W98' },
  { id: 103, phase: '3-4', homeSlotRef: 'L101', awaySlotRef: 'L102' },
];

// Standings con 1.º/2.º/3.º de los grupos que necesitan los tests.
function standingsForGroups(groups: string[]): StandingRef[] {
  const out: StandingRef[] = [];
  for (const g of groups) {
    out.push({ groupLetter: g, position: 1, teamCode: `${g}1` });
    out.push({ groupLetter: g, position: 2, teamCode: `${g}2` });
    out.push({ groupLetter: g, position: 3, teamCode: `${g}3` });
  }
  return out;
}

// Los 8 mejores terceros = el 3.º de cada grupo de la combinación dada.
function bestThirdsFor(groups: string[]): {
  bestThirds: BestThirdRef[];
  teamGroup: Map<string, string>;
} {
  const bestThirds = groups.map((g, i) => ({
    position: i + 1,
    teamCode: `${g}3`,
  }));
  const teamGroup = new Map(groups.map((g) => [`${g}3`, g]));
  return { bestThirds, teamGroup };
}

describe('resolveBracket', () => {
  it('resuelve los lados de 1/16 desde 1.º/2.º de grupo', () => {
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups(['A', 'B']),
      bestThirds: [],
      knockout: [],
      teamGroup: new Map(),
    });
    const m73 = out.get(73)!;
    expect(m73.home.teamCode).toBe('A2');
    expect(m73.away.teamCode).toBe('B2');
    expect(m73.pickedWinner).toBeNull();
  });

  it('deja un lado pendiente si falta el standing aguas arriba', () => {
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups(['A']), // falta B
      bestThirds: [],
      knockout: [],
      teamGroup: new Map(),
    });
    const m73 = out.get(73)!;
    expect(m73.home.teamCode).toBe('A2');
    expect(m73.away.teamCode).toBeNull();
    expect(m73.away.ref).toBe('2B');
  });

  it('resuelve el slot de mejor 3.º vía el mapping del Excel', () => {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const { bestThirds, teamGroup } = bestThirdsFor(groups);
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups(groups),
      bestThirds,
      knockout: [],
      teamGroup,
    });
    // BEST_THIRDS_MAPPING['ABCDEFGH'][74] === 'C' → el 3.º del grupo C juega ahí.
    const m74 = out.get(74)!;
    expect(m74.home.teamCode).toBe('E1');
    expect(m74.away.teamCode).toBe('C3');
  });

  it('deja el slot de mejor 3.º pendiente si no hay 8 terceros de 8 grupos', () => {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G']; // solo 7
    const { bestThirds, teamGroup } = bestThirdsFor(groups);
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups([...groups, 'H']),
      bestThirds,
      knockout: [],
      teamGroup,
    });
    expect(out.get(74)!.away.teamCode).toBeNull();
  });

  it('resuelve un cruce de 1/8 desde los ganadores predichos de 1/16', () => {
    const knockout: KnockoutPickRef[] = [
      { matchId: 73, winnerTeamCode: 'A2' },
      { matchId: 75, winnerTeamCode: 'F1' },
    ];
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups(['A', 'B', 'C', 'F']),
      bestThirds: [],
      knockout,
      teamGroup: new Map(),
    });
    const m90 = out.get(90)!;
    expect(m90.home.teamCode).toBe('A2'); // ganador de W73
    expect(m90.away.teamCode).toBe('F1'); // ganador de W75
  });

  it('resuelve el partido por el 3.º puesto como perdedor de cada semifinal', () => {
    const knockout: KnockoutPickRef[] = [
      { matchId: 97, winnerTeamCode: 'Q97' },
      { matchId: 98, winnerTeamCode: 'Q98' },
      { matchId: 101, winnerTeamCode: 'Q97' }, // gana la semi 101 → pierde Q98
      { matchId: 102, winnerTeamCode: 'Q102' },
    ];
    const matches: KnockoutMatchRef[] = [
      ...MATCHES,
      { id: 89, phase: '1/8', homeSlotRef: 'W74', awaySlotRef: 'W77' },
      { id: 93, phase: '1/8', homeSlotRef: 'W83', awaySlotRef: 'W84' },
      { id: 94, phase: '1/8', homeSlotRef: 'W81', awaySlotRef: 'W82' },
      { id: 99, phase: 'cuartos', homeSlotRef: 'W91', awaySlotRef: 'W92' },
      { id: 100, phase: 'cuartos', homeSlotRef: 'W95', awaySlotRef: 'W96' },
      { id: 102, phase: 'semi', homeSlotRef: 'W99', awaySlotRef: 'W100' },
    ];
    // Las semis 101 y 102 necesitan sus dos lados resueltos para deducir el
    // perdedor: sembramos los ganadores de cuartos 97/98 (semi 101) y de 99/100
    // (semi 102).
    knockout.push(
      { matchId: 99, winnerTeamCode: 'Q99' },
      { matchId: 100, winnerTeamCode: 'Q100' },
    );
    const out = resolveBracket({
      matches,
      standings: [],
      bestThirds: [],
      knockout,
      teamGroup: new Map(),
    });
    const m103 = out.get(103)!;
    // L101: la semi 101 la disputan Q97 (W97) y Q98 (W98); gana Q97 → pierde Q98.
    expect(m103.home.teamCode).toBe('Q98');
    // L102: semi 102 entre Q99 y Q100; gana Q102, que NO es ninguno → ambiguo.
    expect(m103.away.teamCode).toBeNull();
  });

  it('expone el ganador predicho de cada cruce', () => {
    const out = resolveBracket({
      matches: MATCHES,
      standings: standingsForGroups(['A', 'B']),
      bestThirds: [],
      knockout: [{ matchId: 73, winnerTeamCode: 'A2' }],
      teamGroup: new Map(),
    });
    expect(out.get(73)!.pickedWinner).toBe('A2');
  });
});
