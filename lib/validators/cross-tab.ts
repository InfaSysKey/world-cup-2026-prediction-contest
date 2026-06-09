// Validación cruzada entre tabs que usa el formulario: detectar mejores terceros
// "stale" (el equipo ya no es 3.º de su grupo tras reordenar los standings).
// Función pura, consumida por el resumen global (porra-summary) y por el tab de
// mejores terceros.
//
// Las antiguas checkBestThirdsCoherence y analyzePodiumBracketMismatch se
// eliminaron: la coherencia podio↔bracket la calculan ahora computePorraSummary y
// el PodioTab de forma inline (ADR 0005); el aviso de tercero incoherente lo
// cubre este mismo analyzeBestThirdsStale.

type StandingEntry = {
  groupLetter: string;
  position: number;
  teamCode: string;
};

type BestThirdEntry = {
  position: number;
  teamCode: string;
};

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
