#!/usr/bin/env python3
"""Importa una porra desde un Excel del usuario a la base de datos vía SQL.

Lee el Excel personal de un amigo (plantilla ExcelFutbol Mundial 2026) y emite
un SQL idempotente que rellena las 5 tablas `predictions_*` para el usuario
indicado. Limpia las predicciones previas del usuario (DELETE) y vuelve a
insertar dentro de una sola transacción (BEGIN/COMMIT), de modo que aplicarlo
dos veces deja la BD en el mismo estado.

Uso:
  python3 lib/db/seed/import-porra-from-excel.py <porra.xlsx> --email <email>

Aplicar (la BD corre en el contenedor podman `porra-db`):
  python3 lib/db/seed/import-porra-from-excel.py porras-excel/Excel-Mundial-2026-PORRA-CARLOS.xlsx \\
    --email carlos@porra.local | podman exec -i porra-db psql -U porra -d porra

Decisiones:
  - Solo stdlib: el .xlsx es un zip de XML (zipfile + ElementTree). Misma
    estética que `extract-from-excel.py`.
  - El usuario destino lo crea el operador antes (este script no toca `users`).
  - Si el usuario no existe, el `DO $$` aborta y el COMMIT no se aplica.
  - Standings, mejores terceros y podio se derivan de los marcadores con la
    misma lógica que `lib/scoring/{group-table,resolve-best-thirds,resolve-bracket,deduce-podium}.ts`.
"""

import argparse
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# ---------------------------------------------------------------------------
# Catálogos. TEAM_GROUP y los partidos se replican aquí desde lib/db/seed/
# {teams,matches}.ts para que el script sea autocontenido (un solo fichero).
# BEST_THIRDS_MAPPING se parsea del .ts en runtime (495 entradas).
# ---------------------------------------------------------------------------

TEAM_GROUP = {
    "ARG": "J", "AUS": "D", "AUT": "J", "BEL": "G", "BIH": "B", "BRA": "C",
    "CAN": "B", "CHE": "B", "CIV": "E", "COD": "K", "COL": "K", "CPV": "H",
    "CUW": "E", "CZE": "A", "DEU": "E", "DZA": "J", "ECU": "E", "EGY": "G",
    "ENG": "L", "ESP": "H", "FRA": "I", "GHA": "L", "HRV": "L", "HTI": "C",
    "IRN": "G", "IRQ": "I", "JOR": "J", "JPN": "F", "KOR": "A", "MAR": "C",
    "MEX": "A", "NLD": "F", "NOR": "I", "NZL": "G", "PAN": "L", "PRT": "K",
    "PRY": "D", "QAT": "B", "SAU": "H", "SCO": "C", "SEN": "I", "SWE": "F",
    "TUN": "F", "TUR": "D", "URY": "H", "USA": "D", "UZB": "K", "ZAF": "A",
}

