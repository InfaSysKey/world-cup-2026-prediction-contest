/**
 * Semilla de predicciones de fase de grupos (orden 1–4) y mejores terceros para
 * los tests e2e del bracket: la resolución del árbol eliminatorio depende de
 * tener standings en los 12 grupos y 8 mejores terceros. Rellenar todo eso por
 * UI en cada test sería lentísimo, así que se siembra directo en BD.
 *
 * Toca la BD directamente (import relativo de lib/db, sin alias @/, porque el
 * loader de Playwright no lee los paths de tsconfig). Es código de test.
 */
import { asc, eq } from 'drizzle-orm';

import {
  db,
  predictionsAwards,
  predictionsBestThirds,
  predictionsGroupMatches,
  predictionsGroupStandings,
  predictionsKnockout,
  teams,
  users,
} from '../../lib/db';

async function userIdByEmail(email: string): Promise<number> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (!row) {
    throw new Error(`seedStandings: no existe usuario con email ${email}`);
  }
  return row.id;
}

/**
 * Siembra el orden 1–4 de los 12 grupos (equipos en orden alfabético de code) y
 * los 8 mejores terceros (3.º de los grupos A–H, que forman la combinación
 * 'ABCDEFGH' del mapping). Con esto, los 16 cruces de 1/16 quedan totalmente
 * resolubles. Idempotente: reescribe el set completo del usuario.
 */
export async function seedStandingsAndThirds(email: string): Promise<void> {
  const userId = await userIdByEmail(email);

  const teamRows = await db
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.code));

  const byGroup = new Map<string, string[]>();
  for (const t of teamRows) {
    const list = byGroup.get(t.groupLetter) ?? [];
    list.push(t.code);
    byGroup.set(t.groupLetter, list);
  }

  const standings = [...byGroup.entries()].flatMap(([groupLetter, codes]) =>
    codes.slice(0, 4).map((teamCode, idx) => ({
      userId,
      groupLetter,
      position: idx + 1,
      teamCode,
    })),
  );

  // Mejores terceros = el 3.º de los grupos A–H (combinación 'ABCDEFGH').
  const thirdGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const bestThirds = thirdGroups.map((g, idx) => ({
    userId,
    position: idx + 1,
    teamCode: (byGroup.get(g) ?? [])[2],
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(predictionsGroupStandings)
      .where(eq(predictionsGroupStandings.userId, userId));
    await tx.insert(predictionsGroupStandings).values(standings);
    await tx
      .delete(predictionsBestThirds)
      .where(eq(predictionsBestThirds.userId, userId));
    await tx.insert(predictionsBestThirds).values(bestThirds);
  });
}

async function teamsByGroup(): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.code));
  const byGroup = new Map<string, string[]>();
  for (const t of rows) {
    const list = byGroup.get(t.groupLetter) ?? [];
    list.push(t.code);
    byGroup.set(t.groupLetter, list);
  }
  return byGroup;
}

/**
 * Siembra una porra COMPLETA y coherente: 72 marcadores, los 12 grupos
 * ordenados, 8 mejores terceros, los 32 cruces (todos ganados por equipos
 * clasificados), podio cuadrado con el bracket y 6 premios distintos. Pensada
 * para el e2e end-to-end de la sub-slice 4.8.
 *
 * Con `{ omitBallBronze: true }` deja un único hueco (el balón de bronce) para
 * probar que el footer pasa de INCOMPLETA a COMPLETA al rellenarlo por UI.
 */
export async function seedFullCoherentPorra(
  email: string,
  opts: { omitBallBronze?: boolean } = {},
): Promise<void> {
  await seedStandingsAndThirds(email);
  const userId = await userIdByEmail(email);
  const byGroup = await teamsByGroup();

  const a1 = byGroup.get('A')![0];
  const b1 = byGroup.get('B')![0];
  const c1 = byGroup.get('C')![0];

  // Marcadores de los 72 partidos de grupos (cualquier valor sirve).
  const groupMatches = Array.from({ length: 72 }, (_, i) => ({
    userId,
    matchId: i + 1,
    golesLocal: 1,
    golesVisitante: 0,
  }));

  // 32 cruces: campeón a1, subcampeón b1, 3.º c1; el resto los gana a1 (todos
  // clasificados, así que no disparan el aviso bracket↔grupos).
  const knockout: { userId: number; matchId: number; winnerTeamCode: string }[] =
    [];
  for (let id = 73; id <= 104; id++) {
    let winnerTeamCode = a1;
    if (id === 102) winnerTeamCode = b1; // semifinal cuyo perdedor no es campeón
    if (id === 103) winnerTeamCode = c1; // 3.º/4.º puesto
    knockout.push({ userId, matchId: id, winnerTeamCode });
  }

  const awards = [
    { userId, kind: 'champion' as const, teamCode: a1, playerName: null },
    { userId, kind: 'runner_up' as const, teamCode: b1, playerName: null },
    { userId, kind: 'third' as const, teamCode: c1, playerName: null },
    { userId, kind: 'boot_gold' as const, teamCode: null, playerName: 'Goleador 1' },
    { userId, kind: 'boot_silver' as const, teamCode: null, playerName: 'Goleador 2' },
    { userId, kind: 'boot_bronze' as const, teamCode: null, playerName: 'Goleador 3' },
    { userId, kind: 'ball_gold' as const, teamCode: null, playerName: 'Crack 1' },
    { userId, kind: 'ball_silver' as const, teamCode: null, playerName: 'Crack 2' },
    ...(opts.omitBallBronze
      ? []
      : [
          {
            userId,
            kind: 'ball_bronze' as const,
            teamCode: null,
            playerName: 'Crack 3',
          },
        ]),
  ];

  await db.transaction(async (tx) => {
    await tx
      .delete(predictionsGroupMatches)
      .where(eq(predictionsGroupMatches.userId, userId));
    await tx.insert(predictionsGroupMatches).values(groupMatches);
    await tx
      .delete(predictionsKnockout)
      .where(eq(predictionsKnockout.userId, userId));
    await tx.insert(predictionsKnockout).values(knockout);
    await tx
      .delete(predictionsAwards)
      .where(eq(predictionsAwards.userId, userId));
    await tx.insert(predictionsAwards).values(awards);
  });
}
