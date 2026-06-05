import { describe, expect, it } from 'vitest';

import { isInvitationUsable } from './invitations';

const NOW = new Date('2026-06-05T12:00:00Z');

function invitation(overrides: {
  usedBy?: number | null;
  expiresAt: Date;
}): { usedBy: number | null; expiresAt: Date } {
  return { usedBy: overrides.usedBy ?? null, expiresAt: overrides.expiresAt };
}

describe('isInvitationUsable', () => {
  it('acepta un token sin usar y no caducado', () => {
    const inv = invitation({ expiresAt: new Date('2026-06-10T12:00:00Z') });
    expect(isInvitationUsable(inv, NOW)).toBe(true);
  });

  it('rechaza un token caducado', () => {
    const inv = invitation({ expiresAt: new Date('2026-06-01T12:00:00Z') });
    expect(isInvitationUsable(inv, NOW)).toBe(false);
  });

  it('rechaza un token ya usado aunque no haya caducado', () => {
    const inv = invitation({
      usedBy: 7,
      expiresAt: new Date('2026-06-10T12:00:00Z'),
    });
    expect(isInvitationUsable(inv, NOW)).toBe(false);
  });

  it('rechaza un token que caduca exactamente ahora', () => {
    const inv = invitation({ expiresAt: NOW });
    expect(isInvitationUsable(inv, NOW)).toBe(false);
  });
});
