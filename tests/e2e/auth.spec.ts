import { expect, test } from '@playwright/test';

import {
  adminGenerateInvitationUrl,
  uniqueSuffix,
} from '../fixtures/auth-helpers';

test('registro con invitación válida → login → página protegida', async ({
  browser,
}) => {
  const url = await adminGenerateInvitationUrl(browser);
  expect(url).toContain('/registro?token=');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'Tester');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', `e2e_${suffix}@test.dev`);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();

  await page.waitForURL('**/porra');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola');

  // La cookie de sesión está bien marcada.
  const sessionCookie = (await ctx.cookies()).find(
    (c) => c.name === 'porra_session',
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Lax');
  expect(sessionCookie?.path).toBe('/');

  await ctx.close();
});

test('logout invalida la sesión y bloquea la ruta protegida', async ({
  browser,
}) => {
  const url = await adminGenerateInvitationUrl(browser);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'Logout');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', `e2e_${suffix}@test.dev`);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();
  await page.waitForURL('**/porra');

  await page.getByRole('button', { name: /cerrar sesión/i }).click();
  await page.waitForURL('**/login');

  // Tras logout, la ruta protegida ya no es accesible.
  await page.goto('/porra');
  await expect(page).toHaveURL(/\/login/);

  await ctx.close();
});

test('acceso a /admin sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/admin/invitaciones');
  await expect(page).toHaveURL(/\/login/);
});

test('acceso a /admin como no-admin devuelve 403', async ({ browser }) => {
  const url = await adminGenerateInvitationUrl(browser);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'NoAdmin');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', `e2e_${suffix}@test.dev`);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();
  await page.waitForURL('**/porra');

  const response = await page.goto('/admin/invitaciones');
  expect(response?.status()).toBe(403);

  await ctx.close();
});
