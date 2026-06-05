CREATE TABLE "actual_awards" (
	"kind" text PRIMARY KEY NOT NULL,
	"team_code" text,
	"player_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actual_best_thirds" (
	"position" smallint PRIMARY KEY NOT NULL,
	"team_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_actual_best_thirds_position" CHECK ("actual_best_thirds"."position" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "actual_group_standings" (
	"group_letter" text NOT NULL,
	"position" smallint NOT NULL,
	"team_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actual_group_standings_group_letter_position_pk" PRIMARY KEY("group_letter","position"),
	CONSTRAINT "chk_actual_group_standings_position" CHECK ("actual_group_standings"."position" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_by" bigint NOT NULL,
	"used_by" bigint,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" smallint PRIMARY KEY NOT NULL,
	"phase" text NOT NULL,
	"group_letter" text,
	"jornada" text,
	"bracket_slot" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"home_team_code" text,
	"away_team_code" text,
	"home_slot_ref" text,
	"away_slot_ref" text,
	"real_goles_local" smallint,
	"real_goles_visitante" smallint,
	"real_winner_team_code" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_matches_score_non_negative" CHECK (("matches"."real_goles_local" is null or "matches"."real_goles_local" >= 0) and ("matches"."real_goles_visitante" is null or "matches"."real_goles_visitante" >= 0))
);
--> statement-breakpoint
CREATE TABLE "predictions_awards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"team_code" text,
	"player_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pred_awards_user_kind" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "predictions_best_thirds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"team_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pred_best_thirds_user_position" UNIQUE("user_id","position"),
	CONSTRAINT "uq_pred_best_thirds_user_team" UNIQUE("user_id","team_code"),
	CONSTRAINT "chk_pred_best_thirds_position" CHECK ("predictions_best_thirds"."position" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "predictions_group_matches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"match_id" smallint NOT NULL,
	"goles_local" smallint NOT NULL,
	"goles_visitante" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pred_group_matches_user_match" UNIQUE("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "predictions_group_standings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"group_letter" text NOT NULL,
	"position" smallint NOT NULL,
	"team_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pred_group_standings_user_group_pos" UNIQUE("user_id","group_letter","position"),
	CONSTRAINT "uq_pred_group_standings_user_group_team" UNIQUE("user_id","group_letter","team_code"),
	CONSTRAINT "chk_pred_group_standings_position" CHECK ("predictions_group_standings"."position" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "predictions_knockout" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"match_id" smallint NOT NULL,
	"winner_team_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pred_knockout_user_match" UNIQUE("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "score_recalculations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"triggered_by" bigint NOT NULL,
	"reason" text NOT NULL,
	"affected_categories" text[] NOT NULL,
	"users_affected" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"category" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_scores_user_category" UNIQUE("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"code" text PRIMARY KEY NOT NULL,
	"name_es" text NOT NULL,
	"flag_emoji" text NOT NULL,
	"group_letter" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"nombre" text NOT NULL,
	"apellidos" text NOT NULL,
	"nickname" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_nickname_unique" UNIQUE("nickname")
);
--> statement-breakpoint
ALTER TABLE "actual_awards" ADD CONSTRAINT "actual_awards_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actual_best_thirds" ADD CONSTRAINT "actual_best_thirds_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actual_group_standings" ADD CONSTRAINT "actual_group_standings_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_code_teams_code_fk" FOREIGN KEY ("home_team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_code_teams_code_fk" FOREIGN KEY ("away_team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_real_winner_team_code_teams_code_fk" FOREIGN KEY ("real_winner_team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_awards" ADD CONSTRAINT "predictions_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_awards" ADD CONSTRAINT "predictions_awards_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_best_thirds" ADD CONSTRAINT "predictions_best_thirds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_best_thirds" ADD CONSTRAINT "predictions_best_thirds_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_group_matches" ADD CONSTRAINT "predictions_group_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_group_matches" ADD CONSTRAINT "predictions_group_matches_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_group_standings" ADD CONSTRAINT "predictions_group_standings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_group_standings" ADD CONSTRAINT "predictions_group_standings_team_code_teams_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_winner_team_code_teams_code_fk" FOREIGN KEY ("winner_team_code") REFERENCES "public"."teams"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_recalculations" ADD CONSTRAINT "score_recalculations_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invitations_active" ON "invitations" USING btree ("expires_at") WHERE "invitations"."used_by" is null;--> statement-breakpoint
CREATE INDEX "idx_matches_phase" ON "matches" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "idx_matches_group_letter" ON "matches" USING btree ("group_letter");--> statement-breakpoint
CREATE INDEX "idx_matches_scheduled_at" ON "matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_matches_bracket_slot" ON "matches" USING btree ("bracket_slot");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_teams_group_letter" ON "teams" USING btree ("group_letter");

-- ROLLBACK
-- DROP TABLE IF EXISTS "score_recalculations";
-- DROP TABLE IF EXISTS "scores";
-- DROP TABLE IF EXISTS "actual_awards";
-- DROP TABLE IF EXISTS "actual_best_thirds";
-- DROP TABLE IF EXISTS "actual_group_standings";
-- DROP TABLE IF EXISTS "predictions_awards";
-- DROP TABLE IF EXISTS "predictions_knockout";
-- DROP TABLE IF EXISTS "predictions_best_thirds";
-- DROP TABLE IF EXISTS "predictions_group_standings";
-- DROP TABLE IF EXISTS "predictions_group_matches";
-- DROP TABLE IF EXISTS "matches";
-- DROP TABLE IF EXISTS "teams";
-- DROP TABLE IF EXISTS "invitations";
-- DROP TABLE IF EXISTS "sessions";
-- DROP TABLE IF EXISTS "users";