// Script ad-hoc para capturar screenshots del README. NO es un test, NO entra
// en CI ni en `npm run e2e`. Se invoca a mano:
//
//   BASE_URL=https://porra.carlosdelcura.es                                    \
//   PORRA_USER=tu@email.com PORRA_PASS=tu-password                             \
//   PORRA_REDACT_NICKS="Nick1,Nick2,Nick3"                                     \
//   npx tsx scripts/capture-screenshots.ts
//
// - PORRA_USER/PORRA_PASS opcionales: si están, captura /porra, /clasificacion
//   y /admin/partidos. Si no, solo captura /login (página pública).
// - BASE_URL por defecto: http://localhost:3000.
// - PORRA_REDACT_NICKS opcional: lista separada por comas. Antes de cada
//   screenshot, sustituye en el DOM cada nick por "Jugador N" (N = posición
//   en la lista). Útil para producción donde se ven nicks reales.
//
// Salida en docs/screenshots/ con los nombres que el README espera.

import { chromium, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const USER = process.env.PORRA_USER;
const PASS = process.env.PORRA_PASS;
const REDACT_NICKS = (process.env.PORRA_REDACT_NICKS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Sustituye los nicks listados por "Jugador N" recorriendo todos los nodos
// de texto del DOM. Se ejecuta dentro del browser (page.evaluate), por eso
// el cuerpo no puede usar imports ni referencias del scope externo.
async function redactNicks(page: Page, nicks: readonly string[]): Promise<void> {
  if (nicks.length === 0) return;
  // Ordenamos por longitud descendente para que un nick más largo se
  // intente sustituir antes que uno más corto que sea prefijo (ej.
  // "FerranTorresLover" antes que "F.").
  const labelledNicks = nicks.map((nick, i) => ({
    nick,
    label: `Jugador ${i + 1}`,
    initials: `J${i + 1}`,
  }));
  const ordered = [...labelledNicks].sort(
    (a, b) => b.nick.length - a.nick.length,
  );

  await page.evaluate((toRedact) => {
    const escapeRegex = (s: string): string =>
      s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Para cada nick: matching case-sensitive, sin word-boundary al final
    // (para que "F." matchee aunque le siga espacio o coma).
    const replacements = toRedact.map(({ nick, label }) => ({
      regex: new RegExp(`(^|[^A-Za-z0-9_])${escapeRegex(nick)}(?![A-Za-z0-9_])`, 'g'),
      label,
    }));

    // 1.º pase: text nodes.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node: Node | null = walker.nextNode();
    while (node !== null) {
      let text = node.nodeValue ?? '';
      let changed = false;
      for (const { regex, label } of replacements) {
        const replaced = text.replace(regex, (_, pre: string) => `${pre}${label}`);
        if (replaced !== text) {
          text = replaced;
          changed = true;
        }
      }
      if (changed) node.nodeValue = text;
      node = walker.nextNode();
    }

    // 2.º pase: avatares. PlayerAvatar pinta 1-2 iniciales del nick;
    // si el texto del span coincide con esas iniciales, lo sustituimos
    // por la etiqueta corta (J1, J2, …).
    const initialReplacements = new Map<string, string>();
    for (const { nick, initials } of toRedact) {
      const ini = nick.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
      if (ini.length > 0) initialReplacements.set(ini, initials);
    }
    document.querySelectorAll('span, div').forEach((el) => {
      const txt = (el.textContent ?? '').trim();
      if (txt.length <= 2 && initialReplacements.has(txt.toUpperCase())) {
        el.textContent = initialReplacements.get(txt.toUpperCase())!;
      }
    });
  }, ordered);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina
  });

  // tsx (esbuild) inyecta `__name(fn, "name")` en el código transpilado para
  // preservar nombres de funciones tras la minificación. Ese helper vive en
  // Node, no en el navegador: cuando una función de TypeScript se pasa a
  // page.evaluate, su cuerpo serializado contiene `__name(...)` que el
  // browser desconoce → ReferenceError. Lo polifillamos como identidad antes
  // de cargar cualquier script de la página. Importante: el init script se
  // envía como STRING literal para evitar que tsx lo re-transforme y añada
  // referencias a __name dentro del propio polyfill (huevo-y-gallina).
  await ctx.addInitScript({
    content: `
      if (typeof globalThis.__name !== 'function') {
        globalThis.__name = function (target) { return target; };
      }
    `,
  });

  const page = await ctx.newPage();

  // --- /login (público) ---
  console.log(`==> /login`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // estabiliza animaciones
  // En /login no hay nicks que redactar, pero llamamos por consistencia.
  await redactNicks(page, REDACT_NICKS);
  await page.screenshot({
    path: path.join(OUT_DIR, '01-login.png'),
    fullPage: true,
  });

  if (!USER || !PASS) {
    console.log('PORRA_USER/PORRA_PASS no definidos → solo /login capturada.');
    await browser.close();
    return;
  }

  // --- login ---
  console.log(`==> autenticando como ${USER}`);
  await page.fill('input[name="email"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 10_000,
  });

  // --- /porra ---
  console.log(`==> /porra`);
  await page.goto(`${BASE_URL}/porra`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await redactNicks(page, REDACT_NICKS);
  await page.screenshot({
    path: path.join(OUT_DIR, '02-porra-form.png'),
    fullPage: true,
  });

  // --- /clasificacion ---
  console.log(`==> /clasificacion`);
  await page.goto(`${BASE_URL}/clasificacion`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await redactNicks(page, REDACT_NICKS);
  await page.screenshot({
    path: path.join(OUT_DIR, '03-clasificacion.png'),
    fullPage: true,
  });

  // --- /admin/partidos ---
  console.log(`==> /admin/partidos`);
  await page.goto(`${BASE_URL}/admin/partidos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await redactNicks(page, REDACT_NICKS);
  await page.screenshot({
    path: path.join(OUT_DIR, '04-admin.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('✓ screenshots en docs/screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
