// Validaciones cruzadas entre tabs de la porra (skill add-prediction-type
// §"Validaciones cruzadas entre tabs"). Son funciones puras: reciben el estado
// de cada categoría y devuelven avisos. Se consumen en el cliente (warning
// visible en el footer) y, las marcadas como `error`, también en el servidor.
//
// Severidades:
//   - warning: NO bloquea el guardado, solo informa.
//   - error: rechaza la Server Action con INVALID_INPUT.

export type CrossTabSeverity = 'warning' | 'error';

export type CrossTabIssue = {
  code: string;
  message: string;
  severity: CrossTabSeverity;
};

type StandingEntry = {
  groupLetter: string;
  position: number;
  teamCode: string;
};

type BestThirdEntry = {
  position: number;
  teamCode: string;
};

// El equipo que el usuario marca como "mejor tercero" debería estar predicho en
// 3.ª posición de algún grupo (scoring-rules.md §2.4). Si no, no es coherente:
// warning, no error — el usuario puede estar a medio rellenar la porra.
export function checkBestThirdsCoherence(
  standings: readonly StandingEntry[],
  bestThirds: readonly BestThirdEntry[],
): CrossTabIssue[] {
  const thirdsInStandings = new Set(
    standings.filter((s) => s.position === 3).map((s) => s.teamCode),
  );

  const issues: CrossTabIssue[] = [];
  for (const third of bestThirds) {
    if (!thirdsInStandings.has(third.teamCode)) {
      issues.push({
        code: 'BEST_THIRD_NOT_IN_STANDINGS',
        message: `Has elegido un mejor tercero que no aparece como 3.º en ningún grupo.`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

// Una selección de mejor tercero es "stale" cuando el equipo ya no figura como
// 3.º de su grupo en standings (el usuario cambió el orden tras elegirlo). No
// bloquea el guardado (es la BD reflejando su decisión), pero la UI ofrece dos
// acciones rápidas: sustituir por el 3.º actual del grupo de ese equipo, o
// quitarlo. `replacement` es el code del 3.º actual de ese grupo, o null si el
// grupo aún no tiene 3.º predicho.
export type BestThirdStale = {
  teamCode: string;
  groupLetter: string;
  replacement: string | null;
};

export function analyzeBestThirdsStale(
  standings: readonly StandingEntry[],
  bestThirds: readonly BestThirdEntry[],
  // Grupo al que pertenece cada equipo (catálogo `teams`), para saber qué grupo
  // ofrecer como sustituto cuando el equipo ya no es 3.º en ninguno.
  teamGroup: ReadonlyMap<string, string>,
): BestThirdStale[] {
  const thirdsInStandings = new Set(
    standings.filter((s) => s.position === 3).map((s) => s.teamCode),
  );
  const thirdByGroup = new Map(
    standings
      .filter((s) => s.position === 3)
      .map((s) => [s.groupLetter, s.teamCode]),
  );

  const stale: BestThirdStale[] = [];
  for (const third of bestThirds) {
    if (thirdsInStandings.has(third.teamCode)) {
      continue;
    }
    const groupLetter = teamGroup.get(third.teamCode) ?? '';
    stale.push({
      teamCode: third.teamCode,
      groupLetter,
      replacement: thirdByGroup.get(groupLetter) ?? null,
    });
  }
  return stale;
}

// --- Podio vs bracket (scoring-rules.md §2.6, skill add-prediction-type) ---

// El podio guardado puede desincronizarse del bracket: el usuario guardó un
// campeón y luego cambió el ganador de la final, o editó el podio a mano. Para
// cada puesto comparamos el valor guardado con el deducido del bracket. Si
// difieren (y el bracket SÍ tiene una deducción para ese puesto), es un warning
// con sugerencia de sincronización. No bloquea el guardado: el podio es una
// predicción explícita y la fuente de verdad es su propia fila en BD.

export type PodiumKind = 'champion' | 'runnerUp' | 'third';

export type PodiumMismatch = {
  kind: PodiumKind;
  // Valor guardado en el podio (puede ser null si el puesto está vacío).
  saved: string | null;
  // Valor que deduce el bracket para ese puesto (nunca null en un mismatch).
  expected: string;
};

type PodiumState = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

export function analyzePodiumBracketMismatch(
  saved: PodiumState,
  deduction: PodiumState,
): PodiumMismatch[] {
  const kinds: PodiumKind[] = ['champion', 'runnerUp', 'third'];
  const out: PodiumMismatch[] = [];
  for (const kind of kinds) {
    const expected = deduction[kind];
    // Sin deducción para ese puesto no hay nada con qué comparar.
    if (expected === null) {
      continue;
    }
    if (saved[kind] !== expected) {
      out.push({ kind, saved: saved[kind], expected });
    }
  }
  return out;
}
