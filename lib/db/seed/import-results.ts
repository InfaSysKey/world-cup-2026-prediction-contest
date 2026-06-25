// Script CLI para importar resultados oficiales desde openfootball/worldcup.json.
// Reusa el orquestador `lib/results-importer/importer.ts`, así que la lógica
// es la misma en CLI manual y en el cron diario.
//
// Uso:
//   npx tsx lib/db/seed/import-results.ts            (dry-run por defecto)
//   npx tsx lib/db/seed/import-results.ts --apply
//   npx tsx lib/db/seed/import-results.ts --apply --reason "Texto libre"
//
// El admin que dispara el recálculo se deriva automáticamente del primer
// usuario con `is_admin = true`. La fila de auditoría queda en
// `score_recalculations` para la línea histórica de deltas del ranking.
//
// Comportamiento idempotente: relanzar dos veces no produce escrituras
// adicionales si openfootball no ha cambiado.

import { eq } from 'drizzle-orm';

import { db, users } from '@/lib/db';
import { importResults } from '@/lib/results-importer/importer';

function parseArgs(): { dryRun: boolean; reason: string } {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const reasonIdx = args.indexOf('--reason');
  const reason =
    reasonIdx !== -1 && args[reasonIdx + 1]
      ? args[reasonIdx + 1]
      : 'Importer openfootball (cron diario)';
  return { dryRun, reason };
}

async function main(): Promise<void> {
  const { dryRun, reason } = parseArgs();

  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);
  if (!admin) {
    console.error('No hay ningún usuario con is_admin=true en la BD.');
    process.exit(1);
  }

  console.log('=== Importer openfootball ===');
  console.log(`Modo:           ${dryRun ? 'dry-run (NO escribe)' : 'APPLY'}`);
  console.log(`Disparado por:  ${admin.email} (id=${admin.id})`);
  console.log(`Motivo:         ${reason}`);
  console.log('');

  const report = await importResults({
    dryRun,
    adminUserId: admin.id,
    reason,
  });

  console.log('--- Marcadores ---');
  console.log(`  Aplicados:                ${report.scoresApplied}`);
  console.log(`  Sin cambios (idem):       ${report.scoresAlreadyUpToDate}`);
  if (report.scoresSkipped.length) {
    console.log(`  Skipeados: ${report.scoresSkipped.length}`);
    for (const s of report.scoresSkipped.slice(0, 10)) {
      console.log(`    - ${s.matchHint}: ${s.reason}${s.detail ? ` (${s.detail})` : ''}`);
    }
    if (report.scoresSkipped.length > 10) {
      console.log(`    … (+${report.scoresSkipped.length - 10} más)`);
    }
  }

  console.log('');
  console.log('--- Standings de grupo ---');
  console.log(`  Cerrados esta corrida:    ${report.groupStandingsClosed.length}`);
  if (report.groupStandingsClosed.length) {
    console.log(`    → ${report.groupStandingsClosed.join(', ')}`);
  }
  if (report.groupStandingsPending.length) {
    console.log(`  Pendientes admin (sin desempate por tarjetas):`);
    for (const p of report.groupStandingsPending) {
      console.log(
        `    - Grupo ${p.groupLetter}: bloques empatados ${p.tied.map((b) => b.join('/')).join(' | ')}`,
      );
    }
  }

  console.log('');
  console.log('--- Mejores terceros ---');
  console.log(`  Cerrados:                 ${report.bestThirdsClosed ? 'sí' : 'no'}`);
  if (report.bestThirdsPending) {
    console.log(`  Pendiente: ${report.bestThirdsPending.reason}`);
    if (report.bestThirdsPending.tied) {
      console.log(
        `    bloque empatado: ${report.bestThirdsPending.tied.map((b) => b.join('/')).join(' | ')}`,
      );
    }
  }

  console.log('');
  console.log('--- Bracket ---');
  console.log(`  Cruces resueltos:         ${report.bracketAdvanced}`);
  console.log(`  Slots pendientes:         ${report.bracketPending}`);

  console.log('');
  console.log('--- Recálculo ---');
  console.log(`  Ejecutado:                ${report.recalcPerformed ? 'sí' : 'no (sin cambios o dry-run)'}`);
  console.log(`  Iteraciones consumidas:   ${report.iterations}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Importer FALLÓ:', err);
    process.exit(1);
  });
