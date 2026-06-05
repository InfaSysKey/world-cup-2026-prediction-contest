import { existsSync } from 'node:fs';

// En desarrollo y en scripts de CLI cargamos `.env` con la API nativa de Node
// (Node 20.12+). En producción las variables vienen inyectadas por el runtime y
// no hay fichero `.env`, así que el `existsSync` evita tocar nada.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y rellénala.`,
    );
  }
  return value;
}
