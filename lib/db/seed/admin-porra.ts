// Script ad-hoc: rellena una porra completa y coherente para el usuario admin.
// Uso: npx tsx lib/db/seed/admin-porra.ts
//
// Reemplaza por completo las predicciones del admin (todas las categorías) por
// un set consistente: los marcadores de grupo reproducen el orden de standings;
// los mejores terceros son una combinación válida del mapping (BCEFHIJL); el
// bracket avanza coherentemente con esos picks; el podio sale del bracket.

import { eq } from 'drizzle-orm';

import { db } from '../index';
import {
  predictionsAwards,
  predictionsBestThirds,
  predictionsGroupMatches,
  predictionsGroupStandings,
  predictionsKnockout,
  users,
} from '../schema';

// --- Standings por grupo (1.º, 2.º, 3.º, 4.º) ---
const STANDINGS: Record<string, [string, string, string, string]> = {
  A: ['MEX', 'KOR', 'CZE', 'ZAF'],
  B: ['CHE', 'CAN', 'BIH', 'QAT'],
  C: ['BRA', 'MAR', 'SCO', 'HTI'],
  D: ['USA', 'TUR', 'PRY', 'AUS'],
  E: ['DEU', 'ECU', 'CIV', 'CUW'],
  F: ['NLD', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'URY', 'SAU', 'CPV'],
  I: ['FRA', 'NOR', 'SEN', 'IRQ'],
  J: ['ARG', 'AUT', 'DZA', 'JOR'],
  K: ['PRT', 'COL', 'COD', 'UZB'],
  L: ['ENG', 'HRV', 'GHA', 'PAN'],
};

function rankOf(group: string, code: string): number {
  return STANDINGS[group].indexOf(code) + 1; // 1..4
}

// Marcador "natural" dado el rank de local y visitante. El equipo de mejor rank
// gana por margen estrecho; las diferencias grandes (1 vs 4) tienen marcador más
// abierto. Es invención plausible para una porra de muestra.
function scoreFor(
  homeRank: number,
  awayRank: number,
): [number, number] {
  if (homeRank === awayRank) return [1, 1];
  const diff = awayRank - homeRank; // positivo = local mejor
  if (diff === 1) return [2, 1];
  if (diff === 2) return [2, 0];
  if (diff === 3) return [3, 0];
  if (diff === -1) return [1, 2];
  if (diff === -2) return [0, 2];
  if (diff === -3) return [0, 3];
  return [1, 1];
}

