import { defineConfig } from 'drizzle-kit';

import { requireEnv } from './lib/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dbCredentials: { url: requireEnv('DATABASE_URL') },
  strict: true,
  verbose: true,
});
