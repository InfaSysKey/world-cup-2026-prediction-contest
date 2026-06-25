// Resuelve `matches.home_team_code` y `away_team_code` para los 32 cruces
// eliminatorios, a partir del estado de los oficiales:
//
//   - `actual_group_standings`: pares (group_letter, position 1..4) → team_code.
//   - `actual_best_thirds`: posiciones 1..8 → team_code (los 8 que pasan a 1/16).
//   - `matches.real_winner_team_code` + `home_team_code` + `away_team_code`:
//     ganadores y perdedores de matches anteriores ya finalizados.
//
// Los formatos de slot_ref que aparecen en el seed (lib/db/seed/matches.ts):
//
//   "1X" / "2X"   — 1.º o 2.º de grupo X (X = A..L).
//   "3XYZW..."    — mejor tercero cuyo group_letter esté en {X,Y,Z,W,...}.
//                   Asumimos que solo UN tercero clasificado tiene su grupo en
//                   ese set (la FIFA define los 8 paquetes para que sea así).
//   "WNN"         — ganador (real_winner_team_code) del match con id NN.
//   "LNN"         — perdedor del match NN (home/away_team_code distinto al
//                   real_winner_team_code).
//
// Función pura: entra una "vista" de la BD, sale una lista de updates {matchId,
// home, away}. La capa de orquestación los aplica.

export type StandingsSource = {
  // Clave "X|N" → team_code, con X = group_letter en mayúscula, N = 1..4.
  byGroupAndPosition: ReadonlyMap<string, string>;
  // Mejores terceros indexados por posición 1..8.
  bestThirdsByPosition: ReadonlyMap<number, string>;
  // Catálogo equipo → grupo (necesario para resolver "3XYZ..." porque el
  // best_third no trae su group_letter en la tabla actual_best_thirds).
  teamGroupByCode: ReadonlyMap<string, string>;
};

export type KnockoutMatch = {
  id: number;
  homeSlotRef: string | null;
  awaySlotRef: string | null;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  realWinnerTeamCode: string | null;
};

export type SlotResolution =
  | { kind: 'resolved'; teamCode: string }
  | { kind: 'pending'; reason: PendingReason; detail?: string };

export type PendingReason =
  | 'NO_SLOT_REF' // home/away slot ref es null en BD
  | 'BAD_SLOT_FORMAT'
  | 'STANDING_NOT_AVAILABLE'
  | 'BEST_THIRD_NOT_AVAILABLE'
  | 'PREVIOUS_MATCH_NOT_FINISHED';

export type BracketUpdate = {
  matchId: number;
  homeTeamCode: string;
  awayTeamCode: string;
};

