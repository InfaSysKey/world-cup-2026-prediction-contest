'use client';

import { useActionState } from 'react';

import { loginAction, type AuthFormState } from './actions';

const INITIAL: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-ink">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-slot bg-surface px-3 py-2 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Contraseña
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slot bg-surface px-3 py-2 text-ink"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-cromo-coral">
          {state.error.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[10px] bg-cromo-cobalt px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
