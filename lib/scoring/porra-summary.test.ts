import { describe, expect, it } from 'vitest';

import {
  computePorraSummary,
  type SummaryCatalog,
  type SummaryPredictions,
} from './porra-summary';
import type { KnockoutMatchRef } from './resolve-bracket';
import type { Phase } from '@/lib/db';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Catálogo: 32 cruces con su fase real (ids 73–104) y mapas de equipo→grupo y
// equipo→nombre. Los slot_refs no los usa el summary (solo la fase).
function makeCatalog(): SummaryCatalog {
  const phaseOf = (id: number): Phase => {
    if (id <= 88) return '1/16';
    if (id <= 96) return '1/8';
    if (id <= 100) return 'cuartos';
    if (id <= 102) return 'semi';
    if (id === 103) return '3-4';
    return 'final';
  };
  const knockoutMatches: KnockoutMatchRef[] = [];
  for (let id = 73; id <= 104; id++) {
    knockoutMatches.push({ id, phase: phaseOf(id), homeSlotRef: '', awaySlotRef: '' });
  }
  const teamGroup = new Map<string, string>();
  const teamName = new Map<string, string>();
  for (const g of GROUPS) {
    for (let pos = 1; pos <= 4; pos++) {
      const code = `${g}${pos}`;
      teamGroup.set(code, g);
      teamName.set(code, code);
    }
  }
  return { knockoutMatches, teamGroup, teamName };
}

function fullStandings(): SummaryPredictions['groupStandings'] {
  return GROUPS.flatMap((g) =>
    [1, 2, 3, 4].map((position) => ({
      groupLetter: g,
      position,
      teamCode: `${g}${position}`,
    })),
  );
}

// 8 mejores terceros coherentes: el 3.º de los grupos A–H.
function coherentBestThirds(): SummaryPredictions['bestThirds'] {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((g, i) => ({
    position: i + 1,
    teamCode: `${g}3`,
  }));
}

// 32 ganadores, todos equipos clasificados. Final/semis/3-4 cuadran con el podio
// A1 (campeón) / B1 (subcampeón) / C1 (3.º).
function coherentKnockout(): { matchId: number; winnerTeamCode: string }[] {
  const picks: { matchId: number; winnerTeamCode: string }[] = [];
  for (let id = 73; id <= 104; id++) {
    let winner = 'A1';
    if (id === 102) winner = 'B1';
    if (id === 103) winner = 'C1';
    picks.push({ matchId: id, winnerTeamCode: winner });
  }
  return picks;
}

function coherentAwards(): SummaryPredictions['awards'] {
  return [
    { kind: 'champion', teamCode: 'A1', playerName: null },
    { kind: 'runner_up', teamCode: 'B1', playerName: null },
    { kind: 'third', teamCode: 'C1', playerName: null },
    { kind: 'boot_gold', teamCode: null, playerName: 'P1' },
    { kind: 'boot_silver', teamCode: null, playerName: 'P2' },
    { kind: 'boot_bronze', teamCode: null, playerName: 'P3' },
    { kind: 'ball_gold', teamCode: null, playerName: 'P4' },
    { kind: 'ball_silver', teamCode: null, playerName: 'P5' },
    { kind: 'ball_bronze', teamCode: null, playerName: 'P6' },
  ];
}

const EMPTY: SummaryPredictions = {
  groupMatches: [],
  groupStandings: [],
  bestThirds: [],
  knockout: [],
  awards: [],
};

function fullCoherent(): SummaryPredictions {
  return {
    groupMatches: Array.from({ length: 72 }, (_, i) => ({ matchId: i + 1 })),
    groupStandings: fullStandings(),
    bestThirds: coherentBestThirds(),
    knockout: coherentKnockout(),
    awards: coherentAwards(),
  };
}

