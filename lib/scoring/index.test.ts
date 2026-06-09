import { beforeEach, describe, expect, it, vi } from 'vitest';

// Tests del WIRING del orquestador con la BD mockeada (convención del proyecto:
// vitest no toca Postgres). Verifican que el recálculo selectivo persiste SOLO
// las categorías afectadas y registra una fila de auditoría coherente, y que el
// recálculo completo escribe las 7 categorías. La idempotencia y la selectividad
// sobre filas REALES se cubren en e2e (Postgres de verdad); aquí se comprueba la
// lógica de orquestación, que es donde está el riesgo de bug.

const SCORE_CATEGORIES = [
  'group_matches',
  'group_standings',
  'best_thirds',
  'bracket',
  'podium',
  'awards',
  'penalties',
] as const;

// Captura de efectos sobre la BD mockeada.
const upserted: string[] = [];
let auditRow: {
  triggeredBy: number;
  reason: string;
  affectedCategories: string[];
  usersAffected: number;
} | null = null;

const USERS = [{ id: 10 }, { id: 20 }];
const MATCHES = [
  {
    id: 1,
    phase: 'grupos',
    status: 'finished',
    realGolesLocal: 2,
    realGolesVisitante: 1,
    realWinnerTeamCode: 'X',
  },
  {
    id: 74,
    phase: '1/16',
    status: 'finished',
    realGolesLocal: null,
    realGolesVisitante: null,
    realWinnerTeamCode: 'Y',
  },
];

vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));

vi.mock('@/lib/db', () => {
  const table = (name: string) => ({
    __t: name,
    // Columnas referenciadas por el orquestador (target del upsert, proyecciones).
    userId: {},
    category: {},
    id: {},
  });

  const rowsFor = (t: { __t: string }) => {
    if (t.__t === 'users') return USERS;
    if (t.__t === 'matches') return MATCHES;
    return []; // predicciones y oficiales vacíos
  };

  type Chain = {
    _rows: unknown[];
    from: (t: { __t: string }) => Chain;
    where: () => Chain;
    then: (res: (v: unknown[]) => unknown) => Promise<unknown>;
  };
  const select = (): Chain => {
    const chain: Chain = {
      _rows: [],
      from(t) {
        this._rows = rowsFor(t);
        return this;
      },
      where() {
        return this;
      },
      then(res) {
        return Promise.resolve(this._rows).then(res);
      },
    };
    return chain;
  };

  const insert = (t: { __t: string }) => ({
    values(v: Record<string, unknown>) {
      return {
        onConflictDoUpdate() {
          if (t.__t === 'scores') {
            upserted.push(String(v.category));
          }
          return Promise.resolve();
        },
        then(res: (v: unknown) => unknown) {
          if (t.__t === 'score_recalculations') {
            auditRow = v as typeof auditRow;
          }
          return Promise.resolve().then(res);
        },
      };
    },
  });

  const exec = { select, insert };
  return {
    db: {
      transaction: async (cb: (tx: typeof exec) => Promise<unknown>) =>
        cb(exec),
      ...exec,
    },
    matches: table('matches'),
    users: table('users'),
    scores: table('scores'),
    scoreRecalculations: table('score_recalculations'),
    predictionsGroupMatches: table('pgm'),
    predictionsGroupStandings: table('pgs'),
    predictionsBestThirds: table('pbt'),
    predictionsKnockout: table('pko'),
    predictionsAwards: table('paw'),
    actualGroupStandings: table('ags'),
    actualBestThirds: table('abt'),
    actualAwards: table('aaw'),
    SCORE_CATEGORIES,
  };
});

const { calculateUserScore, recalculateAfterResultChange } = await import(
  './index'
);

beforeEach(() => {
  upserted.length = 0;
  auditRow = null;
});

describe('recalculateAfterResultChange — recálculo selectivo + auditoría', () => {
  it('un cambio de marcador de grupos persiste SOLO group_matches, para todos los usuarios', async () => {
    await recalculateAfterResultChange({ type: 'group_match', matchId: 1 }, 99);

    // Una fila por usuario, todas de la misma categoría.
    expect(upserted).toEqual(['group_matches', 'group_matches']);
    expect(auditRow).toEqual({
      triggeredBy: 99,
      reason: expect.any(String),
      affectedCategories: ['group_matches'],
      usersAffected: 2,
    });
  });

  it('un premio de podio persiste SOLO podium; nunca penalties', async () => {
    await recalculateAfterResultChange(
      { type: 'award', awardKind: 'champion' },
      99,
    );

    expect(new Set(upserted)).toEqual(new Set(['podium']));
    expect(upserted).not.toContain('penalties');
    expect(auditRow?.affectedCategories).toEqual(['podium']);
  });

  it('una bota persiste SOLO awards', async () => {
    await recalculateAfterResultChange(
      { type: 'award', awardKind: 'boot_gold' },
      99,
    );
    expect(new Set(upserted)).toEqual(new Set(['awards']));
  });

  it('no registra penalties en la auditoría de ningún cambio de resultado', async () => {
    await recalculateAfterResultChange({ type: 'knockout', matchId: 74 }, 99);
    expect(auditRow?.affectedCategories).not.toContain('penalties');
  });
});

describe('calculateUserScore — recálculo completo', () => {
  it('persiste las 7 categorías de un usuario', async () => {
    await calculateUserScore(10);
    expect([...upserted].sort()).toEqual([...SCORE_CATEGORIES].sort());
  });
});
