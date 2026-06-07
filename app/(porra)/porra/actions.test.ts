import { afterEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@/lib/db';

import { getCurrentUser } from '@/lib/auth/current-user';
import { db } from '@/lib/db';
import {
  isGroupMatchPredictionLocked,
  isGroupStandingsLocked,
} from '@/lib/scoring/locks';

import { saveGroupMatchPredictions, saveGroupStandings } from './actions';

// La cadena variable-de-entorno → UI del estado bloqueado ya la cubre el e2e
// (porra-grupos-locked.spec.ts). Lo que el e2e NO puede probar de forma estable
// es el rechazo explícito de la Server Action con código LOCKED, porque invocar
// el action por HTTP exige conocer el action-id del build. Eso se cubre aquí.

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/scoring/locks', () => ({
  isGroupMatchPredictionLocked: vi.fn(),
  isGroupStandingsLocked: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  db: { transaction: vi.fn(), select: vi.fn() },
  matches: {},
  predictionsGroupMatches: {},
  predictionsGroupStandings: {},
  teams: {},
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const FAKE_USER: User = {
  id: 1,
  email: 'jugador@test.dev',
  passwordHash: 'hash',
  nombre: 'Jugador',
  apellidos: 'De Prueba',
  nickname: 'jugador',
  isAdmin: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const VALID_PAYLOAD = [{ matchId: 1, golesLocal: 2, golesVisitante: 1 }];

afterEach(() => {
  vi.clearAllMocks();
});

describe('saveGroupMatchPredictions', () => {
  it('rechaza con LOCKED cuando la porra está bloqueada, sin tocar la BD', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(FAKE_USER);
    vi.mocked(isGroupMatchPredictionLocked).mockReturnValue(true);

    const result = await saveGroupMatchPredictions(VALID_PAYLOAD);

    expect(result).toEqual({
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    });
    // El lock check va antes de cualquier escritura: la BD no se toca.
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rechaza con UNAUTHENTICATED si no hay sesión, sin comprobar el lock', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await saveGroupMatchPredictions(VALID_PAYLOAD);

    expect(result).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' },
    });
    expect(isGroupMatchPredictionLocked).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

const VALID_STANDINGS = [
  { groupLetter: 'A', position: 1, teamCode: 'MEX' },
  { groupLetter: 'A', position: 2, teamCode: 'CAN' },
  { groupLetter: 'A', position: 3, teamCode: 'USA' },
  { groupLetter: 'A', position: 4, teamCode: 'RSA' },
];

describe('saveGroupStandings', () => {
  it('rechaza con LOCKED cuando la porra está bloqueada, sin tocar la BD', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(FAKE_USER);
    vi.mocked(isGroupStandingsLocked).mockReturnValue(true);

    const result = await saveGroupStandings(VALID_STANDINGS);

    expect(result).toEqual({
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rechaza con UNAUTHENTICATED si no hay sesión, sin comprobar el lock', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await saveGroupStandings(VALID_STANDINGS);

    expect(result).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' },
    });
    expect(isGroupStandingsLocked).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rechaza con INVALID_INPUT si el batch tiene posiciones repetidas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(FAKE_USER);
    vi.mocked(isGroupStandingsLocked).mockReturnValue(false);

    const result = await saveGroupStandings([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 1, teamCode: 'CAN' },
    ]);

    expect(result).toEqual({
      error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' },
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
