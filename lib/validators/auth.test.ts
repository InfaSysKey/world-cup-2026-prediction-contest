import { describe, expect, it } from 'vitest';

import { invitationSchema, loginSchema, registerSchema } from './auth';

describe('loginSchema', () => {
  it('acepta credenciales válidas y normaliza el email a minúsculas', () => {
    const result = loginSchema.safeParse({
      email: 'Foo@BAR.com',
      password: 'secreto123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('foo@bar.com');
    }
  });

  it('rechaza email inválido', () => {
    expect(loginSchema.safeParse({ email: 'no-es-email', password: 'x' }).success).toBe(
      false,
    );
  });

  it('rechaza password vacía', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: '' }).success,
    ).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    token: 'un-token-cualquiera',
    email: 'Nuevo@User.com',
    password: 'contraseña-segura',
    nombre: 'Ana',
    apellidos: 'García López',
    nickname: 'ana_g',
  };

  it('acepta un registro válido y normaliza el email', () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('nuevo@user.com');
    }
  });

  it('rechaza password más corta que el mínimo', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'corta' }).success).toBe(
      false,
    );
  });

  it('rechaza password más larga que el límite de bcrypt (72)', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success,
    ).toBe(false);
  });

  it('rechaza nickname vacío', () => {
    expect(registerSchema.safeParse({ ...valid, nickname: '   ' }).success).toBe(false);
  });

  it('rechaza token vacío', () => {
    expect(registerSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
  });
});

describe('invitationSchema', () => {
  it('acepta nota ausente', () => {
    expect(invitationSchema.safeParse({}).success).toBe(true);
  });

  it('acepta nota dentro del límite', () => {
    expect(invitationSchema.safeParse({ note: 'Para mi primo' }).success).toBe(true);
  });

  it('rechaza nota demasiado larga', () => {
    expect(invitationSchema.safeParse({ note: 'x'.repeat(81) }).success).toBe(false);
  });
});
