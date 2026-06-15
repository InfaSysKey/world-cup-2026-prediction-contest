ALTER TABLE "predictions_knockout" ADD COLUMN "goles_local" smallint;--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD COLUMN "goles_visitante" smallint;--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "chk_pred_knockout_goles_local_range" CHECK ("predictions_knockout"."goles_local" is null or ("predictions_knockout"."goles_local" between 0 and 20));--> statement-breakpoint
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "chk_pred_knockout_goles_visitante_range" CHECK ("predictions_knockout"."goles_visitante" is null or ("predictions_knockout"."goles_visitante" between 0 and 20));

-- ROLLBACK
-- ALTER TABLE "predictions_knockout" DROP CONSTRAINT IF EXISTS "chk_pred_knockout_goles_visitante_range";
-- ALTER TABLE "predictions_knockout" DROP CONSTRAINT IF EXISTS "chk_pred_knockout_goles_local_range";
-- ALTER TABLE "predictions_knockout" DROP COLUMN IF EXISTS "goles_visitante";
-- ALTER TABLE "predictions_knockout" DROP COLUMN IF EXISTS "goles_local";