describe('computePorraSummary', () => {
  const catalog = makeCatalog();

  it('porra vacía → incompleta, huecos en todos los tabs, 0 mismatches', () => {
    const s = computePorraSummary(EMPTY, catalog);
    expect(s.overallStatus).toBe('incompleta');
    expect(s.totalMismatches).toBe(0);
    expect(s.tabs.grupos.gaps).toBe(72 + 48);
    expect(s.tabs.terceros.gaps).toBe(8);
    expect(s.tabs.bracket.gaps).toBe(32);
    expect(s.tabs.podio.gaps).toBe(3);
    expect(s.tabs.premios.gaps).toBe(6);
    expect(s.tabs.grupos.status).toBe('incompleta');
  });

  it('porra completa y coherente → completa, 0 huecos, 0 mismatches', () => {
    const s = computePorraSummary(fullCoherent(), catalog);
    expect(s.overallStatus).toBe('completa');
    expect(s.totalGaps).toBe(0);
    expect(s.totalMismatches).toBe(0);
    expect(s.tabs.bracket.status).toBe('completa');
    expect(s.tabs.podio.status).toBe('completa');
  });

  it('completa con podio incoherente → revisar, 0 huecos, mismatch de podio', () => {
    const p = fullCoherent();
    // Campeón guardado ≠ ganador de la final deducido (A1).
    p.awards = p.awards.map((a) =>
      a.kind === 'champion' ? { ...a, teamCode: 'D1' } : a,
    );
    const s = computePorraSummary(p, catalog);
    expect(s.overallStatus).toBe('revisar');
    expect(s.totalGaps).toBe(0);
    expect(s.tabs.podio.status).toBe('revisar');
    const m = s.tabs.podio.mismatches.find((x) => x.id === 'podio.champion.bracketMismatch');
    expect(m).toBeDefined();
    expect(m?.fix?.action).toBe('sync-to-bracket');
  });

  it('completa con bracket pickando equipo no clasificado → revisar, mismatch en bracket', () => {
    const p = fullCoherent();
    // En el cruce 73 gana A4, que el usuario predijo 4.º de su grupo.
    p.knockout = p.knockout.map((k) =>
      k.matchId === 73 ? { ...k, winnerTeamCode: 'A4' } : k,
    );
    const s = computePorraSummary(p, catalog);
    expect(s.overallStatus).toBe('revisar');
    expect(s.tabs.bracket.status).toBe('revisar');
    const m = s.tabs.bracket.mismatches.find(
      (x) => x.id === 'bracket.unqualified.73.A4',
    );
    expect(m).toBeDefined();
    expect(m?.anchor).toBe('bracket-match-73');
    expect(m?.message).toContain('A4');
  });

  it('completa con mejor tercero stale → revisar por stale', () => {
    const p = fullCoherent();
    // A4 no es el 3.º de ningún grupo → stale.
    p.bestThirds = p.bestThirds.map((b) =>
      b.position === 1 ? { ...b, teamCode: 'A4' } : b,
    );
    const s = computePorraSummary(p, catalog);
    expect(s.overallStatus).toBe('revisar');
    expect(s.tabs.terceros.status).toBe('revisar');
    expect(
      s.tabs.terceros.mismatches.some((x) => x.id === 'terceros.stale.A4'),
    ).toBe(true);
  });

  it('mezcla huecos + mismatches → contadores correctos', () => {
    const p = fullCoherent();
    // Quita la mitad de los marcadores (36 huecos) y desincroniza el campeón.
    p.groupMatches = p.groupMatches.slice(0, 36);
    p.awards = p.awards.map((a) =>
      a.kind === 'champion' ? { ...a, teamCode: 'D1' } : a,
    );
    const s = computePorraSummary(p, catalog);
    expect(s.totalGaps).toBe(36);
    expect(s.totalMismatches).toBeGreaterThan(0);
    expect(s.overallStatus).toBe('revisar');
    expect(s.tabs.grupos.status).toBe('incompleta');
  });

  it('3 botas iguales → mismatch error severity', () => {
    const p = fullCoherent();
    p.awards = p.awards.map((a) =>
      a.kind === 'boot_silver' || a.kind === 'boot_bronze'
        ? { ...a, playerName: 'P1' }
        : a,
    );
    const s = computePorraSummary(p, catalog);
    const m = s.tabs.premios.mismatches.find((x) => x.id === 'premios.boots.duplicate');
    expect(m).toBeDefined();
    expect(m?.severity).toBe('error');
    expect(s.tabs.premios.status).toBe('revisar');
  });

  // Completitud del tab de premios (summarizePremios): 6 nombres llenos y
  // distintos → completa; cualquier hueco → incompleta con el conteo exacto.
  const premiosAwards = (
    names: Partial<Record<string, string | null>>,
  ): SummaryPredictions['awards'] =>
    (
      ['boot_gold', 'boot_silver', 'boot_bronze', 'ball_gold', 'ball_silver', 'ball_bronze'] as const
    ).map((kind) => ({ kind, teamCode: null, playerName: names[kind] ?? null }));

  it('premios: 6 nombres distintos → completa, 0 huecos', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      awards: premiosAwards({
        boot_gold: 'P1',
        boot_silver: 'P2',
        boot_bronze: 'P3',
        ball_gold: 'P4',
        ball_silver: 'P5',
        ball_bronze: 'P6',
      }),
    };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.premios.gaps).toBe(0);
    expect(s.tabs.premios.mismatches).toHaveLength(0);
    expect(s.tabs.premios.status).toBe('completa');
  });

  it('premios: 4 de 6 llenos → incompleta con 2 huecos', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      awards: premiosAwards({
        boot_gold: 'P1',
        boot_silver: 'P2',
        boot_bronze: 'P3',
        ball_gold: 'P4',
      }),
    };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.premios.gaps).toBe(2);
    expect(s.tabs.premios.status).toBe('incompleta');
  });

  it('premios: nombre de solo espacios cuenta como vacío', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      awards: premiosAwards({
        boot_gold: 'P1',
        boot_silver: 'P2',
        boot_bronze: 'P3',
        ball_gold: 'P4',
        ball_silver: 'P5',
        ball_bronze: '   ',
      }),
    };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.premios.gaps).toBe(1);
    expect(s.tabs.premios.status).toBe('incompleta');
  });

  it('bracket parcial (solo final, incoherente) → huecos en knockout y mismatch activo', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      groupStandings: fullStandings(),
      // Solo la final predicha, ganada por A4 (4.º de grupo → no clasifica).
      knockout: [{ matchId: 104, winnerTeamCode: 'A4' }],
    };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.bracket.gaps).toBe(31);
    expect(
      s.tabs.bracket.mismatches.some((x) => x.id === 'bracket.unqualified.104.A4'),
    ).toBe(true);
    expect(s.tabs.bracket.status).toBe('revisar');
  });

  it('standings vacíos → terceros incompleta con 8 huecos', () => {
    const s = computePorraSummary(EMPTY, catalog);
    expect(s.tabs.terceros.gaps).toBe(8);
    expect(s.tabs.terceros.status).toBe('incompleta');
    expect(s.tabs.terceros.mismatches).toHaveLength(0);
  });

  it('premios vacíos → incompleta con 6 huecos', () => {
    const s = computePorraSummary(EMPTY, catalog);
    expect(s.tabs.premios.gaps).toBe(6);
    expect(s.tabs.premios.status).toBe('incompleta');
  });

  it('lista plana ordena errores antes que warnings', () => {
    const p = fullCoherent();
    // Un warning (podio) y un error (botas duplicadas) a la vez.
    p.awards = p.awards.map((a) => {
      if (a.kind === 'champion') return { ...a, teamCode: 'D1' };
      if (a.kind === 'boot_silver' || a.kind === 'boot_bronze')
        return { ...a, playerName: 'P1' };
      return a;
    });
    const s = computePorraSummary(p, catalog);
    expect(s.mismatches.length).toBeGreaterThanOrEqual(2);
    expect(s.mismatches[0].severity).toBe('error');
  });

  // --- Podio sugerido (ADR 0005): persisted vs suggested ---

  it('podio: sin guardar y sin bracket → 3 huecos, sin mismatch', () => {
    const s = computePorraSummary(EMPTY, catalog);
    expect(s.tabs.podio.gaps).toBe(3);
    expect(s.tabs.podio.mismatches).toHaveLength(0);
    expect(s.tabs.podio.status).toBe('incompleta');
  });

  it('podio: sin guardar pero la final predicha → campeón sin confirmar (revisar), 2 huecos', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      knockout: [{ matchId: 104, winnerTeamCode: 'A1' }],
    };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.podio.gaps).toBe(2);
    const m = s.tabs.podio.mismatches.find(
      (x) => x.id === 'podio.champion.unconfirmed',
    );
    expect(m).toBeDefined();
    expect(m?.severity).toBe('warning');
    expect(m?.fix?.label).toBe('Confirmar');
    expect(m?.fix?.action).toBe('sync-to-bracket');
    expect(s.tabs.podio.status).toBe('revisar');
  });

  it('podio: sin guardar y bracket completo → 3 sin confirmar, 0 huecos, revisar', () => {
    const p: SummaryPredictions = { ...EMPTY, knockout: coherentKnockout() };
    const s = computePorraSummary(p, catalog);
    expect(s.tabs.podio.gaps).toBe(0);
    const ids = s.tabs.podio.mismatches.map((m) => m.id).sort();
    expect(ids).toEqual(
      [
        'podio.champion.unconfirmed',
        'podio.runnerUp.unconfirmed',
        'podio.third.unconfirmed',
      ].sort(),
    );
    expect(s.tabs.podio.status).toBe('revisar');
  });

  it('podio: campeón guardado pero el bracket apunta a otro → stale, no "unconfirmed"', () => {
    const p: SummaryPredictions = {
      ...EMPTY,
      knockout: [{ matchId: 104, winnerTeamCode: 'A1' }],
      awards: [{ kind: 'champion', teamCode: 'B1', playerName: null }],
    };
    const s = computePorraSummary(p, catalog);
    // champion guardado (B1) discrepa del bracket (A1) → stale; runnerUp y third
    // sin sugerencia → 2 huecos.
    expect(s.tabs.podio.gaps).toBe(2);
    const stale = s.tabs.podio.mismatches.find(
      (x) => x.id === 'podio.champion.bracketMismatch',
    );
    expect(stale).toBeDefined();
    expect(stale?.fix?.label).toBe('Sincronizar');
    expect(
      s.tabs.podio.mismatches.some((x) => x.id === 'podio.champion.unconfirmed'),
    ).toBe(false);
    expect(s.tabs.podio.status).toBe('revisar');
  });
});