// Catálogo de partidos de grupo (id → grupo, local, visitante). Hardcodeado
// desde la BD para no depender del orden de seed.
const GROUP_MATCHES: Array<{
  id: number;
  group: string;
  home: string;
  away: string;
}> = [
  { id: 1, group: 'A', home: 'MEX', away: 'ZAF' },
  { id: 2, group: 'A', home: 'KOR', away: 'CZE' },
  { id: 25, group: 'A', home: 'CZE', away: 'ZAF' },
  { id: 28, group: 'A', home: 'MEX', away: 'KOR' },
  { id: 53, group: 'A', home: 'CZE', away: 'MEX' },
  { id: 54, group: 'A', home: 'ZAF', away: 'KOR' },
  { id: 3, group: 'B', home: 'CAN', away: 'BIH' },
  { id: 8, group: 'B', home: 'QAT', away: 'CHE' },
  { id: 26, group: 'B', home: 'CHE', away: 'BIH' },
  { id: 27, group: 'B', home: 'CAN', away: 'QAT' },
  { id: 51, group: 'B', home: 'CHE', away: 'CAN' },
  { id: 52, group: 'B', home: 'BIH', away: 'QAT' },
  { id: 5, group: 'C', home: 'HTI', away: 'SCO' },
  { id: 7, group: 'C', home: 'BRA', away: 'MAR' },
  { id: 29, group: 'C', home: 'BRA', away: 'HTI' },
  { id: 30, group: 'C', home: 'SCO', away: 'MAR' },
  { id: 49, group: 'C', home: 'SCO', away: 'BRA' },
  { id: 50, group: 'C', home: 'MAR', away: 'HTI' },
  { id: 4, group: 'D', home: 'USA', away: 'PRY' },
  { id: 6, group: 'D', home: 'AUS', away: 'TUR' },
  { id: 31, group: 'D', home: 'TUR', away: 'PRY' },
  { id: 32, group: 'D', home: 'USA', away: 'AUS' },
  { id: 59, group: 'D', home: 'TUR', away: 'USA' },
  { id: 60, group: 'D', home: 'PRY', away: 'AUS' },
  { id: 9, group: 'E', home: 'CIV', away: 'ECU' },
  { id: 10, group: 'E', home: 'DEU', away: 'CUW' },
  { id: 33, group: 'E', home: 'DEU', away: 'CIV' },
  { id: 34, group: 'E', home: 'ECU', away: 'CUW' },
  { id: 55, group: 'E', home: 'CUW', away: 'CIV' },
  { id: 56, group: 'E', home: 'ECU', away: 'DEU' },
  { id: 11, group: 'F', home: 'NLD', away: 'JPN' },
  { id: 12, group: 'F', home: 'SWE', away: 'TUN' },
  { id: 35, group: 'F', home: 'NLD', away: 'SWE' },
  { id: 36, group: 'F', home: 'TUN', away: 'JPN' },
  { id: 57, group: 'F', home: 'JPN', away: 'SWE' },
  { id: 58, group: 'F', home: 'TUN', away: 'NLD' },
  { id: 15, group: 'G', home: 'IRN', away: 'NZL' },
  { id: 16, group: 'G', home: 'BEL', away: 'EGY' },
  { id: 39, group: 'G', home: 'BEL', away: 'IRN' },
  { id: 40, group: 'G', home: 'NZL', away: 'EGY' },
  { id: 63, group: 'G', home: 'EGY', away: 'IRN' },
  { id: 64, group: 'G', home: 'NZL', away: 'BEL' },
  { id: 13, group: 'H', home: 'SAU', away: 'URY' },
  { id: 14, group: 'H', home: 'ESP', away: 'CPV' },
  { id: 37, group: 'H', home: 'URY', away: 'CPV' },
  { id: 38, group: 'H', home: 'ESP', away: 'SAU' },
  { id: 65, group: 'H', home: 'CPV', away: 'SAU' },
  { id: 66, group: 'H', home: 'URY', away: 'ESP' },
  { id: 17, group: 'I', home: 'FRA', away: 'SEN' },
  { id: 18, group: 'I', home: 'IRQ', away: 'NOR' },
  { id: 41, group: 'I', home: 'NOR', away: 'SEN' },
  { id: 42, group: 'I', home: 'FRA', away: 'IRQ' },
  { id: 61, group: 'I', home: 'NOR', away: 'FRA' },
  { id: 62, group: 'I', home: 'SEN', away: 'IRQ' },
  { id: 19, group: 'J', home: 'ARG', away: 'DZA' },
  { id: 20, group: 'J', home: 'AUT', away: 'JOR' },
  { id: 43, group: 'J', home: 'ARG', away: 'AUT' },
  { id: 44, group: 'J', home: 'JOR', away: 'DZA' },
  { id: 69, group: 'J', home: 'DZA', away: 'AUT' },
  { id: 70, group: 'J', home: 'JOR', away: 'ARG' },
  { id: 23, group: 'K', home: 'PRT', away: 'COD' },
  { id: 24, group: 'K', home: 'UZB', away: 'COL' },
  { id: 47, group: 'K', home: 'PRT', away: 'UZB' },
  { id: 48, group: 'K', home: 'COL', away: 'COD' },
  { id: 71, group: 'K', home: 'COL', away: 'PRT' },
  { id: 72, group: 'K', home: 'COD', away: 'UZB' },
  { id: 21, group: 'L', home: 'GHA', away: 'PAN' },
  { id: 22, group: 'L', home: 'ENG', away: 'HRV' },
  { id: 45, group: 'L', home: 'ENG', away: 'GHA' },
  { id: 46, group: 'L', home: 'PAN', away: 'HRV' },
  { id: 67, group: 'L', home: 'PAN', away: 'ENG' },
  { id: 68, group: 'L', home: 'HRV', away: 'GHA' },
];