# (match_id, home, away, group). 72 entradas, 1..72.
GROUP_MATCHES = [
    (1, "MEX", "ZAF", "A"), (2, "KOR", "CZE", "A"), (3, "CAN", "BIH", "B"),
    (4, "USA", "PRY", "D"), (5, "HTI", "SCO", "C"), (6, "AUS", "TUR", "D"),
    (7, "BRA", "MAR", "C"), (8, "QAT", "CHE", "B"), (9, "CIV", "ECU", "E"),
    (10, "DEU", "CUW", "E"), (11, "NLD", "JPN", "F"), (12, "SWE", "TUN", "F"),
    (13, "SAU", "URY", "H"), (14, "ESP", "CPV", "H"), (15, "IRN", "NZL", "G"),
    (16, "BEL", "EGY", "G"), (17, "FRA", "SEN", "I"), (18, "IRQ", "NOR", "I"),
    (19, "ARG", "DZA", "J"), (20, "AUT", "JOR", "J"), (21, "GHA", "PAN", "L"),
    (22, "ENG", "HRV", "L"), (23, "PRT", "COD", "K"), (24, "UZB", "COL", "K"),
    (25, "CZE", "ZAF", "A"), (26, "CHE", "BIH", "B"), (27, "CAN", "QAT", "B"),
    (28, "MEX", "KOR", "A"), (29, "BRA", "HTI", "C"), (30, "SCO", "MAR", "C"),
    (31, "TUR", "PRY", "D"), (32, "USA", "AUS", "D"), (33, "DEU", "CIV", "E"),
    (34, "ECU", "CUW", "E"), (35, "NLD", "SWE", "F"), (36, "TUN", "JPN", "F"),
    (37, "URY", "CPV", "H"), (38, "ESP", "SAU", "H"), (39, "BEL", "IRN", "G"),
    (40, "NZL", "EGY", "G"), (41, "NOR", "SEN", "I"), (42, "FRA", "IRQ", "I"),
    (43, "ARG", "AUT", "J"), (44, "JOR", "DZA", "J"), (45, "ENG", "GHA", "L"),
    (46, "PAN", "HRV", "L"), (47, "PRT", "UZB", "K"), (48, "COL", "COD", "K"),
    (49, "SCO", "BRA", "C"), (50, "MAR", "HTI", "C"), (51, "CHE", "CAN", "B"),
    (52, "BIH", "QAT", "B"), (53, "CZE", "MEX", "A"), (54, "ZAF", "KOR", "A"),
    (55, "CUW", "CIV", "E"), (56, "ECU", "DEU", "E"), (57, "JPN", "SWE", "F"),
    (58, "TUN", "NLD", "F"), (59, "TUR", "USA", "D"), (60, "PRY", "AUS", "D"),
    (61, "NOR", "FRA", "I"), (62, "SEN", "IRQ", "I"), (63, "EGY", "IRN", "G"),
    (64, "NZL", "BEL", "G"), (65, "CPV", "SAU", "H"), (66, "URY", "ESP", "H"),
    (67, "PAN", "ENG", "L"), (68, "HRV", "GHA", "L"), (69, "DZA", "AUT", "J"),
    (70, "JOR", "ARG", "J"), (71, "COL", "PRT", "K"), (72, "COD", "UZB", "K"),
]

# (match_id, home_slot_ref, away_slot_ref, phase). 32 entradas, 73..104.
KNOCKOUT_MATCHES = [
    (73, "2A", "2B", "1/16"),
    (74, "1E", "3ABCDF", "1/16"),
    (75, "1F", "2C", "1/16"),
    (76, "1C", "2F", "1/16"),
    (77, "1I", "3CDFGH", "1/16"),
    (78, "2E", "2I", "1/16"),
    (79, "1A", "3CEFHI", "1/16"),
    (80, "1L", "3EHIJK", "1/16"),
    (81, "1D", "3BEFIJ", "1/16"),
    (82, "1G", "3AEHIJ", "1/16"),
    (83, "2K", "2L", "1/16"),
    (84, "1H", "2J", "1/16"),
    (85, "1B", "3EFGIJ", "1/16"),
    (86, "1J", "2H", "1/16"),
    (87, "1K", "3DEIJL", "1/16"),
    (88, "2D", "2G", "1/16"),
    (89, "W74", "W77", "1/8"),
    (90, "W73", "W75", "1/8"),
    (91, "W76", "W78", "1/8"),
    (92, "W79", "W80", "1/8"),
    (93, "W83", "W84", "1/8"),
    (94, "W81", "W82", "1/8"),
    (95, "W86", "W88", "1/8"),
    (96, "W85", "W87", "1/8"),
    (97, "W89", "W90", "cuartos"),
    (98, "W93", "W94", "cuartos"),
    (99, "W91", "W92", "cuartos"),
    (100, "W95", "W96", "cuartos"),
    (101, "W97", "W98", "semi"),
    (102, "W99", "W100", "semi"),
    (103, "L101", "L102", "3-4"),
    (104, "W101", "W102", "final"),
]

KNOCKOUT_BY_ID = {m[0]: m for m in KNOCKOUT_MATCHES}


