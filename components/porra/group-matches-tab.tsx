'use client';

import { useCallback, useState } from 'react';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import { saveGroupMatchPredictions } from '@/app/(porra)/porra/actions';
import { MAX_GOLES } from '@/lib/constants';
import type { PredictionGroupMatch } from '@/lib/db';
import { useAutoSave } from '@/lib/hooks/use-auto-save';
import type { GroupMatchPredictionInput } from '@/lib/validators/predictions';

type Side = 'local' | 'visitante';
type ScoreInput = { local: string; visitante: string };
export type ScoreMap = Record<number, ScoreInput>;

type GroupMatchesTabProps = {
  catalog: GroupCatalog[];
  initial: PredictionGroupMatch[];
  locked: boolean;
  // El contenedor de Grupos escucha los marcadores en vivo para detectar
  // empates a puntos y alimentar el desempato del orden de grupo.
  onValuesChange?: (values: ScoreMap) => void;
};

function buildInitialMap(initial: PredictionGroupMatch[]): ScoreMap {
  const map: ScoreMap = {};
  for (const p of initial) {
    map[p.matchId] = {
      local: String(p.golesLocal),
      visitante: String(p.golesVisitante),
    };
  }
  return map;
}

// Solo las entradas con ambos goles rellenos y válidos se mandan a guardar.
function toEntries(map: ScoreMap): GroupMatchPredictionInput[] {
  const out: GroupMatchPredictionInput[] = [];
  for (const [idStr, v] of Object.entries(map)) {
    if (v.local === '' || v.visitante === '') {
      continue;
    }
    const golesLocal = Number(v.local);
    const golesVisitante = Number(v.visitante);
    const valid =
      Number.isInteger(golesLocal) &&
      Number.isInteger(golesVisitante) &&
      golesLocal >= 0 &&
      golesVisitante >= 0 &&
      golesLocal <= MAX_GOLES &&
      golesVisitante <= MAX_GOLES;
    if (!valid) {
      continue;
    }
    out.push({ matchId: Number(idStr), golesLocal, golesVisitante });
  }
  return out;
}

const inputClass =
  'h-11 w-14 rounded-md border border-slot bg-surface px-2 text-center text-ink tabular-nums disabled:opacity-50';

export function GroupMatchesTab({
  catalog,
  initial,
  locked,
  onValuesChange,
}: GroupMatchesTabProps) {
  const [values, setValues] = useState<ScoreMap>(() => buildInitialMap(initial));

  const onSave = useCallback(async (entries: GroupMatchPredictionInput[]) => {
    const res = await saveGroupMatchPredictions(entries);
    if (res.error) {
      throw new Error(res.error.message);
    }
  }, []);

  const { status, save, retry } = useAutoSave(onSave);

  function update(matchId: number, side: Side, raw: string) {
    const current = values[matchId] ?? { local: '', visitante: '' };
    const next: ScoreMap = { ...values, [matchId]: { ...current, [side]: raw } };
    setValues(next);
    onValuesChange?.(next);
    save(toEntries(next));
  }

  return (
    <div data-testid="group-matches-tab" className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slot bg-bg py-2">
        <p className="text-sm text-ink-muted">
          Coloca el marcador exacto de cada partido de la fase de grupos.
        </p>
        <AutoSaveStatus status={status} locked={locked} onRetry={retry} />
      </div>

      {catalog.map((group) => (
        <section key={group.groupLetter} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Grupo {group.groupLetter}
          </h3>
          <ul className="flex flex-col gap-1">
            {group.matches.map((m) => {
              const placed =
                (values[m.id]?.local ?? '') !== '' &&
                (values[m.id]?.visitante ?? '') !== '';
              return (
              <li
                key={m.id}
                data-testid={`gm-row-${m.id}`}
                data-placed={placed}
                className={`flex flex-wrap items-center gap-2 rounded-[14px] border px-2 py-1.5 text-sm transition-colors ${
                  placed
                    ? 'border-slot bg-surface'
                    : 'border-dashed border-slot bg-bg'
                }`}
              >
                <span className="w-44 truncate text-right text-ink">
                  {m.homeFlag} {m.homeName}
                </span>
                <input
                  type="number"
                  min={0}
                  max={MAX_GOLES}
                  inputMode="numeric"
                  disabled={locked}
                  data-testid={`gm-local-${m.id}`}
                  aria-label={`Goles ${m.homeName}`}
                  value={values[m.id]?.local ?? ''}
                  onChange={(e) => update(m.id, 'local', e.target.value)}
                  className={inputClass}
                />
                <span className="text-ink-muted">–</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_GOLES}
                  inputMode="numeric"
                  disabled={locked}
                  data-testid={`gm-visitante-${m.id}`}
                  aria-label={`Goles ${m.awayName}`}
                  value={values[m.id]?.visitante ?? ''}
                  onChange={(e) => update(m.id, 'visitante', e.target.value)}
                  className={inputClass}
                />
                <span className="w-44 truncate text-ink">
                  {m.awayName} {m.awayFlag}
                </span>
              </li>
              );
            })}
          </ul>
        </section>
      ))}
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
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-300">
        BLOQUEADA
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span data-testid="autosave-status" className="text-xs text-ink-muted">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="autosave-status" className="text-xs text-cromo-mint">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="autosave-status"
        className="flex items-center gap-2 text-xs text-cromo-coral"
      >
        Error al guardar
        <button type="button" onClick={onRetry} className="underline">
          Reintentar
        </button>
      </span>
    );
  }
  return (
    <span data-testid="autosave-status" className="text-xs text-ink-muted">
      Sin cambios
    </span>
  );
}
