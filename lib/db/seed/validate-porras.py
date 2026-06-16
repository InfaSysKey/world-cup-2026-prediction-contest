#!/usr/bin/env python3
"""Resuelve el bracket de cada Excel de porras-excel/ con la misma lógica que el
importer (post-fix AH) y vuelca un resumen legible con nombres de equipo,
marcadores y podio. Pensado para revisar de un vistazo que cada porra cuadra
con lo que el jugador ve en su Excel.

Uso:
  python3 lib/db/seed/validate-porras.py                     # todas
  python3 lib/db/seed/validate-porras.py <archivo.xlsx>      # una sola
"""

import glob
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.dirname(__file__))

# Reutiliza el importer
_imp_path = os.path.join(os.path.dirname(__file__), "import-porra-from-excel.py")
_mod_globals = {"__name__": "_importer", "__file__": _imp_path}
with open(_imp_path) as f:
    exec(compile(f.read(), _imp_path, "exec"), _mod_globals)

parse_porra = _mod_globals["parse_porra"]
compute_group_tables = _mod_globals["compute_group_tables"]
derive_standings = _mod_globals["derive_standings"]
derive_best_thirds = _mod_globals["derive_best_thirds"]
resolve_bracket = _mod_globals["resolve_bracket"]
deduce_podium = _mod_globals["deduce_podium"]
load_best_thirds_mapping = _mod_globals["load_best_thirds_mapping"]
KNOCKOUT_MATCHES = _mod_globals["KNOCKOUT_MATCHES"]
TEAM_GROUP = _mod_globals["TEAM_GROUP"]
TEAM_NAME_ES = _mod_globals["TEAM_NAME_ES"]
TEAM_CODE_TO_NAME = {v: k for k, v in TEAM_NAME_ES.items()}

PHASE_LABEL = {
    "1/16": "1/16 final",
    "1/8": "Octavos",
    "cuartos": "Cuartos",
    "semi": "Semis",
    "3-4": "3.º-4.º puesto",
    "final": "FINAL",
}


def name(code: str) -> str:
    return TEAM_CODE_TO_NAME.get(code, code or "?")


def validate(xlsx_path: str) -> None:
    print("=" * 78)
    print(f"  {os.path.basename(xlsx_path)}")
    print("=" * 78)

    porra = parse_porra(xlsx_path)
    mapping = load_best_thirds_mapping()
    tables = compute_group_tables(porra["group_marcadores"])
    standings = derive_standings(tables)
    best_thirds = derive_best_thirds(tables)
    standings = _mod_globals.get("merge_with_excel_standings", lambda s, e: s)(
        standings, porra.get("excel_standings", {})
    )
    if "derive_best_thirds_from_standings" in _mod_globals:
        best_thirds = _mod_globals["derive_best_thirds_from_standings"](standings, tables)
    winners = resolve_bracket(
        standings,
        best_thirds,
        porra["knockout_marcadores"],
        porra["knockout_winner_override"],
        mapping,
    )
    champion, runner_up, third = deduce_podium(winners)

    print()
    print(f"PODIO:  🥇 {name(champion):<22}  🥈 {name(runner_up):<22}  🥉 {name(third)}")
    print(f"BOTAS:  🥇 {porra['boots'][0]:<22}  🥈 {porra['boots'][1]:<22}  🥉 {porra['boots'][2]}")
    print(f"BALÓN:  🥇 {porra['balls'][0]:<22}  🥈 {porra['balls'][1]:<22}  🥉 {porra['balls'][2]}")
    print()

    # Standings por grupo (top 4)
    print("STANDINGS por grupo:")
    for g in sorted(standings):
        row = standings[g]
        print(f"  {g}:  1º {name(row[0]):<18} 2º {name(row[1]):<18} 3º {name(row[2]):<18} 4º {name(row[3])}")
    print()
    print(f"MEJORES TERCEROS:  {', '.join(name(t) for t in best_thirds)}")
    print()

    # Bracket cruce a cruce
    KO_BY_ID = {m[0]: m for m in KNOCKOUT_MATCHES}
    print("BRACKET:")
    for mid, home_slot, away_slot, phase in KNOCKOUT_MATCHES:
        gl, gv = porra["knockout_marcadores"][mid]
        winner_code = winners[mid]
        if False:  # standings ya van con los del Excel mergeados
            pass
        else:
            from re import match as rematch
            STANDING_REF = r"^([12])([A-L])$"
            THIRD_REF = r"^3[A-L]+$"
            WINNER_REF = r"^W(\d+)$"
            LOSER_REF = r"^L(\d+)$"

            def resolve(ref: str, own_mid: int) -> str:
                m = rematch(STANDING_REF, ref)
                if m:
                    pos, grp = m.group(1), m.group(2)
                    return standings[grp][int(pos) - 1]
                if rematch(THIRD_REF, ref):
                    third_groups = sorted({TEAM_GROUP[t] for t in best_thirds})
                    combo = "".join(third_groups)
                    if combo in mapping:
                        grp = mapping[combo].get(own_mid)
                        if grp:
                            return standings[grp][2]
                    return "?"
                m = rematch(WINNER_REF, ref)
                if m:
                    return winners.get(int(m.group(1)), "?")
                m = rematch(LOSER_REF, ref)
                if m:
                    rid = int(m.group(1))
                    rm = KO_BY_ID.get(rid)
                    if not rm:
                        return "?"
                    rh = resolve(rm[1], rid)
                    ra = resolve(rm[2], rid)
                    rw = winners.get(rid)
                    if rw == rh:
                        return ra
                    if rw == ra:
                        return rh
                    return "?"
                return "?"

            home = resolve(home_slot, mid)
            away = resolve(away_slot, mid)
        win_label = name(winner_code)
        marker = "▶" if winner_code == home else "◀" if winner_code == away else "?"
        print(
            f"  #{mid:>3} {PHASE_LABEL[phase]:<15}  {name(home):>20} {gl}-{gv} {name(away):<20}  → {win_label}  {marker}"
        )
    print()


def main() -> None:
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "porras-excel", "*.xlsx")))
    for f in files:
        if not os.path.isfile(f):
            print(f"⚠️  {f} no existe, salto.", file=sys.stderr)
            continue
        try:
            validate(f)
        except Exception as e:
            print(f"\n❌ ERROR procesando {os.path.basename(f)}: {e}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
