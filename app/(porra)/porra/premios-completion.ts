// Estado del tab Premios: los 6 nombres de jugador (null = campo vacío). Vive
// junto al de podio porque ambos derivan de predictions_awards, pero son
// independientes: aquí solo importan los kinds boot_*/ball_* (data-model.md §4.5).
export type PremiosState = {
  bootGold: string | null;
  bootSilver: string | null;
  bootBronze: string | null;
  ballGold: string | null;
  ballSilver: string | null;
  ballBronze: string | null;
};

// Premios es el tab más simple: sin deducción, sin stale, sin mismatches. Por eso
// no hay estado 'revisar' (a diferencia de podio).
export type PremiosCompletion = 'complete' | 'partial' | 'empty';

const KIND_TO_KEY: Record<string, keyof PremiosState> = {
  boot_gold: 'bootGold',
  boot_silver: 'bootSilver',
  boot_bronze: 'bootBronze',
  ball_gold: 'ballGold',
  ball_silver: 'ballSilver',
  ball_bronze: 'ballBronze',
};

const EMPTY_STATE: PremiosState = {
  bootGold: null,
  bootSilver: null,
  bootBronze: null,
  ballGold: null,
  ballSilver: null,
  ballBronze: null,
};

// Proyecta las filas de predictions_awards del usuario al estado del tab. Ignora
// las filas de podio (champion/runner_up/third): lectura independiente.
export function premiosStateFromAwards(
  awards: readonly { kind: string; playerName: string | null }[],
): PremiosState {
  const state: PremiosState = { ...EMPTY_STATE };
  for (const a of awards) {
    const key = KIND_TO_KEY[a.kind];
    if (key) {
      state[key] = a.playerName;
    }
  }
  return state;
}

export function premiosCompletion(state: PremiosState): PremiosCompletion {
  const filled = Object.values(state).filter(Boolean).length;
  if (filled >= 6) {
    return 'complete';
  }
  return filled > 0 ? 'partial' : 'empty';
}
