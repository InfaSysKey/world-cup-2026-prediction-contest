// Ganador de un partido de fase de grupos según el marcador. El empate es un
// resultado válido en grupos (scoring-rules.md §6.4), por eso devuelve null.
// Para knockouts el ganador lo introduce el admin (puede venir de penaltis),
// así que esta función NO se usa ahí (data-model.md §3.2).
export function computeGroupWinner(
  homeTeamCode: string,
  awayTeamCode: string,
  golesLocal: number,
  golesVisitante: number,
): string | null {
  if (golesLocal > golesVisitante) {
    return homeTeamCode;
  }
  if (golesVisitante > golesLocal) {
    return awayTeamCode;
  }
  return null;
}
