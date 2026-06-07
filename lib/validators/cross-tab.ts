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
