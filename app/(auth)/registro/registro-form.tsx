'use client';

import { useActionState } from 'react';

import { registerAction, type RegisterFormState } from './actions';

const INITIAL: RegisterFormState = {};

export function RegistroForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(registerAction, INITIAL);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input name="nombre" required className="rounded-md border border-slot bg-surface px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Apellidos
        <input name="apellidos" required className="rounded-md border border-slot bg-surface px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nick
        <input name="nickname" required className="rounded-md border border-slot bg-surface px-3 py-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-slot bg-surface px-3 py-2 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          name="password"
          required
          autoComplete="new-password"
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
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
