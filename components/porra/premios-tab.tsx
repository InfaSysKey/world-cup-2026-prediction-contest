'use client';

import { useCallback, useMemo, useState } from 'react';

import { savePlayerAwardsPrediction } from '@/app/(porra)/porra/actions';
import type { PremiosState } from '@/app/(porra)/porra/premios-completion';
import { PLAYER_NAME_MAX } from '@/lib/constants';
import { useAutoSave } from '@/lib/hooks/use-auto-save';

type PremiosKey = keyof PremiosState;

type FieldConfig = {
  key: PremiosKey;
  medal: string;
  label: string;
};

const BOTAS: FieldConfig[] = [
  { key: 'bootGold', medal: '🥇', label: 'Bota de Oro' },
  { key: 'bootSilver', medal: '🥈', label: 'Bota de Plata' },
  { key: 'bootBronze', medal: '🥉', label: 'Bota de Bronce' },
];

const BALONES: FieldConfig[] = [
  { key: 'ballGold', medal: '🥇', label: 'Balón de Oro' },
  { key: 'ballSilver', medal: '🥈', label: 'Balón de Plata' },
  { key: 'ballBronze', medal: '🥉', label: 'Balón de Bronce' },
];

const HINT = 'Ej: Mbappé, Vinicius Jr…';

// Estado local del formulario: strings ('' = vacío). Se convierte a null al
// guardar y al detectar duplicados, igual que el servidor.
type FormValues = Record<PremiosKey, string>;

function toForm(initial: PremiosState): FormValues {
  return {
    bootGold: initial.bootGold ?? '',
    bootSilver: initial.bootSilver ?? '',
    bootBronze: initial.bootBronze ?? '',
    ballGold: initial.ballGold ?? '',
    ballSilver: initial.ballSilver ?? '',
    ballBronze: initial.ballBronze ?? '',
  };
}

// Un campo presente envía su texto (el servidor recorta); vacío o solo espacios
// envía null, que borra esa fila.
function toField(raw: string): string | null {
  return raw.trim() === '' ? null : raw;
}

// "Mismo jugador" para la regla de distinción: ignora mayúsculas y espacios.
function hasDuplicate(values: FormValues, keys: PremiosKey[]): boolean {
  const filled = keys
    .map((k) => values[k].trim().toLowerCase())
    .filter((v) => v !== '');
  return new Set(filled).size !== filled.length;
}

type PremiosTabProps = {
  initial: PremiosState;
  locked: boolean;
};

export function PremiosTab({ initial, locked }: PremiosTabProps) {
  const [values, setValues] = useState<FormValues>(() => toForm(initial));

  const onSave = useCallback(async (next: FormValues) => {
    const res = await savePlayerAwardsPrediction({
      bootGold: toField(next.bootGold),
      bootSilver: toField(next.bootSilver),
      bootBronze: toField(next.bootBronze),
      ballGold: toField(next.ballGold),
      ballSilver: toField(next.ballSilver),
      ballBronze: toField(next.ballBronze),
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
  }, []);

  const { status, save, retry } = useAutoSave<FormValues>(onSave);

  const bootsDup = useMemo(
    () => hasDuplicate(values, ['bootGold', 'bootSilver', 'bootBronze']),
    [values],
  );
  const ballsDup = useMemo(
    () => hasDuplicate(values, ['ballGold', 'ballSilver', 'ballBronze']),
    [values],
  );

  // No guardamos mientras haya un duplicado en algún grupo: el servidor lo
  // rechazaría. El usuario corrige y el siguiente cambio dispara el autosave.
  const setField = useCallback(
    (key: PremiosKey, raw: string) => {
      const next = { ...values, [key]: raw };
      setValues(next);
      const blocked =
        hasDuplicate(next, ['bootGold', 'bootSilver', 'bootBronze']) ||
        hasDuplicate(next, ['ballGold', 'ballSilver', 'ballBronze']);
      if (!blocked) {
        save(next);
      }
    },
    [values, save],
  );

  return (
    <div data-testid="premios-tab" className="flex max-w-md flex-col gap-6">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
        <h3 className="text-sm font-semibold text-zinc-700">
          Premios individuales
        </h3>
        <AutoSaveStatus status={status} locked={locked} onRetry={retry} />
      </div>

      <Section
        title="Botas (máximos goleadores)"
        icon="⚽"
        fields={BOTAS}
        values={values}
        duplicate={bootsDup}
        duplicateTestId="premios-boots-error"
        duplicateMessage="Cada bota debe ser un jugador diferente."
        locked={locked}
        onChange={setField}
      />

      <Section
        title="Balones (mejores jugadores)"
        icon="🏆"
        fields={BALONES}
        values={values}
        duplicate={ballsDup}
        duplicateTestId="premios-balls-error"
        duplicateMessage="Cada balón debe ser un jugador diferente."
        locked={locked}
        onChange={setField}
      />
    </div>
  );
}

function Section({
  title,
  icon,
  fields,
  values,
  duplicate,
  duplicateTestId,
  duplicateMessage,
  locked,
  onChange,
}: {
  title: string;
  icon: string;
  fields: FieldConfig[];
  values: FormValues;
  duplicate: boolean;
  duplicateTestId: string;
  duplicateMessage: string;
  locked: boolean;
  onChange: (key: PremiosKey, raw: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
        <span aria-hidden>{icon}</span>
        {title}
      </h4>

      {duplicate ? (
        <p
          role="alert"
          data-testid={duplicateTestId}
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          {duplicateMessage}
        </p>
      ) : null}

      {fields.map((field) => (
        <div
          key={field.key}
          data-testid={`premios-field-${field.key}`}
          className="flex flex-col gap-1"
        >
          <label
            htmlFor={`premios-input-${field.key}`}
            className="flex items-center gap-2 text-sm font-medium text-zinc-800"
          >
            <span aria-hidden>{field.medal}</span>
            {field.label}
          </label>
          <input
            id={`premios-input-${field.key}`}
            data-testid={`premios-input-${field.key}`}
            type="text"
            maxLength={PLAYER_NAME_MAX}
            disabled={locked}
            value={values[field.key]}
            aria-label={field.label}
            placeholder={HINT}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
          />
          <p className="text-xs text-zinc-400">{HINT}</p>
        </div>
      ))}
    </section>
  );
}

function AutoSaveStatus({
  status,
  locked,
  onRetry,
}: {
  status: ReturnType<typeof useAutoSave>['status'];
  locked: boolean;
  onRetry: () => void;
}) {
  if (locked) {
    return <span className="text-xs font-medium text-amber-700">BLOQUEADA</span>;
  }
  if (status === 'saving') {
    return (
      <span data-testid="premios-autosave-status" className="text-xs text-zinc-500">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="premios-autosave-status" className="text-xs text-green-600">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="premios-autosave-status"
        className="flex items-center gap-2 text-xs text-red-600"
      >
        Error al guardar
        <button type="button" onClick={onRetry} className="underline">
          Reintentar
        </button>
      </span>
    );
  }
  return (
    <span data-testid="premios-autosave-status" className="text-xs text-zinc-400">
      Sin cambios
    </span>
  );
}
