'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AUTOSAVE_DEBOUNCE_MS } from '@/lib/constants';

// Autosave debounced reutilizable por todos los tabs de la porra
// (skill add-prediction-type §"Auto-save"). El componente mantiene su estado
// local y llama a `save(value)` en cada cambio; el hook colapsa los cambios
// rápidos en un único guardado tras `debounceMs` y expone el estado visual.

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type UseAutoSaveResult<T> = {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  save: (value: T) => void;
  retry: () => void;
};

export function useAutoSave<T>(
  onSave: (value: T) => Promise<void>,
  options?: { debounceMs?: number },
): UseAutoSaveResult<T> {
  const debounceMs = options?.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Siempre llamamos a la última versión de onSave sin re-crear save/retry.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const run = useCallback(async () => {
    if (!pendingRef.current) {
      return;
    }
    const { value } = pendingRef.current;
    setStatus('saving');
    try {
      await onSaveRef.current(value);
      if (!mountedRef.current) {
        return;
      }
      pendingRef.current = null;
      setStatus('saved');
      setLastSavedAt(new Date());
    } catch {
      if (!mountedRef.current) {
        return;
      }
      // Conservamos pendingRef para que retry() reintente el mismo valor.
      setStatus('error');
    }
  }, []);

  const save = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void run();
      }, debounceMs);
    },
    [debounceMs, run],
  );

  const retry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void run();
  }, [run]);

  return { status, lastSavedAt, save, retry };
}
