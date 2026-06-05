'use client';

import { useActionState } from 'react';

import {
  generateInvitationAction,
  type GenerateInvitationState,
} from './actions';

const INITIAL: GenerateInvitationState = {};

export function InvitacionesForm() {
  const [state, action, pending] = useActionState(
    generateInvitationAction,
    INITIAL,
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <form action={action} className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Nota (opcional)
          <input
            name="note"
            maxLength={80}
            placeholder="Para quién es esta invitación"
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Generando…' : 'Generar invitación'}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error.message}
        </p>
      ) : null}

      {state.data ? (
        <div className="flex flex-col gap-1 rounded border border-green-300 bg-green-50 p-3 text-sm">
          <span className="font-medium">Enlace de invitación (cópialo ahora):</span>
          <code data-testid="invitation-url" className="break-all">
            {state.data.url}
          </code>
        </div>
      ) : null}
    </div>
  );
}
