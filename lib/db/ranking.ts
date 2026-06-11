import { desc, eq } from 'drizzle-orm';

import {
  db,
  scoreRecalculations,
  scores,
  SCORE_CATEGORIES,
  users,
  type ScoreCategory,
} from '@/lib/db';
import {
  extractRankingMetrics,
  type RankingPlayer,
  type ScoreRowInput,
} from '@/lib/scoring/ranking';

// Carga del ranking general (data-model.md §6.1). Excluye admins (§6.1). Devuelve,
// por usuario, las métricas que necesita el desempate de §7 (vía
// extractRankingMetrics) MÁS los puntos por categoría para las columnas de la
// tabla. El ordenado lo hace rankPlayers en la página: esto solo es la lectura.

export type RankingRow = {
  player: RankingPlayer;
  categoryPoints: Record<ScoreCategory, number>;
};

function emptyCategoryPoints(): Record<ScoreCategory, number> {
  const record = {} as Record<ScoreCategory, number>;
  for (const category of SCORE_CATEGORIES) {
    record[category] = 0;
  }
  return record;
}

export async function loadRanking(): Promise<RankingRow[]> {
  const [userRows, scoreRows] = await Promise.all([
    db
      .select({ id: users.id, nickname: users.nickname })
      .from(users)
      .where(eq(users.isAdmin, false)),
    db
      .select({
        userId: scores.userId,
        category: scores.category,
        points: scores.points,
        detail: scores.detail,
      })
      .from(scores),
  ]);

  const rowsByUser = new Map<number, ScoreRowInput[]>();
  const pointsByUser = new Map<number, Record<ScoreCategory, number>>();
  for (const row of scoreRows) {
    let accum = rowsByUser.get(row.userId);
    if (!accum) {
      accum = [];
      rowsByUser.set(row.userId, accum);
      pointsByUser.set(row.userId, emptyCategoryPoints());
    }
    accum.push({
      category: row.category,
      points: row.points,
      detail: row.detail,
    });
    pointsByUser.get(row.userId)![row.category] = row.points;
  }

  return userRows.map((u) => ({
    player: {
      userId: u.id,
      nickname: u.nickname,
      metrics: extractRankingMetrics(rowsByUser.get(u.id) ?? []),
    },
    categoryPoints: pointsByUser.get(u.id) ?? emptyCategoryPoints(),
  }));
}

// Snapshot de posiciones del recálculo ANTERIOR, base de los deltas ▲/▼
// (data-model §5.5). El más reciente refleja el ranking actual, así que la base
// es el penúltimo. null si aún no hay 2 recálculos (sin delta que mostrar).
export async function loadPreviousPositions(): Promise<Record<
  string,
  number
> | null> {
  const rows = await db
    .select({ positions: scoreRecalculations.positions })
    .from(scoreRecalculations)
    .orderBy(desc(scoreRecalculations.createdAt), desc(scoreRecalculations.id))
    .limit(2);
  return rows[1]?.positions ?? null;
}