def load_best_thirds_mapping():
    """Parsea lib/scoring/best-thirds-mapping.ts → dict[combo str, dict[matchId int, group str]]."""
    path = os.path.join(ROOT, "lib", "scoring", "best-thirds-mapping.ts")
    text = open(path, encoding="utf-8").read()
    # Cada entrada: 'BCEFHIJL': { 74: 'C', 77: 'F', ... },
    line_re = re.compile(r"'([A-L]{8})':\s*\{([^}]*)\}")
    pair_re = re.compile(r"(\d+):\s*'([A-L])'")
    mapping = {}
    for m in line_re.finditer(text):
        combo, body = m.group(1), m.group(2)
        mapping[combo] = {int(k): v for k, v in pair_re.findall(body)}
    if len(mapping) != 495:
        raise RuntimeError(
            f"BEST_THIRDS_MAPPING entradas: {len(mapping)} (esperaba 495)"
        )
    return mapping


# ---------------------------------------------------------------------------
# Excel parsing (zipfile + ElementTree, igual que extract-from-excel.py).
# ---------------------------------------------------------------------------

def _col_letters(ref):
    return re.match(r"([A-Z]+)\d+", ref).group(1)


def _load_shared(z):
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def _read_rows(z, sheet_file, shared):
    """Devuelve {rownum: {col_letter: value_str}} para una hoja."""
    root = ET.fromstring(z.read(f"xl/worksheets/{sheet_file}"))
    sd = root.find(f"{NS}sheetData")
    rows = {}
    for row in sd.findall(f"{NS}row"):
        cells = {}
        for c in row.findall(f"{NS}c"):
            t, v, isv = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr" and isv is not None:
                val = "".join(x.text or "" for x in isv.iter(f"{NS}t"))
            elif v is not None:
                val = v.text
            else:
                continue
            if val not in (None, ""):
                cells[_col_letters(c.get("r"))] = val
        rows[int(row.get("r"))] = cells
    return rows


def parse_porra(xlsx_path):
    """Lee del Excel los inputs RAW del usuario.

    Devuelve dict con:
      - group_marcadores: {match_id (1..72): (goles_local, goles_visitante)}
      - knockout_marcadores: {match_id (73..104): (goles_local, goles_visitante)}
      - boots: [oro, plata, bronce] (strings)
      - balls: [oro, plata, bronce] (strings)
    """
    z = zipfile.ZipFile(xlsx_path)
    shared = _load_shared(z)
    wc = _read_rows(z, "sheet2.xml", shared)  # WORLDCUP

    group_marc = {}
    knockout_marc = {}
    for cells in wc.values():
        ac = cells.get("AC")
        ad = cells.get("AD")
        if ac is None or ad is None:
            continue
        ah = cells.get("AH")
        j = cells.get("J")
        # Grupos: match_id en AH (1..72), coincide con seed.
        if ah and ah.isdigit():
            mid = int(ah)
            if 1 <= mid <= 72:
                group_marc[mid] = (int(ac), int(ad))
                continue
        # Knockouts: match_id en J (73..104). AH está reshuffleado, NO usar.
        if j and j.isdigit():
            mid = int(j)
            if 73 <= mid <= 104:
                gl, gv = int(ac), int(ad)
                if gl == gv:
                    raise RuntimeError(
                        f"Knockout {mid}: predicción {gl}-{gv} sin ganador "
                        f"(los empates no valen en eliminatorias)"
                    )
                knockout_marc[mid] = (gl, gv)

    missing_groups = sorted(set(range(1, 73)) - set(group_marc))
    if missing_groups:
        raise RuntimeError(f"Faltan marcadores de grupo: {missing_groups}")
    missing_kos = sorted(set(range(73, 105)) - set(knockout_marc))
    if missing_kos:
        raise RuntimeError(f"Faltan marcadores de eliminatorias: {missing_kos}")

    def aa(row):
        return wc.get(row, {}).get("AA")

    boots = [aa(154), aa(155), aa(156)]
    balls = [aa(158), aa(159), aa(160)]
    if any(b is None or not str(b).strip() for b in boots + balls):
        raise RuntimeError(
            f"Faltan premios individuales: botas={boots}, balones={balls}"
        )

    return {
        "group_marcadores": group_marc,
        "knockout_marcadores": knockout_marc,
        "boots": [b.strip() for b in boots],
        "balls": [b.strip() for b in balls],
    }


