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
        <input name="nombre" required className="rounded border border-zinc-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Apellidos
        <input name="apellidos" required className="rounded border border-zinc-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nick
        <input name="nickname" required className="rounded border border-zinc-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          name="password"
          required
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