// --- Mejores terceros (combinación BCEFHIJL, 8 grupos) ---
// Orden 1..8: ranking subjetivo de calidad de los 3.os.
const BEST_THIRDS: Array<[number, string]> = [
  [1, 'SCO'], // C
  [2, 'SEN'], // I
  [3, 'CIV'], // E
  [4, 'SWE'], // F
  [5, 'DZA'], // J
  [6, 'GHA'], // L
  [7, 'BIH'], // B
  [8, 'SAU'], // H
];

// --- Bracket (matchId → ganador) ---
// Coherente con los standings + mapping BCEFHIJL:
//   74:3C=SCO, 77:3F=SWE, 79:3E=CIV, 80:3I=SEN,
//   81:3B=BIH, 82:3H=SAU, 85:3J=DZA, 87:3L=GHA
const KNOCKOUT: Array<[number, string]> = [
  // 1/16
  [73, 'KOR'], //  2A vs 2B  → KOR vs CAN
  [74, 'DEU'], //  1E vs 3C  → DEU vs SCO
  [75, 'NLD'], //  1F vs 2C  → NLD vs MAR
  [76, 'BRA'], //  1C vs 2F  → BRA vs JPN
  [77, 'FRA'], //  1I vs 3F  → FRA vs SWE
  [78, 'NOR'], //  2E vs 2I  → ECU vs NOR
  [79, 'MEX'], //  1A vs 3E  → MEX vs CIV
  [80, 'ENG'], //  1L vs 3I  → ENG vs SEN
  [81, 'USA'], //  1D vs 3B  → USA vs BIH
  [82, 'BEL'], //  1G vs 3H  → BEL vs SAU
  [83, 'COL'], //  2K vs 2L  → COL vs HRV
  [84, 'ESP'], //  1H vs 2J  → ESP vs AUT
  [85, 'CHE'], //  1B vs 3J  → CHE vs DZA
  [86, 'ARG'], //  1J vs 2H  → ARG vs URY
  [87, 'PRT'], //  1K vs 3L  → PRT vs GHA
  [88, 'TUR'], //  2D vs 2G  → TUR vs EGY
  // 1/8
  [89, 'FRA'], //  W74 vs W77 → DEU vs FRA
  [90, 'NLD'], //  W73 vs W75 → KOR vs NLD
  [91, 'BRA'], //  W76 vs W78 → BRA vs NOR
  [92, 'ENG'], //  W79 vs W80 → MEX vs ENG
  [93, 'ESP'], //  W83 vs W84 → COL vs ESP
  [94, 'BEL'], //  W81 vs W82 → USA vs BEL
  [95, 'ARG'], //  W86 vs W88 → ARG vs TUR
  [96, 'PRT'], //  W85 vs W87 → CHE vs PRT
  // Cuartos
  [97, 'FRA'], //  W89 vs W90 → FRA vs NLD
  [98, 'ESP'], //  W93 vs W94 → ESP vs BEL
  [99, 'BRA'], //  W91 vs W92 → BRA vs ENG
  [100, 'ARG'], // W95 vs W96 → ARG vs PRT
  // Semis
  [101, 'ESP'], // W97 vs W98 → FRA vs ESP
  [102, 'ARG'], // W99 vs W100 → BRA vs ARG
  // 3-4 (perdedor de 101 vs perdedor de 102 = FRA vs BRA)
  [103, 'BRA'],
  // Final (W101 vs W102 = ESP vs ARG)
  [104, 'ESP'],
];

