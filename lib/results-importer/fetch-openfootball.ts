// Fetcher del JSON canónico de openfootball/worldcup.json (Mundial 2026).
// Sin auth, dominio público, raw de GitHub. La URL se exporta para que en
// tests pueda redirigirse a una fixture local. Política de errores: lanza
// si el HTTP falla, si el JSON no parsea, o si la forma no encaja con el
// schema; el orquestador decide cómo reportar.

import { logger } from '@/lib/logger';

import {
  type OpenfootballFile,
  openfootballFileSchema,
} from './openfootball-schema';

export const OPENFOOTBALL_WORLDCUP_2026_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// Timeout defensivo: GitHub raw es rápido, 15s es de sobra.
const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchOpenfootballOptions = {
  // Override de URL para tests u otras temporadas.
  url?: string;
  // Override de timeout (ms).
  timeoutMs?: number;
};

export async function fetchOpenfootball(
  options: FetchOpenfootballOptions = {},
): Promise<OpenfootballFile> {
  const url = options.url ?? OPENFOOTBALL_WORLDCUP_2026_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Forzamos no-cache: el cron diario quiere el JSON más reciente.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`openfootball HTTP ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as unknown;
    const parsed = openfootballFileSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error('openfootball schema mismatch', {
        url,
        issues: parsed.error.issues,
      });
      throw new Error(
        `JSON de openfootball no encaja con el schema: ${parsed.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .slice(0, 5)
          .join('; ')}`,
      );
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}
