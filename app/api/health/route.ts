import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

// Health check para el deploy y el smoke test. Verifica que la BD responde,
// no solo que el proceso vive. En lista blanca de rutas públicas
// (lib/auth/public-routes.ts), no requiere auth.
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({
      status: 'ok',
      db: 'ok',
      ts: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: 'degraded', db: 'error' }, { status: 503 });
  }
}
