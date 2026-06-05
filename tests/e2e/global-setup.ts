import { execSync } from 'node:child_process';

// Garantiza que el admin de bootstrap existe antes de los tests. Es idempotente
// (admin-bootstrap.ts no duplica si ya existe). Asume migraciones ya aplicadas.
export default function globalSetup(): void {
  execSync('npm run admin:bootstrap', { stdio: 'inherit' });
}
