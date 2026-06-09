import { redirect } from 'next/navigation';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadRanking } from '@/lib/db/ranking';
import type { ScoreCategory } from '@/lib/db';
import { cn } from '@/lib/utils';
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

export default async function ClasificacionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const rows = await loadRanking();
  const ranked = rankPlayers(rows.map((r) => r.player));
  const pointsByUser = new Map(
    rows.map((r) => [r.player.userId, r.categoryPoints]),
  );

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold">Clasificación</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Orden por puntos totales; los empates se resuelven con los criterios de
          desempate. Un{' '}
          <span className="font-medium text-foreground">empate</span> sin resolver
          queda pendiente de sorteo.
        </p>

        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay puntuaciones.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Jugador</TableHead>
                {CATEGORY_COLUMNS.map((c) => (
                  <TableHead key={c.category} className="text-right" title={c.full}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-right font-semibold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((p) => {
                const categoryPoints = pointsByUser.get(p.userId);
                const isMe = p.userId === user.id;
                return (
                  <TableRow
                    key={p.userId}
                    data-testid="ranking-row"
                    className={cn(isMe && 'bg-muted/60 font-medium')}
                  >
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.rank}
                    </TableCell>
                    <TableCell>
                      <span>{p.nickname}</span>
                      {p.needsDraw ? (
                        <span
                          className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                          title="Empate sin resolver: pendiente de sorteo público"
                        >
                          empate
                        </span>
                      ) : null}
                    </TableCell>
                    {CATEGORY_COLUMNS.map((c) => (
                      <TableCell
                        key={c.category}
                        className="text-right tabular-nums text-muted-foreground"
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
        )}
      </div>
    </main>
  );
}
