'use client';

import { useMemo, useState } from 'react';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import {
  GroupMatchesTab,
  type ScoreMap,
} from '@/components/porra/group-matches-tab';
import { GroupStandingsTab } from '@/components/porra/group-standings-tab';
import type { GroupTeamsCatalog } from '@/app/(porra)/porra/load-group-teams';
import type { PredictionGroupMatch, PredictionGroupStanding } from '@/lib/db';
import {
  computeGroupPoints,
  findTiedBlocks,
  type GroupMatchScoreInput,
} from '@/lib/scoring/group-table';

type GruposTabProps = {
  matchesCatalog: GroupCatalog[];
  teamsCatalog: GroupTeamsCatalog[];
  initialMatches: PredictionGroupMatch[];
  initialStandings: PredictionGroupStanding[];
  matchesLocked: boolean;
  standingsLocked: boolean;
};

function buildInitialScores(initial: PredictionGroupMatch[]): ScoreMap {
  const map: ScoreMap = {};
  for (const p of initial) {
    map[p.matchId] = {
      local: String(p.golesLocal),
      visitante: String(p.golesVisitante),
    };
  }
  return map;
}

function parseCell(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// El contenedor del tab "Grupos" sube el estado de los marcadores para poder
// detectar en vivo los empates a puntos de cada grupo y alimentar el desempate
// del orden de grupo (scoring-rules.md §2.3). Mientras un grupo no tenga sus 6
// marcadores completos, no se ofrece desempate (los puntos serían parciales).
export function GruposTab({
  matchesCatalog,
  teamsCatalog,
  initialMatches,
  initialStandings,
  matchesLocked,
  standingsLocked,
}: GruposTabProps) {
  const [scores, setScores] = useState<ScoreMap>(() =>
    buildInitialScores(initialMatches),
  );

  const teamCodesByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of teamsCatalog) {
      map.set(
        group.groupLetter,
        group.teams.map((t) => t.code),
      );
    }
    return map;
  }, [teamsCatalog]);

  const tiedBlocksByGroup = useMemo(() => {
    const result: Record<string, string[][]> = {};
    for (const group of matchesCatalog) {
      const teamCodes = teamCodesByGroup.get(group.groupLetter) ?? [];
      const inputs: GroupMatchScoreInput[] = group.matches.map((m) => ({
        homeCode: m.homeCode,
        awayCode: m.awayCode,
        golesLocal: parseCell(scores[m.id]?.local),
        golesVisitante: parseCell(scores[m.id]?.visitante),
      }));
      const complete =
        group.matches.length > 0 &&
        inputs.every(
          (i) => i.golesLocal !== null && i.golesVisitante !== null,
        );
      result[group.groupLetter] = complete
        ? findTiedBlocks(computeGroupPoints(teamCodes, inputs))
        : [];
    }
    return result;
  }, [matchesCatalog, teamCodesByGroup, scores]);

  return (
    <div data-testid="grupos-tab" className="flex flex-col gap-8">
      <GroupMatchesTab
        catalog={matchesCatalog}
        initial={initialMatches}
        locked={matchesLocked}
        onValuesChange={setScores}
      />

      <div className="border-t border-zinc-200 pt-6">
        <h2 className="mb-3 text-base font-semibold text-zinc-800">
          Orden de cada grupo
        </h2>
        <GroupStandingsTab
          catalog={teamsCatalog}
          initial={initialStandings}
          tiedBlocksByGroup={tiedBlocksByGroup}
          locked={standingsLocked}
        />
      </div>
    </div>
  );
}
