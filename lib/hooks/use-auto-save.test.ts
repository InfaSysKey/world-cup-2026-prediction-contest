// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutoSave } from './use-auto-save';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no guarda antes de que expire el debounce', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave(onSave, { debounceMs: 800 }));

    act(() => result.current.save('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(799);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('guarda una vez tras el debounce y pasa a "saved"', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave(onSave, { debounceMs: 800 }));

    act(() => result.current.save('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('a');
    expect(result.current.status).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('colapsa cambios rápidos en un único guardado con el último valor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoSave(onSave, { debounceMs: 800 }));

    act(() => result.current.save('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => result.current.save('b'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('b');
  });

  it('expone estado "error" si el guardado falla y retry reintenta', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('fallo'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAutoSave(onSave, { debounceMs: 800 }));

    act(() => result.current.save('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(result.current.status).toBe('error');

    await act(async () => {
      result.current.retry();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });
});
