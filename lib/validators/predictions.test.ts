import { describe, expect, it } from 'vitest';

import {
  bestThirdsBatchSchema,
  groupMatchPredictionSchema,
  groupMatchPredictionsBatchSchema,
  groupStandingPredictionSchema,
  groupStandingsBatchSchema,
  playerAwardsPredictionSchema,
  podiumPredictionSchema,
} from './predictions';

const EMPTY_AWARDS = {
  bootGold: null,
  bootSilver: null,
  bootBronze: null,
  ballGold: null,
  ballSilver: null,
  ballBronze: null,
};

describe('groupMatchPredictionSchema', () => {
  it('acepta un marcador válido', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 1,
      golesLocal: 2,
      golesVisitante: 1,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza goles negativos', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 1,
      golesLocal: -1,
      golesVisitante: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza matchId fuera de rango (knockout)', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 73,
      golesLocal: 1,
      golesVisitante: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza goles no enteros', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 5,
      golesLocal: 1.5,
      golesVisitante: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un string en lugar de número (sin coerción)', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 5,
      golesLocal: '2',
      golesVisitante: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe('groupMatchPredictionsBatchSchema', () => {
  it('acepta un array de marcadores válidos', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([
      { matchId: 1, golesLocal: 0, golesVisitante: 0 },
      { matchId: 2, golesLocal: 3, golesVisitante: 2 },
    ]);
    expect(r.success).toBe(true);
  });

  it('acepta un array vacío', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([]);
    expect(r.success).toBe(true);
  });

  it('rechaza si algún elemento es inválido', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([
      { matchId: 1, golesLocal: 0, golesVisitante: 0 },
      { matchId: 2, golesLocal: -1, golesVisitante: 2 },
    ]);
    expect(r.success).toBe(false);
  });
});

describe('groupStandingPredictionSchema', () => {
  it('acepta una posición válida', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 1,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una letra de grupo inexistente', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'Z',
      position: 1,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza posición fuera de rango', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 5,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un code de equipo con formato inválido', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 1,
      teamCode: 'mexico',
    });
    expect(r.success).toBe(false);
  });
});

describe('groupStandingsBatchSchema', () => {
  it('acepta un grupo completo y bien ordenado', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 2, teamCode: 'CAN' },
      { groupLetter: 'A', position: 3, teamCode: 'USA' },
      { groupLetter: 'A', position: 4, teamCode: 'RSA' },
    ]);
    expect(r.success).toBe(true);
  });

  it('rechaza una posición repetida dentro del mismo grupo', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 1, teamCode: 'CAN' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza el mismo equipo en dos posiciones del mismo grupo', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 2, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('permite la misma posición en grupos distintos', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'B', position: 1, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(true);
  });
});

describe('bestThirdsBatchSchema', () => {
  it('acepta un ranking parcial válido', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 2, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(true);
  });

  it('acepta un array vacío (guardado parcial)', () => {
    const r = bestThirdsBatchSchema.safeParse([]);
    expect(r.success).toBe(true);
  });

  it('rechaza posición fuera de 1–8', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 9, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza el mismo equipo en dos posiciones', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 2, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza una posición repetida', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 1, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza más de 8 selecciones', () => {
    const codes = ['MEX', 'ESP', 'BRA', 'ARG', 'FRA', 'GER', 'ITA', 'POR', 'NED'];
    const r = bestThirdsBatchSchema.safeParse(
      codes.map((teamCode, i) => ({ position: i + 1, teamCode })),
    );
    expect(r.success).toBe(false);
  });

  it('rechaza un teamCode con formato inválido', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'mexico' },
    ]);
    expect(r.success).toBe(false);
  });
});

