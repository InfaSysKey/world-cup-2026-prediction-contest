import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums-as-const (data-model.md §7). Representados como `text` + constante TS;
// la validación de pertenencia vive en zod, no en un enum de Postgres.
// ---------------------------------------------------------------------------

export const PHASES = [
  'grupos',
  '1/16',
  '1/8',
  'cuartos',
  'semi',
  '3-4',
  'final',
] as const;
export type Phase = (typeof PHASES)[number];

export const JORNADAS = ['J1', 'J2', 'J3'] as const;
export type Jornada = (typeof JORNADAS)[number];

export const MATCH_STATUSES = [
  'scheduled',
  'live',
  'finished',
  'cancelled',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const AWARD_KINDS = [
  'champion',
  'runner_up',
  'third',
  'boot_gold',
  'boot_silver',
  'boot_bronze',
  'ball_gold',
  'ball_silver',
  'ball_bronze',
] as const;
export type AwardKind = (typeof AWARD_KINDS)[number];

export const SCORE_CATEGORIES = [
  'group_matches',
  'group_standings',
  'best_thirds',
  'bracket',
  'podium',
  'awards',
  'penalties',
] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

// Columnas temporales compartidas.
const createdAt = timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

// ===========================================================================
// Zona Identidad
// ===========================================================================

export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    nombre: text('nombre').notNull(),
    apellidos: text('apellidos').notNull(),
    nickname: text('nickname').notNull(),
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_users_email').on(t.email),
    unique('uq_users_nickname').on(t.nickname),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt,
  },
  (t) => [
    index('idx_sessions_user_id').on(t.userId),
    index('idx_sessions_expires_at').on(t.expiresAt),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    token: text('token').notNull(),
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    usedBy: bigint('used_by', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt,
  },
  (t) => [
    unique('uq_invitations_token').on(t.token),
    index('idx_invitations_active')
      .on(t.expiresAt)
      .where(sql`${t.usedBy} is null`),
  ],
);

// ===========================================================================
// Zona Catálogo del torneo
// ===========================================================================

export const teams = pgTable(
  'teams',
  {
    code: text('code').primaryKey(),
    nameEs: text('name_es').notNull(),
    flagEmoji: text('flag_emoji').notNull(),
    groupLetter: text('group_letter').notNull(),
    createdAt,
  },
  (t) => [index('idx_teams_group_letter').on(t.groupLetter)],
);