# ---------------------------------------------------------------------------
# Derivaciones (réplica 1:1 de lib/scoring/ en Python).
# ---------------------------------------------------------------------------

WIN_POINTS = 3
DRAW_POINTS = 1


def compute_group_tables(group_marc):
    """Devuelve {group_letter: [(team, pts, gd, gf), …]} ordenado de mejor a peor.

    Réplica de computeGroupPoints + ordenación por PTS → GD → GF → alfabético.
    El fallback alfabético sustituye el override manual (columnas EmpateNL/V del
    Excel, que están vacías en la porra de Carlos — y en las demás no esperamos
    casos porque los marcadores variados rara vez dejan empate en los 3 criterios).
    """
    teams_by_group = {}
    for code, g in TEAM_GROUP.items():
        teams_by_group.setdefault(g, []).append(code)
    matches_by_group = {}
    for mid, home, away, g in GROUP_MATCHES:
        matches_by_group.setdefault(g, []).append((mid, home, away))

    out = {}
    for g, teams in sorted(teams_by_group.items()):
        pts = {t: 0 for t in teams}
        gf = {t: 0 for t in teams}
        ga = {t: 0 for t in teams}
        for mid, home, away in matches_by_group[g]:
            gl, gv = group_marc[mid]
            gf[home] += gl
            ga[home] += gv
            gf[away] += gv
            ga[away] += gl
            if gl > gv:
                pts[home] += WIN_POINTS
            elif gl < gv:
                pts[away] += WIN_POINTS
            else:
                pts[home] += DRAW_POINTS
                pts[away] += DRAW_POINTS
        rows = [(t, pts[t], gf[t] - ga[t], gf[t]) for t in teams]
        rows.sort(key=lambda r: (-r[1], -r[2], -r[3], r[0]))
        out[g] = rows
    return out


def derive_standings(tables):
    """{group_letter: [1º, 2º, 3º, 4º]}."""
    return {g: [r[0] for r in rows] for g, rows in tables.items()}


def derive_best_thirds(tables):
    """Lista de 8 team codes, posiciones 1..8 (mejor 3.º → peor 3.º)."""
    thirds = []
    for g, rows in tables.items():
        team, pts, gd, gf = rows[2]
        thirds.append((g, team, pts, gd, gf))
    thirds.sort(key=lambda x: (-x[2], -x[3], -x[4], x[1]))
    return [t[1] for t in thirds[:8]]


STANDING_REF = re.compile(r"^([12])([A-L])$")
THIRD_REF = re.compile(r"^3[A-L]+$")
WINNER_REF = re.compile(r"^W(\d+)$")
LOSER_REF = re.compile(r"^L(\d+)$")


