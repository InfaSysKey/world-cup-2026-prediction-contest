import type { Phase } from '@/lib/db';

import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';

// Resolución del árbol de eliminatorias a partir de las predicciones del usuario
// (bracket RÍGIDO, ADR 0003). Es PURA: entra el catálogo de los 32 cruces más el
// orden de grupos, los mejores terceros y los ganadores ya elegidos; sale, por
// cada cruce, qué dos equipos lo disputan según las predicciones del propio
// usuario. La consume tanto la UI del bracket (sub-slice 4.5) como las
// validaciones cruzadas del resumen global (sub-slice 4.8).
//
// Cómo se resuelve cada lado de un cruce, según su slot_ref simbólico:
//   - `1X` / `2X`  → 1.º / 2.º del grupo X en predictions_group_standings.
//   - `3XXXXXX`    → mejor 3.º que el mapping del Excel asigna a ESE cruce de
//                    1/16, dado el conjunto de 8 grupos cuyos terceros clasifican
//                    según las predicciones del usuario (best-thirds-mapping.ts).
//   - `WnHmm`/`Wn` → ganador que el usuario predijo para el cruce n.
//   - `Ln`         → perdedor del cruce n (el lado que NO es su ganador predicho).
//
// Un lado que aún no se puede determinar (faltan predicciones aguas arriba)
// devuelve `teamCode: null`; la UI lo muestra como "pendiente" con la descripción
// derivada de `ref`.

export type KnockoutMatchRef = {
  id: number;
  phase: Phase;
  homeSlotRef: string;
  awaySlotRef: string;
};

export type StandingRef = {
  groupLetter: string;
  position: number;
  teamCode: string;
};

export type BestThirdRef = {
  position: number;
  teamCode: string;
};

export type KnockoutPickRef = {
  matchId: number;
  winnerTeamCode: string;
};

export type BracketSide = {
  // Equipo resuelto desde las predicciones del usuario, o null si todavía no se
  // puede determinar.
  teamCode: string | null;
  // Referencia simbólica original del slot (2A, 3ABCDF, W73, L101), para que la
  // UI describa el lado cuando teamCode es null.
  ref: string;
};

export type ResolvedMatch = {
  matchId: number;
  phase: Phase;
  home: BracketSide;
  away: BracketSide;
  // Ganador que el usuario predijo para este cruce (null si no ha elegido).
  pickedWinner: string | null;
};

export type ResolveBracketInput = {
  matches: readonly KnockoutMatchRef[];
  standings: readonly StandingRef[];
  bestThirds: readonly BestThirdRef[];
  knockout: readonly KnockoutPickRef[];
  // teamCode → groupLetter (catálogo `teams`).
  teamGroup: ReadonlyMap<string, string>;
};

const STANDING_REF = /^([12])([A-L])$/;
const THIRD_REF = /^3[A-L]+$/;
const WINNER_REF = /^W(\d+)$/;
const LOSER_REF = /^L(\d+)$/;

const BEST_THIRDS_GROUP_COUNT = 8;

export function resolveBracket(
  input: ResolveBracketInput,
): Map<number, ResolvedMatch> {
  const { matches, standings, bestThirds, knockout, teamGroup } = input;

  const standingByGroupPos = new Map<string, string>(
    standings.map((s) => [`${s.groupLetter}:${s.position}`, s.teamCode]),
  );
  const pickByMatch = new Map<number, string>(
    knockout.map((k) => [k.matchId, k.winnerTeamCode]),
  );
  const matchById = new Map<number, KnockoutMatchRef>(
    matches.map((m) => [m.id, m]),
  );

  // Mapa {matchId de 1/16 → grupo cuyo 3.º juega ahí}, solo si el usuario tiene
  // exactamente 8 mejores terceros de 8 grupos distintos (combinación válida del
  // Excel). En cualquier otro caso, los slots de 3.º quedan pendientes.
  const thirdGroups = bestThirds
    .map((b) => teamGroup.get(b.teamCode))
    .filter((g): g is string => g !== undefined);
  const uniqueThirdGroups = [...new Set(thirdGroups)];
  const thirdsCombo =
    uniqueThirdGroups.length === BEST_THIRDS_GROUP_COUNT
      ? (BEST_THIRDS_MAPPING[[...uniqueThirdGroups].sort().join('')] ?? null)
      : null;

  function resolveThirdForMatch(matchId: number): string | null {
    if (!thirdsCombo) {
      return null;
    }
    const group = thirdsCombo[matchId];
    if (!group) {
      return null;
    }
    return standingByGroupPos.get(`${group}:3`) ?? null;
  }

  const memo = new Map<number, ResolvedMatch>();

  function resolveSide(ref: string, ownMatchId: number): BracketSide {
    const standing = STANDING_REF.exec(ref);
    if (standing) {
      const [, position, group] = standing;
      return {
        teamCode: standingByGroupPos.get(`${group}:${position}`) ?? null,
        ref,
      };
    }

    if (THIRD_REF.test(ref)) {
      return { teamCode: resolveThirdForMatch(ownMatchId), ref };
    }

    const winner = WINNER_REF.exec(ref);
    if (winner) {
      return { teamCode: pickByMatch.get(Number(winner[1])) ?? null, ref };
    }

    const loser = LOSER_REF.exec(ref);
    if (loser) {
      const refId = Number(loser[1]);
      const refMatch = matchById.get(refId);
      const pick = pickByMatch.get(refId) ?? null;
      if (!refMatch || !pick) {
        return { teamCode: null, ref };
      }
      const sides = resolveMatch(refMatch);
      const { home, away } = sides;
      if (home.teamCode && away.teamCode) {
        if (pick === home.teamCode) {
          return { teamCode: away.teamCode, ref };
        }
        if (pick === away.teamCode) {
          return { teamCode: home.teamCode, ref };
        }
      }
      return { teamCode: null, ref };
    }

    return { teamCode: null, ref };
  }

  function resolveMatch(m: KnockoutMatchRef): ResolvedMatch {
    const cached = memo.get(m.id);
    if (cached) {
      return cached;
    }
    const resolved: ResolvedMatch = {
      matchId: m.id,
      phase: m.phase,
      home: resolveSide(m.homeSlotRef, m.id),
      away: resolveSide(m.awaySlotRef, m.id),
      pickedWinner: pickByMatch.get(m.id) ?? null,
    };
    memo.set(m.id, resolved);
    return resolved;
  }

  for (const m of matches) {
    resolveMatch(m);
  }
  return memo;
}
