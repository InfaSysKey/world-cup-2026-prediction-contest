import { execSync } from 'node:child_process';

// Prepara la BD para los tests. Ambos pasos son idempotentes (el seed no duplica
// y admin-bootstrap no recrea el admin si ya existe). Asume migraciones aplicadas.
// El seed es necesario para los tests de /admin/partidos (catálogo de partidos).
export default function globalSetup(): void {
  execSync('npm run db:seed', { stdio: 'inherit' });
  execSync('npm run admin:bootstrap', { stdio: 'inherit' });
}