def resolve_bracket(group_standings, best_thirds, knockout_marc, mapping):
    """Resuelve cada cruce de 73..104 al team_code ganador.

    Devuelve {match_id: winner_team_code}. Réplica de resolveBracket en TS.
    """
    standing_map = {}  # (group, pos) → team_code
    for g, teams in group_standings.items():
        for i, t in enumerate(teams):
            standing_map[(g, i + 1)] = t

    third_groups = sorted({TEAM_GROUP[t] for t in best_thirds})
    if len(third_groups) != 8:
        raise RuntimeError(
            f"Mejores terceros tienen {len(third_groups)} grupos distintos (esperaba 8)"
        )
    combo = "".join(third_groups)
    if combo not in mapping:
        raise RuntimeError(f"Combo de mejores terceros inválido: {combo}")
    assignment = mapping[combo]  # {match_id: group cuyo 3.º juega ahí}

    def resolve_slot(ref, own_match_id, winners):
        m = STANDING_REF.match(ref)
        if m:
            position, group = m.group(1), m.group(2)
            return standing_map[(group, int(position))]
        if THIRD_REF.match(ref):
            group = assignment.get(own_match_id)
            if not group:
                raise RuntimeError(
                    f"No hay asignación de 3.º para el partido {own_match_id} en combo {combo}"
                )
            return standing_map[(group, 3)]
        m = WINNER_REF.match(ref)
        if m:
            return winners[int(m.group(1))]
        m = LOSER_REF.match(ref)
        if m:
            rid = int(m.group(1))
            ref_match = KNOCKOUT_BY_ID.get(rid)
            if not ref_match:
                raise RuntimeError(f"Referencia L{rid}: partido no existe")
            _, ref_home, ref_away, _ = ref_match
            home_team = resolve_slot(ref_home, rid, winners)
            away_team = resolve_slot(ref_away, rid, winners)
            winner = winners[rid]
            if winner == home_team:
                return away_team
            if winner == away_team:
                return home_team
            raise RuntimeError(
                f"L{rid}: ganador {winner} no es ni home {home_team} ni away {away_team}"
            )
        raise RuntimeError(f"Slot ref no soportado: {ref}")

    winners = {}
    for mid, home_slot, away_slot, _ in KNOCKOUT_MATCHES:
        home_team = resolve_slot(home_slot, mid, winners)
        away_team = resolve_slot(away_slot, mid, winners)
        gl, gv = knockout_marc[mid]
        winners[mid] = home_team if gl > gv else away_team
    return winners


def deduce_podium(winners):
    """(champion, runner_up, third) derivados del bracket.

    Réplica de deducePodium en TS:
      champion = ganador(104), third = ganador(103),
      runner_up = el otro ganador de semi (101 ó 102) distinto del campeón.
    """
    champion = winners[104]
    third = winners[103]
    semi_winners = [winners[101], winners[102]]
    if champion not in semi_winners:
        raise RuntimeError(
            f"Campeón {champion} no aparece como ganador de semifinal {semi_winners}"
        )
    runner_up = next(t for t in semi_winners if t != champion)
    return champion, runner_up, third


# ---------------------------------------------------------------------------
# Emisión de SQL.
# ---------------------------------------------------------------------------

def _sql_str(s):
    """Literal SQL con escapado de comilla simple (Postgres standard_conforming_strings)."""
    return "'" + str(s).replace("'", "''") + "'"


