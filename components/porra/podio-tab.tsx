'use client';

import { useCallback, useMemo, useState } from 'react';

import { savePodiumPrediction } from '@/app/(porra)/porra/actions';
import type { PodiumState } from '@/app/(porra)/porra/load-podium';
import { TeamSelect, type TeamOption } from '@/components/porra/team-select';
import type { GroupTeamsCatalog } from '@/app/(porra)/porra/load-group-teams';
import { useAutoSave } from '@/lib/hooks/use-auto-save';
import type { PodiumDeduction } from '@/lib/scoring/deduce-podium';
import { analyzePodiumBracketMismatch } from '@/lib/validators/cross-tab';

type PodiumKey = 'champion' | 'runnerUp' | 'third';

type FieldConfig = {
  key: PodiumKey;
  medal: string;
  label: string;
  source: 'final' | '3-4';
};

const FIELDS: FieldConfig[] = [
  { key: 'champion', medal: '🥇', label: 'Campeón', source: 'final' },
  { key: 'runnerUp', medal: '🥈', label: 'Subcampeón', source: 'final' },
  { key: 'third', medal: '🥉', label: '3.º puesto', source: '3-4' },
];

// Texto de ayuda cuando aún no hay datos de bracket suficientes para deducir el
// puesto. Explica QUÉ falta predecir (el subcampeón necesita las 2 semis Y la
// final, no solo la final).
const NO_DEDUCTION_HINT: Record<PodiumKey, string> = {
  champion: 'Necesitas predecir la final para deducir el campeón',
  runnerUp: 'Necesitas predecir las 2 semifinales y la final para deducir el subcampeón',
  third: 'Necesitas predecir el partido por el 3.º puesto para deducir el 3.º',
};

type PodioTabProps = {
  teamsCatalog: GroupTeamsCatalog[];
  podium: PodiumState;
  deduction: PodiumDeduction;
  locked: boolean;
};

export function PodioTab({
  teamsCatalog,
  podium: initial,
  deduction,
  locked,
}: PodioTabProps) {
  const options = useMemo<TeamOption[]>(() => {
    const all = teamsCatalog.flatMap((g) => g.teams);
    return [...all].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [teamsCatalog]);

  const teamLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of options) {
      map.set(team.code, `${team.flag} ${team.name}`);
    }
    return map;
  }, [options]);

  const [podium, setPodium] = useState<PodiumState>(initial);

  const onSave = useCallback(async (next: PodiumState) => {
    const res = await savePodiumPrediction({
      champion: next.champion,
      runnerUp: next.runnerUp,
      third: next.third,
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
  }, []);

  const { status, save, retry } = useAutoSave<PodiumState>(onSave);

  // Equipos repetidos entre los 3 puestos: error duro (lo rechaza también el
  // servidor). No guardamos mientras haya duplicados para no provocar un
  // rechazo inútil; el usuario corrige y el siguiente cambio guarda.
  const duplicates = useMemo(() => {
    const filled = [podium.champion, podium.runnerUp, podium.third].filter(
      (c): c is string => c !== null,
    );
    return new Set(filled).size !== filled.length;
  }, [podium]);

  const commit = useCallback(
    (next: PodiumState) => {
      setPodium(next);
      const filled = [next.champion, next.runnerUp, next.third].filter(
        (c): c is string => c !== null,
      );
      if (new Set(filled).size === filled.length) {
        save(next);
      }
    },
    [save],
  );

  const setField = useCallback(
    (key: PodiumKey, code: string | null) => {
      commit({ ...podium, [key]: code });
    },
    [commit, podium],
  );

  const mismatchByKind = useMemo(
    () => new Map(analyzePodiumBracketMismatch(podium, deduction).map((m) => [m.kind, m])),
    [podium, deduction],
  );

  function hintText(field: FieldConfig): string {
    const suggested = deduction[field.key];
    if (suggested) {
      const sourceLabel = field.source === 'final' ? 'la final' : 'la 3-4';
      return `Sugerido desde tu predicción de ${sourceLabel}: ${teamLabel.get(suggested) ?? suggested}`;
    }
    return NO_DEDUCTION_HINT[field.key];
  }

  return (
    <div data-testid="podio-tab" className="flex max-w-md flex-col gap-5">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
        <h3 className="text-sm font-semibold text-zinc-700">
          Cuadro de honor
        </h3>
        <AutoSaveStatus status={status} locked={locked} onRetry={retry} />
      </div>

      {duplicates ? (
        <p
          role="alert"
          data-testid="podio-duplicates-error"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          Cada posición del podio debe ser un equipo diferente.
        </p>
      ) : null}

      {FIELDS.map((field) => {
        const mismatch = mismatchByKind.get(field.key);
        return (
          <div
            key={field.key}
            data-testid={`podio-field-${field.key}`}
            className="flex flex-col gap-1"
          >
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
              <span aria-hidden>{field.medal}</span>
              {field.label}
            </label>
            <TeamSelect
              value={podium[field.key]}
              options={options}
              disabled={locked}
              testId={`podio-select-${field.key}`}
              ariaLabel={field.label}
              onChange={(code) => setField(field.key, code)}
            />
            <p
              data-testid={`podio-hint-${field.key}`}
              className="text-xs text-zinc-400"
            >
              {hintText(field)}
            </p>
            {mismatch && !locked ? (
              <div
                data-testid={`podio-mismatch-${field.key}`}
                className="flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
              >
                <span>
                  No coincide con tu predicción del bracket (
                  {teamLabel.get(mismatch.expected) ?? mismatch.expected}).
                </span>
                <button
                  type="button"
                  data-testid={`podio-sync-${field.key}`}
                  onClick={() => setField(field.key, mismatch.expected)}
                  className="rounded border border-amber-400 px-1.5 py-0.5 font-medium"
                >
                  Sincronizar con bracket
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
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
      <span data-testid="podio-autosave-status" className="text-xs text-zinc-500">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="podio-autosave-status" className="text-xs text-green-600">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="podio-autosave-status"
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
    <span data-testid="podio-autosave-status" className="text-xs text-zinc-400">
      Sin cambios
    </span>
  );
}
