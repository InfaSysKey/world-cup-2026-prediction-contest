ALTER TABLE "score_recalculations" ADD COLUMN "positions" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- ROLLBACK
-- ALTER TABLE "score_recalculations" DROP COLUMN IF EXISTS "positions";