// --- Cobertura cross-slice preparatoria para 4.7 (boot_*/ball_*) ---
// Verifica que podiumPredictionSchema NO rechaza ni interfiere con los kinds de
// premios individuales: son objetos distintos que caerán en un schema separado
// en el mismo archivo (data-model.md §4.5). La colisión se detectaría si el
// validator del podio empezase a aceptar o a confundir esos kinds.
describe('podiumPredictionSchema — no colisión con kinds de premios de 4.7', () => {
  const AWARD_KINDS = [
    'boot_gold',
    'boot_silver',
    'boot_bronze',
    'ball_gold',
    'ball_silver',
    'ball_bronze',
  ] as const;

  for (const kind of AWARD_KINDS) {
    it(`rechaza un objeto con clave '${kind}' en lugar de champion/runnerUp/third`, () => {
      // Un objeto con keys de premios individuales no cumple la forma del podio.
      const r = podiumPredictionSchema.safeParse({
        [kind]: 'ESP',
        runnerUp: null,
        third: null,
      });
      // 'champion' falta → schema lo rechaza por clave ausente.
      expect(r.success).toBe(false);
    });
  }

  it('acepta un podio completo con los 3 puestos sin confundirse con los kinds de premios', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'ESP',
      runnerUp: 'FRA',
      third: 'POR',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // El resultado parseado solo tiene las 3 claves del podio, no keys extra.
      expect(Object.keys(r.data)).toEqual(['champion', 'runnerUp', 'third']);
    }
  });
});

describe('podiumPredictionSchema', () => {
  it('acepta los 3 puestos distintos', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'ESP',
      runnerUp: 'FRA',
      third: 'POR',
    });
    expect(r.success).toBe(true);
  });

  it('acepta un podio parcial con nulls', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'ESP',
      runnerUp: null,
      third: null,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza dos puestos con el mismo equipo', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'ESP',
      runnerUp: 'ESP',
      third: 'POR',
    });
    expect(r.success).toBe(false);
  });

  it('no considera duplicados los nulls (dos puestos vacíos)', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'ESP',
      runnerUp: null,
      third: null,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza un teamCode con formato inválido', () => {
    const r = podiumPredictionSchema.safeParse({
      champion: 'espana',
      runnerUp: null,
      third: null,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza si falta una clave', () => {
    const r = podiumPredictionSchema.safeParse({ champion: 'ESP', third: 'POR' });
    expect(r.success).toBe(false);
  });
});

describe('playerAwardsPredictionSchema', () => {
  it('acepta las 6 botas/balones rellenas y distintas por grupo', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      bootGold: 'Mbappé',
      bootSilver: 'Haaland',
      bootBronze: 'Kane',
      ballGold: 'Bellingham',
      ballSilver: 'Vinicius',
      ballBronze: 'Rodri',
    });
    expect(r.success).toBe(true);
  });

  it('acepta los 6 campos vacíos (guardado parcial)', () => {
    const r = playerAwardsPredictionSchema.safeParse(EMPTY_AWARDS);
    expect(r.success).toBe(true);
  });

  it('rechaza dos botas con el mismo jugador (mismo string)', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      ...EMPTY_AWARDS,
      bootGold: 'Mbappé',
      bootSilver: 'Mbappé',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza dos botas iguales ignorando mayúsculas y espacios', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      ...EMPTY_AWARDS,
      bootGold: 'mbappé',
      bootSilver: ' Mbappé ',
    });
    expect(r.success).toBe(false);
  });

  it('permite el mismo jugador en bota y en balón (no cruza grupos)', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      ...EMPTY_AWARDS,
      bootGold: 'Mbappé',
      ballGold: 'Mbappé',
    });
    expect(r.success).toBe(true);
  });

  it('recorta los espacios del nombre al parsear', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      ...EMPTY_AWARDS,
      bootGold: '  Mbappé  ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bootGold).toBe('Mbappé');
    }
  });

  it('rechaza un nombre de más de 80 caracteres', () => {
    const r = playerAwardsPredictionSchema.safeParse({
      ...EMPTY_AWARDS,
      bootGold: 'a'.repeat(81),
    });
    expect(r.success).toBe(false);
  });
});
