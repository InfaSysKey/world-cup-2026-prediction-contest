import { TeamLabel } from '@/components/porra/team-label';
import { Card } from '@/components/ui/card';
import { GROUP_LETTERS } from '@/lib/constants';
import type { Phase } from '@/lib/db';
import type { UserPredictions } from '@/lib/predictions/types';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import type { KnockoutMatchRef } from '@/lib/scoring/resolve-bracket';

// Vista de SOLO LECTURA de una porra. Componente de presentación puro (server
// component): recibe predicciones ya cargadas + catálogo, no toca BD. Lo usan
// /mi-porra (porra propia, todo visible) y /usuario/[nickname] (porra de otro,
// donde las categorías no bloqueadas llegan vacías y se marcan con candado).

export type ReadonlyTeamMap = ReadonlyMap<
  string,
  { name: string; flagCode: string }
>;

export type PorraReadonlySection =
  | 'groupMatches'
  | 'groupStandings'
  | 'bestThirds'
  | 'knockout'
  | 'awards';

type Props = {
  predictions: UserPredictions;
  groupMatches: readonly GroupCatalog[];
  knockout: readonly KnockoutMatchRef[];
  teams: ReadonlyTeamMap;
  // Secciones ocultas por bloqueo (porra de otro aún sin desbloquear).
  hiddenSections?: ReadonlySet<PorraReadonlySection>;
};

const KNOCKOUT_PHASE_LABEL: Record<Exclude<Phase, 'grupos'>, string> = {
  '1/16': '1/16 de final',
  '1/8': 'Octavos',
  cuartos: 'Cuartos',
  semi: 'Semifinales',
  '3-4': '3.º y 4.º puesto',
  final: 'Final',
};

const KNOCKOUT_PHASE_ORDER: ReadonlyArray<Exclude<Phase, 'grupos'>> = [
  '1/16',
  '1/8',
  'cuartos',
  'semi',
  '3-4',
  'final',
];

const PODIUM_LABELS: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: 'champion', label: '🥇 Campeón' },
  { kind: 'runner_up', label: '🥈 Subcampeón' },
  { kind: 'third', label: '🥉 3.º puesto' },
];

const AWARD_LABELS: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: 'boot_gold', label: 'Bota de Oro' },
  { kind: 'boot_silver', label: 'Bota de Plata' },
  { kind: 'boot_bronze', label: 'Bota de Bronce' },
  { kind: 'ball_gold', label: 'Balón de Oro' },
  { kind: 'ball_silver', label: 'Balón de Plata' },
  { kind: 'ball_bronze', label: 'Balón de Bronce' },
];

function teamLabel(
  teams: ReadonlyTeamMap,
  code: string | null,
): React.ReactNode {
  if (!code) {
    return '—';
  }
  const team = teams.get(code);
  return team ? (
    <TeamLabel flagCode={team.flagCode} name={team.name} />
  ) : (
    code
  );
}

function Section({
  testId,
  title,
  hidden,
  empty,
  children,
}: {
  testId: string;
  title: string;
  hidden: boolean;
  empty: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card data-testid={testId} className="w-full max-w-3xl gap-3 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hidden ? (
        <p
          data-testid={`${testId}-locked`}
          className="text-sm text-muted-foreground"
        >
          🔒 Se desbloquea cuando empiece el torneo.
        </p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">Sin predicciones.</p>
      ) : (
        children
      )}
    </Card>
  );
}

