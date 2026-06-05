import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { requireEnv } from '../env';
import * as schema from './schema';

export const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') });

export const db = drizzle(pool, { schema });

export * from './schema';

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Team = typeof schema.teams.$inferSelect;
export type NewTeam = typeof schema.teams.$inferInsert;
export type Match = typeof schema.matches.$inferSelect;
export type NewMatch = typeof schema.matches.$inferInsert;