def emit_sql(email, group_marc, standings, best_thirds, winners, podium, boots, balls):
    champion, runner_up, third = podium

    parts = []
    parts.append("-- Generado por lib/db/seed/import-porra-from-excel.py — no editar a mano.")
    parts.append(f"-- Usuario destino: {email}")
    parts.append("-- Idempotente: borra predicciones previas del usuario y reinserta.")
    parts.append("")
    parts.append("BEGIN;")
    parts.append("")
    parts.append("DO $$")
    parts.append("DECLARE target_user_id bigint;")
    parts.append("BEGIN")
    parts.append(f"  SELECT id INTO target_user_id FROM users WHERE email = {_sql_str(email)};")
    parts.append("  IF target_user_id IS NULL THEN")
    parts.append(f"    RAISE EXCEPTION 'Usuario no encontrado: %', {_sql_str(email)};")
    parts.append("  END IF;")
    parts.append("")
    parts.append("  -- 1. Limpiar predicciones previas")
    for table in (
        "predictions_group_matches",
        "predictions_group_standings",
        "predictions_best_thirds",
        "predictions_knockout",
        "predictions_awards",
    ):
        parts.append(f"  DELETE FROM {table} WHERE user_id = target_user_id;")
    parts.append("")

    # 2. Marcadores de fase de grupos
    parts.append("  -- 2. Marcadores de fase de grupos (72)")
    parts.append(
        "  INSERT INTO predictions_group_matches (user_id, match_id, goles_local, goles_visitante) VALUES"
    )
    rows = [
        f"    (target_user_id, {mid}, {group_marc[mid][0]}, {group_marc[mid][1]})"
        for mid in sorted(group_marc)
    ]
    parts.append(",\n".join(rows) + ";")
    parts.append("")

    # 3. Clasificación de grupos
    parts.append("  -- 3. Clasificación de grupos (48 = 12 × 4)")
    parts.append(
        "  INSERT INTO predictions_group_standings (user_id, group_letter, position, team_code) VALUES"
    )
    rows = []
    for g in sorted(standings):
        for i, team in enumerate(standings[g], start=1):
            rows.append(f"    (target_user_id, {_sql_str(g)}, {i}, {_sql_str(team)})")
    parts.append(",\n".join(rows) + ";")
    parts.append("")

    # 4. Mejores terceros
    parts.append("  -- 4. Mejores terceros (8)")
    parts.append(
        "  INSERT INTO predictions_best_thirds (user_id, position, team_code) VALUES"
    )
    rows = [
        f"    (target_user_id, {i}, {_sql_str(team)})"
        for i, team in enumerate(best_thirds, start=1)
    ]
    parts.append(",\n".join(rows) + ";")
    parts.append("")

    # 5. Eliminatorias
    parts.append("  -- 5. Ganadores de eliminatorias (32)")
    parts.append(
        "  INSERT INTO predictions_knockout (user_id, match_id, winner_team_code) VALUES"
    )
    rows = [
        f"    (target_user_id, {mid}, {_sql_str(winners[mid])})"
        for mid in sorted(winners)
    ]
    parts.append(",\n".join(rows) + ";")
    parts.append("")

    # 6. Premios (podio + botas + balones = 9)
    parts.append("  -- 6. Premios (3 podio + 3 botas + 3 balones)")
    parts.append(
        "  INSERT INTO predictions_awards (user_id, kind, team_code, player_name) VALUES"
    )
    award_rows = [
        ("champion", champion, None),
        ("runner_up", runner_up, None),
        ("third", third, None),
        ("boot_gold", None, boots[0]),
        ("boot_silver", None, boots[1]),
        ("boot_bronze", None, boots[2]),
        ("ball_gold", None, balls[0]),
        ("ball_silver", None, balls[1]),
        ("ball_bronze", None, balls[2]),
    ]
    rows = []
    for kind, team, player in award_rows:
        team_sql = "NULL" if team is None else _sql_str(team)
        player_sql = "NULL" if player is None else _sql_str(player)
        rows.append(f"    (target_user_id, {_sql_str(kind)}, {team_sql}, {player_sql})")
    parts.append(",\n".join(rows) + ";")
    parts.append("")

    parts.append("END $$;")
    parts.append("")
    parts.append("COMMIT;")
    return "\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# CLI.
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Importa una porra desde Excel a la BD vía SQL."
    )
    parser.add_argument("xlsx", help="Ruta al Excel del usuario.")
    parser.add_argument(
        "--email", required=True, help="Email del usuario destino (debe existir en `users`)."
    )
    parser.add_argument(
        "--output", "-o",
        help="Ruta del fichero SQL de salida. Por defecto stdout.",
    )
    args = parser.parse_args()

    porra = parse_porra(args.xlsx)
    mapping = load_best_thirds_mapping()
    tables = compute_group_tables(porra["group_marcadores"])
    standings = derive_standings(tables)
    best_thirds = derive_best_thirds(tables)
    winners = resolve_bracket(standings, best_thirds, porra["knockout_marcadores"], mapping)
    podium = deduce_podium(winners)

    sql = emit_sql(
        args.email,
        porra["group_marcadores"],
        standings,
        best_thirds,
        winners,
        podium,
        porra["boots"],
        porra["balls"],
    )

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(sql)
        print(
            f"Escrito en {args.output} ({sum(1 for _ in sql.splitlines())} líneas).",
            file=sys.stderr,
        )
    else:
        sys.stdout.write(sql)

    # Resumen en stderr (para inspección rápida sin contaminar el SQL en stdout).
    print(
        f"Resumen: 72 marcadores grupos · 48 standings · 8 mejores terceros · 32 knockouts · "
        f"champion={podium[0]}, runner_up={podium[1]}, third={podium[2]} · "
        f"botas={porra['boots']} · balones={porra['balls']}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