export function PorraReadonly({
  predictions,
  groupMatches,
  knockout,
  teams,
  hiddenSections = new Set(),
}: Props) {
  const scoreByMatch = new Map(
    predictions.groupMatches.map((p) => [
      p.matchId,
      { local: p.golesLocal, visitante: p.golesVisitante },
    ]),
  );
  const standingByKey = new Map(
    predictions.groupStandings.map((p) => [
      `${p.groupLetter}:${p.position}`,
      p.teamCode,
    ]),
  );
  const thirdByPos = new Map(
    predictions.bestThirds.map((p) => [p.position, p.teamCode]),
  );
  const winnerByMatch = new Map(
    predictions.knockout.map((p) => [p.matchId, p.winnerTeamCode]),
  );
  // Marcador knockout predicho al 120' (scoring-rules.md §3.3 v2.0). Solo lo
  // tienen los registros importados desde Excel; los pre-v2.0 quedan en null y
  // no se muestra marcador.
  const koScoreByMatch = new Map<
    number,
    { golesLocal: number; golesVisitante: number }
  >();
  for (const p of predictions.knockout) {
    if (p.golesLocal !== null && p.golesVisitante !== null) {
      koScoreByMatch.set(p.matchId, {
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
      });
    }
  }
  const awardByKind = new Map<string, UserPredictions['awards'][number]>(
    predictions.awards.map((a) => [a.kind, a]),
  );
  const phaseByMatch = new Map(knockout.map((m) => [m.id, m.phase]));

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Section
        testId="ro-groupMatches"
        title="Marcadores de grupos"
        hidden={hiddenSections.has('groupMatches')}
        empty={predictions.groupMatches.length === 0}
      >
        <div className="flex flex-col gap-4">
          {groupMatches.map((group) => (
            <div key={group.groupLetter}>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Grupo {group.groupLetter}
              </h3>
              <ul className="flex flex-col gap-1 text-sm">
                {group.matches.map((m) => {
                  const score = scoreByMatch.get(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <TeamLabel flagCode={m.homeFlagCode} name={m.homeName} />
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">
                        {score ? `${score.local} - ${score.visitante}` : '— · —'}
                      </span>
                      <span className="flex min-w-0 justify-end">
                        <TeamLabel flagCode={m.awayFlagCode} name={m.awayName} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        testId="ro-groupStandings"
        title="Clasificación de grupos"
        hidden={hiddenSections.has('groupStandings')}
        empty={predictions.groupStandings.length === 0}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GROUP_LETTERS.map((letter) => (
            <div key={letter}>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                Grupo {letter}
              </h3>
              <ol className="text-sm">
                {[1, 2, 3, 4].map((pos) => (
                  <li key={pos} className="flex gap-2">
                    <span className="w-4 text-muted-foreground">{pos}.</span>
                    <span>{teamLabel(teams, standingByKey.get(`${letter}:${pos}`) ?? null)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section
        testId="ro-bestThirds"
        title="Mejores terceros"
        hidden={hiddenSections.has('bestThirds')}
        empty={predictions.bestThirds.length === 0}
      >
        <ol className="text-sm">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((pos) => (
            <li key={pos} className="flex gap-2">
              <span className="w-4 text-muted-foreground">{pos}.</span>
              <span>{teamLabel(teams, thirdByPos.get(pos) ?? null)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        testId="ro-knockout"
        title="Bracket eliminatorio"
        hidden={hiddenSections.has('knockout')}
        empty={predictions.knockout.length === 0}
      >
        <div className="flex flex-col gap-3">
          {KNOCKOUT_PHASE_ORDER.map((phase) => {
            const picks = predictions.knockout.filter(
              (p) => phaseByMatch.get(p.matchId) === phase,
            );
            if (picks.length === 0) {
              return null;
            }
            return (
              <div key={phase}>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  {KNOCKOUT_PHASE_LABEL[phase]}
                </h3>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {picks.map((p) => {
                    const score = koScoreByMatch.get(p.matchId);
                    return (
                      <li
                        key={p.matchId}
                        className="rounded bg-muted px-2 py-0.5"
                      >
                        {teamLabel(teams, winnerByMatch.get(p.matchId) ?? null)}
                        {score ? (
                          <span className="ml-1 tabular-nums text-muted-foreground">
                            ({score.golesLocal}-{score.golesVisitante})
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        testId="ro-awards"
        title="Podio y premios"
        hidden={hiddenSections.has('awards')}
        empty={predictions.awards.length === 0}
      >
        <div className="flex flex-col gap-3 text-sm">
          <ul className="flex flex-col gap-1">
            {PODIUM_LABELS.map(({ kind, label }) => (
              <li key={kind} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span>{teamLabel(teams, awardByKind.get(kind)?.teamCode ?? null)}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1">
            {AWARD_LABELS.map(({ kind, label }) => (
              <li key={kind} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span>{awardByKind.get(kind)?.playerName ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