// --- Premios ---
const AWARDS: Array<{
  kind:
    | 'champion'
    | 'runner_up'
    | 'third'
    | 'boot_gold'
    | 'boot_silver'
    | 'boot_bronze'
    | 'ball_gold'
    | 'ball_silver'
    | 'ball_bronze';
  teamCode?: string;
  playerName?: string;
}> = [
  { kind: 'champion', teamCode: 'ESP' },
  { kind: 'runner_up', teamCode: 'ARG' },
  { kind: 'third', teamCode: 'BRA' },
  { kind: 'boot_gold', playerName: 'Lamine Yamal' },
  { kind: 'boot_silver', playerName: 'Lionel Messi' },
  { kind: 'boot_bronze', playerName: 'Vinicius Junior' },
  { kind: 'ball_gold', playerName: 'Lamine Yamal' },
  { kind: 'ball_silver', playerName: 'Pedri' },
  { kind: 'ball_bronze', playerName: 'Lionel Messi' },
];

async function main() {
  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, 'admin@porra.local'));
  if (!admin) {
    throw new Error('No existe el usuario admin@porra.local.');
  }
  const userId = admin.id;
  console.log(`✓ Admin encontrado (id=${userId})`);

  // 1. Limpiar predicciones previas
  await db
    .delete(predictionsGroupMatches)
    .where(eq(predictionsGroupMatches.userId, userId));
  await db
    .delete(predictionsGroupStandings)
    .where(eq(predictionsGroupStandings.userId, userId));
  await db
    .delete(predictionsBestThirds)
    .where(eq(predictionsBestThirds.userId, userId));
  await db
    .delete(predictionsKnockout)
    .where(eq(predictionsKnockout.userId, userId));
  await db.delete(predictionsAwards).where(eq(predictionsAwards.userId, userId));
  console.log('✓ Predicciones previas borradas');

  // 2. Marcadores de fase de grupos
  const groupMatchRows = GROUP_MATCHES.map((m) => {
    const hr = rankOf(m.group, m.home);
    const ar = rankOf(m.group, m.away);
    const [gl, gv] = scoreFor(hr, ar);
    return {
      userId,
      matchId: m.id,
      golesLocal: gl,
      golesVisitante: gv,
    };
  });
  await db.insert(predictionsGroupMatches).values(groupMatchRows);
  console.log(`✓ ${groupMatchRows.length} marcadores de grupo`);

  // 3. Orden de grupos
  const standingRows = Object.entries(STANDINGS).flatMap(([letter, teams]) =>
    teams.map((teamCode, idx) => ({
      userId,
      groupLetter: letter,
      position: idx + 1,
      teamCode,
    })),
  );
  await db.insert(predictionsGroupStandings).values(standingRows);
  console.log(`✓ ${standingRows.length} posiciones de grupos`);

  // 4. Mejores terceros
  const bestThirdsRows = BEST_THIRDS.map(([position, teamCode]) => ({
    userId,
    position,
    teamCode,
  }));
  await db.insert(predictionsBestThirds).values(bestThirdsRows);
  console.log(`✓ ${bestThirdsRows.length} mejores terceros`);

  // 5. Bracket
  const knockoutRows = KNOCKOUT.map(([matchId, winnerTeamCode]) => ({
    userId,
    matchId,
    winnerTeamCode,
  }));
  await db.insert(predictionsKnockout).values(knockoutRows);
  console.log(`✓ ${knockoutRows.length} cruces eliminatorios`);

  // 6. Premios
  const awardRows = AWARDS.map((a) => ({
    userId,
    kind: a.kind,
    teamCode: a.teamCode ?? null,
    playerName: a.playerName ?? null,
  }));
  await db.insert(predictionsAwards).values(awardRows);
  console.log(`✓ ${awardRows.length} premios`);

  console.log('\n✅ Porra completa del admin generada.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
