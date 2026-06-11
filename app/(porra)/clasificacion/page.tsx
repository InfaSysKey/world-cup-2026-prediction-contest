import { redirect } from 'next/navigation';

import { RankingBoard, type BoardPlayer } from '@/components/porra/ranking-board';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadPreviousPositions, loadRanking } from '@/lib/db/ranking';
import type { ScoreCategory } from '@/lib/db';
import { rankPlayers } from '@/lib/scoring/ranking';

// Columnas de puntos por categoría (data-model.md §6.1). El total es la suma de
// las 7 filas de `scores`; las penalizaciones (§4) entran en negativo.
const CATEGORY_COLUMNS: ReadonlyArray<{
  category: ScoreCategory;
  label: string;
  full: string;
}> = [
  { category: 'group_matches', label: 'Gru', full: 'Marcadores de grupos' },
  { category: 'group_standings', label: 'Clf', full: 'Clasificación de grupos' },
  { category: 'best_thirds', label: '3.os', full: 'Mejores terceros' },
  { category: 'bracket', label: 'Brk', full: 'Bracket eliminatorio' },
  { category: 'podium', label: 'Pod', full: 'Cuadro de honor' },
  { category: 'awards', label: 'Prm', full: 'Premios individuales' },
  { category: 'penalties', label: 'Pen', full: 'Penalizaciones' },
];

// Posiciones ganadas (positivo) o perdidas (negativo) desde el recálculo previo.
// null si no hay snapshot anterior o el jugador no estaba en él (recién entrado).
function rankDelta(
  previous: Record<string, number> | null,
  userId: number,
  rank: number,
): number | null {
  const before = previous?.[String(userId)];
  return before === undefined ? null : before - rank;
}

export default async function ClasificacionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [rows, previousPositions] = await Promise.all([
    loadRanking(),
    loadPreviousPositions(),
  ]);
  const ranked = rankPlayers(rows.map((r) => r.player));
  const pointsByUser = new Map(
    rows.map((r) => [r.player.userId, r.categoryPoints]),
  );

  const players: BoardPlayer[] = ranked.map((p) => ({
    userId: p.userId,
    nickname: p.nickname,
    rank: p.rank,
    needsDraw: p.needsDraw,
    totalPoints: p.metrics.totalPoints,
    categoryPoints: pointsByUser.get(p.userId),
    delta: rankDelta(previousPositions, p.userId, p.rank),
  }));

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <p className="text-eyebrow mb-1">
          {ranked.length} {ranked.length === 1 ? 'participante' : 'participantes'}
        </p>
        <h1 className="text-display-l mb-2">Clasificación</h1>
        <p className="mb-5 text-sm text-ink-muted">
          El cromo brillante es de quien va primero. Los empates se rompen por
          desempate; si ni eso, queda pendiente de sorteo.
        </p>

        <RankingBoard players={players} meId={user.id} />

        {ranked.length > 0 ? (
          <details className="mt-8 rounded-[14px] border border-slot bg-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink">
              Ver desglose por categorías
            </summary>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-right">#</TableHead>
                    <TableHead>Jugador</TableHead>
                    {CATEGORY_COLUMNS.map((c) => (
                      <TableHead
                        key={c.category}
                        className="text-right"
                        title={c.full}
                      >
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((p) => {
                    const categoryPoints = pointsByUser.get(p.userId);
                    return (
                      <TableRow key={p.userId}>
                        <TableCell className="text-right tabular-nums text-ink-muted">
                          {p.rank}
                        </TableCell>
                        <TableCell>{p.nickname}</TableCell>
                        {CATEGORY_COLUMNS.map((c) => (
                          <TableCell
                            key={c.category}
                            className="text-right tabular-nums text-ink-muted"
                          >
                            {categoryPoints?.[c.category] ?? 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold tabular-nums">
                          {p.metrics.totalPoints}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