// Resuelve un slot_ref concreto contra el estado actual.
export function resolveSlotRef(
  slotRef: string | null,
  matchesById: ReadonlyMap<number, KnockoutMatch>,
  standings: StandingsSource,
): SlotResolution {
  if (!slotRef) {
    return { kind: 'pending', reason: 'NO_SLOT_REF' };
  }

  // Caso 1/2 de grupo: "1X" / "2X".
  const groupPosMatch = /^([12])([A-L])$/.exec(slotRef);
  if (groupPosMatch) {
    const position = Number(groupPosMatch[1]);
    const groupLetter = groupPosMatch[2];
    const code = standings.byGroupAndPosition.get(`${groupLetter}|${position}`);
    if (!code) {
      return {
        kind: 'pending',
        reason: 'STANDING_NOT_AVAILABLE',
        detail: slotRef,
      };
    }
    return { kind: 'resolved', teamCode: code };
  }

  // Mejor tercero "3ABCDF": grupo en el set indicado.
  const bestThirdMatch = /^3([A-L]{3,6})$/.exec(slotRef);
  if (bestThirdMatch) {
    const allowedGroups = new Set(bestThirdMatch[1].split(''));
    // Buscamos en los 8 mejores terceros aquel cuyo grupo esté en allowedGroups.
    // Importante: si todavía no se han cerrado los 8, devolvemos pending.
    let resolved: string | null = null;
    let pending = false;
    for (let pos = 1; pos <= 8; pos += 1) {
      const code = standings.bestThirdsByPosition.get(pos);
      if (!code) {
        pending = true;
        continue;
      }
      const group = standings.teamGroupByCode.get(code);
      if (group && allowedGroups.has(group)) {
        resolved = code;
        break;
      }
    }
    if (resolved) {
      return { kind: 'resolved', teamCode: resolved };
    }
    return {
      kind: 'pending',
      reason: pending ? 'BEST_THIRD_NOT_AVAILABLE' : 'STANDING_NOT_AVAILABLE',
      detail: slotRef,
    };
  }

  // Ganador o perdedor de partido NN: "WNN" / "LNN".
  const winnerLoserMatch = /^([WL])(\d{1,3})$/.exec(slotRef);
  if (winnerLoserMatch) {
    const kind = winnerLoserMatch[1] as 'W' | 'L';
    const sourceMatchId = Number(winnerLoserMatch[2]);
    const sourceMatch = matchesById.get(sourceMatchId);
    if (
      !sourceMatch ||
      !sourceMatch.realWinnerTeamCode ||
      !sourceMatch.homeTeamCode ||
      !sourceMatch.awayTeamCode
    ) {
      return {
        kind: 'pending',
        reason: 'PREVIOUS_MATCH_NOT_FINISHED',
        detail: slotRef,
      };
    }
    if (kind === 'W') {
      return { kind: 'resolved', teamCode: sourceMatch.realWinnerTeamCode };
    }
    // Perdedor: el que NO es el ganador (uno de home/away).
    const loser =
      sourceMatch.realWinnerTeamCode === sourceMatch.homeTeamCode
        ? sourceMatch.awayTeamCode
        : sourceMatch.homeTeamCode;
    return { kind: 'resolved', teamCode: loser };
  }

  return {
    kind: 'pending',
    reason: 'BAD_SLOT_FORMAT',
    detail: slotRef,
  };
}

// Computa la lista de updates a aplicar sobre `matches`. Solo emite update si
// BOTH home y away son resoluble Y al menos uno de los dos cambia respecto a
// lo que ya hay en BD (para mantener idempotencia y no escribir sin razón).
export function computeBracketUpdates(
  knockoutMatches: readonly KnockoutMatch[],
  standings: StandingsSource,
): {
  updates: BracketUpdate[];
  pending: Array<{
    matchId: number;
    side: 'home' | 'away';
    slotRef: string | null;
    reason: PendingReason;
  }>;
} {
  const matchesById = new Map<number, KnockoutMatch>(
    knockoutMatches.map((m) => [m.id, m]),
  );
  const updates: BracketUpdate[] = [];
  const pending: ReturnType<typeof computeBracketUpdates>['pending'] = [];

  for (const m of knockoutMatches) {
    const home = resolveSlotRef(m.homeSlotRef, matchesById, standings);
    const away = resolveSlotRef(m.awaySlotRef, matchesById, standings);

    if (home.kind === 'pending') {
      pending.push({
        matchId: m.id,
        side: 'home',
        slotRef: m.homeSlotRef,
        reason: home.reason,
      });
    }
    if (away.kind === 'pending') {
      pending.push({
        matchId: m.id,
        side: 'away',
        slotRef: m.awaySlotRef,
        reason: away.reason,
      });
    }

    if (home.kind !== 'resolved' || away.kind !== 'resolved') {
      continue;
    }
    if (home.teamCode === m.homeTeamCode && away.teamCode === m.awayTeamCode) {
      continue; // ya está como toca, no hace falta update.
    }
    updates.push({
      matchId: m.id,
      homeTeamCode: home.teamCode,
      awayTeamCode: away.teamCode,
    });
  }

  return { updates, pending };
}
