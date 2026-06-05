import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('el hash no coincide con el texto plano', async () => {
    const hash = await hashPassword('un-secreto');
    expect(hash).not.toBe('un-secreto');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifyPassword acepta la contraseña correcta', async () => {
    const hash = await hashPassword('un-secreto');
    expect(await verifyPassword('un-secreto', hash)).toBe(true);
  });

  it('verifyPassword rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('un-secreto');
    expect(await verifyPassword('otra-cosa', hash)).toBe(false);
  });
});