export const matches = pgTable(
  'matches',
  {
    id: smallint('id').primaryKey(),
    phase: text('phase', { enum: PHASES }).notNull(),
    groupLetter: text('group_letter'),
    jornada: text('jornada', { enum: JORNADAS }),
    bracketSlot: text('bracket_slot'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    homeTeamCode: text('home_team_code').references(() => teams.code, {
      onDelete: 'restrict',
    }),
    awayTeamCode: text('away_team_code').references(() => teams.code, {
      onDelete: 'restrict',
    }),
    homeSlotRef: text('home_slot_ref'),
    awaySlotRef: text('away_slot_ref'),
    realGolesLocal: smallint('real_goles_local'),
    realGolesVisitante: smallint('real_goles_visitante'),
    realWinnerTeamCode: text('real_winner_team_code').references(
      () => teams.code,
      { onDelete: 'restrict' },
    ),
    status: text('status', { enum: MATCH_STATUSES })
      .notNull()
      .default('scheduled'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('idx_matches_phase').on(t.phase),
    index('idx_matches_group_letter').on(t.groupLetter),
    index('idx_matches_scheduled_at').on(t.scheduledAt),
    index('idx_matches_bracket_slot').on(t.bracketSlot),
    check(
      'chk_matches_score_non_negative',
      sql`(${t.realGolesLocal} is null or ${t.realGolesLocal} >= 0) and (${t.realGolesVisitante} is null or ${t.realGolesVisitante} >= 0)`,
    ),
  ],
);

// ===========================================================================
// Zona Predicciones del usuario
// ===========================================================================

export const predictionsGroupMatches = pgTable(
  'predictions_group_matches',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: smallint('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
    golesLocal: smallint('goles_local').notNull(),
    golesVisitante: smallint('goles_visitante').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_pred_group_matches_user_match').on(t.userId, t.matchId),
    index('idx_pred_group_matches_user_id').on(t.userId),
    index('idx_pred_group_matches_match_id').on(t.matchId),
  ],
);

export const predictionsGroupStandings = pgTable(
  'predictions_group_standings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupLetter: text('group_letter').notNull(),
    position: smallint('position').notNull(),
    teamCode: text('team_code')
      .notNull()
      .references(() => teams.code, { onDelete: 'restrict' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_pred_group_standings_user_group_pos').on(
      t.userId,
      t.groupLetter,
      t.position,
    ),
    unique('uq_pred_group_standings_user_group_team').on(
      t.userId,
      t.groupLetter,
      t.teamCode,
    ),
    index('idx_pred_group_standings_user_id').on(t.userId),
    index('idx_pred_group_standings_group_letter').on(t.groupLetter),
    check(
      'chk_pred_group_standings_position',
      sql`${t.position} between 1 and 4`,
    ),
  ],
);

export const predictionsBestThirds = pgTable(
  'predictions_best_thirds',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    teamCode: text('team_code')
      .notNull()
      .references(() => teams.code, { onDelete: 'restrict' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_pred_best_thirds_user_position').on(t.userId, t.position),
    unique('uq_pred_best_thirds_user_team').on(t.userId, t.teamCode),
    index('idx_pred_best_thirds_user_id').on(t.userId),
    check('chk_pred_best_thirds_position', sql`${t.position} between 1 and 8`),
  ],
);

export const predictionsKnockout = pgTable(
  'predictions_knockout',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: smallint('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
    winnerTeamCode: text('winner_team_code')
      .notNull()
      .references(() => teams.code, { onDelete: 'restrict' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_pred_knockout_user_match').on(t.userId, t.matchId),
    index('idx_pred_knockout_user_id').on(t.userId),
    index('idx_pred_knockout_match_id').on(t.matchId),
  ],
);

export const predictionsAwards = pgTable(
  'predictions_awards',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: AWARD_KINDS }).notNull(),
    teamCode: text('team_code').references(() => teams.code, {
      onDelete: 'restrict',
    }),
    playerName: text('player_name'),
    createdAt,
    updatedAt,
  },
  (t) => [
    unique('uq_pred_awards_user_kind').on(t.userId, t.kind),
    index('idx_pred_awards_user_id').on(t.userId),
  ],
);

// ===========================================================================
// Zona Resultados oficiales y puntuación
// ===========================================================================

export const actualGroupStandings = pgTable(
  'actual_group_standings',
  {
    groupLetter: text('group_letter').notNull(),
    position: smallint('position').notNull(),
    teamCode: text('team_code')
      .notNull()
      .references(() => teams.code, { onDelete: 'restrict' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    primaryKey({
      name: 'pk_actual_group_standings',
      columns: [t.groupLetter, t.position],
    }),
    check('chk_actual_group_standings_position', sql`${t.position} between 1 and 4`),
  ],
);

export const actualBestThirds = pgTable(
  'actual_best_thirds',
  {
    position: smallint('position').primaryKey(),
    teamCode: text('team_code')
      .notNull()
      .references(() => teams.code, { onDelete: 'restrict' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    check('chk_actual_best_thirds_position', sql`${t.position} between 1 and 8`),
  ],
);

export const actualAwards = pgTable('actual_awards', {
  kind: text('kind', { enum: AWARD_KINDS }).primaryKey(),
  teamCode: text('team_code').references(() => teams.code, {
    onDelete: 'restrict',
  }),
  playerName: text('player_name'),
  createdAt,
  updatedAt,
});

export const scores = pgTable(
  'scores',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category', { enum: SCORE_CATEGORIES }).notNull(),
    points: integer('points').notNull().default(0),
    detail: jsonb('detail').notNull().default({}),
    calculatedAt: timestamp('calculated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('uq_scores_user_category').on(t.userId, t.category)],
);

export const scoreRecalculations = pgTable(
  'score_recalculations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    triggeredBy: bigint('triggered_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    affectedCategories: text('affected_categories').array().notNull(),
    usersAffected: integer('users_affected').notNull(),
    createdAt,
  },
  (t) => [index('idx_score_recalculations_triggered_by').on(t.triggeredBy)],
);

// ===========================================================================
// Relations (joins tipados — data-model.md §7)
// ===========================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  invitationsCreated: many(invitations, { relationName: 'createdBy' }),
  predictionsGroupMatches: many(predictionsGroupMatches),
  predictionsGroupStandings: many(predictionsGroupStandings),
  predictionsBestThirds: many(predictionsBestThirds),
  predictionsKnockout: many(predictionsKnockout),
  predictionsAwards: many(predictionsAwards),
  scores: many(scores),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  createdByUser: one(users, {
    fields: [invitations.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
  usedByUser: one(users, {
    fields: [invitations.usedBy],
    references: [users.id],
    relationName: 'usedBy',
  }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: 'homeTeam' }),
  awayMatches: many(matches, { relationName: 'awayTeam' }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [matches.homeTeamCode],
    references: [teams.code],
    relationName: 'homeTeam',
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamCode],
    references: [teams.code],
    relationName: 'awayTeam',
  }),
  groupMatchPredictions: many(predictionsGroupMatches),
  knockoutPredictions: many(predictionsKnockout),
}));

export const predictionsGroupMatchesRelations = relations(
  predictionsGroupMatches,
  ({ one }) => ({
    user: one(users, {
      fields: [predictionsGroupMatches.userId],
      references: [users.id],
    }),
    match: one(matches, {
      fields: [predictionsGroupMatches.matchId],
      references: [matches.id],
    }),
  }),
);

export const predictionsKnockoutRelations = relations(
  predictionsKnockout,
  ({ one }) => ({
    user: one(users, {
      fields: [predictionsKnockout.userId],
      references: [users.id],
    }),
    match: one(matches, {
      fields: [predictionsKnockout.matchId],
      references: [matches.id],
    }),
  }),
);

export const scoresRelations = relations(scores, ({ one }) => ({
  user: one(users, { fields: [scores.userId], references: [users.id] }),
}));
