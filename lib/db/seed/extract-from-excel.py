#!/usr/bin/env python3
"""Herramienta dev de un solo uso (no forma parte de la app ni del CI).

Lee la plantilla canónica `Excel-Mundial-2026.xlsx` (ExcelFutbol) y emite tres
ficheros TypeScript que SÍ usa la app:

  - lib/db/seed/teams.ts            (48 selecciones)
  - lib/db/seed/matches.ts          (104 partidos)
  - lib/scoring/best-thirds-mapping.ts  (495 combinaciones de mejores terceros)

Uso:  python3 lib/db/seed/extract-from-excel.py [ruta_al_xlsx]

Decisiones (acordadas con el dueño del proyecto):
  - Las fechas del Excel son hora de España (Europe/Madrid); se convierten a UTC.
  - Los códigos de equipo son ISO-3166 alpha-3 (FIFA para Inglaterra/Escocia).
  - Solo stdlib: el .xlsx es un zip de XML (zipfile + ElementTree).
"""

import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo

    MADRID = ZoneInfo("Europe/Madrid")
except Exception:  # pragma: no cover - fallback si no hay tzdata
    MADRID = None

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DEFAULT_XLSX = os.path.expanduser("~/Downloads/Excel-Mundial-2026.xlsx")

# Nombre en español (tal como aparece en el Excel) -> código ISO-3166 alpha-3.
# Inglaterra y Escocia usan el código FIFA (no son países ISO-3166).
TEAM_CODES = {
    "Alemania": "DEU", "Arabia Saudita": "SAU", "Argelia": "DZA",
    "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
    "Bélgica": "BEL", "Bosnia y Herzegovina": "BIH", "Brasil": "BRA",
    "Cabo Verde": "CPV", "Canadá": "CAN", "Catar": "QAT",
    "Colombia": "COL", "Corea del Sur": "KOR", "Costa de Marfil": "CIV",
    "Croacia": "HRV", "Curazao": "CUW", "Ecuador": "ECU",
    "Egipto": "EGY", "Escocia": "SCO", "España": "ESP",
    "Estados Unidos": "USA", "Francia": "FRA", "Ghana": "GHA",
    "Haití": "HTI", "Inglaterra": "ENG", "Irak": "IRQ",
    "Irán": "IRN", "Japón": "JPN", "Jordania": "JOR",
    "Marruecos": "MAR", "México": "MEX", "Noruega": "NOR",
    "Nueva Zelanda": "NZL", "Países Bajos": "NLD", "Panamá": "PAN",
    "Paraguay": "PRY", "Portugal": "PRT", "RD Congo": "COD",
    "República Checa": "CZE", "Senegal": "SEN", "Sudáfrica": "ZAF",
    "Suecia": "SWE", "Suiza": "CHE", "Túnez": "TUN",
    "Turquía": "TUR", "Uruguay": "URY", "Uzbekistán": "UZB",
}


def col_letters(ref):
    return re.match(r"([A-Z]+)\d+", ref).group(1)


def load_shared(z):
    out = []
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return out
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def read_rows(z, sheet_file, shared):
    """Devuelve {rownum: {col_letter: value}} para una hoja."""
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
                cells[col_letters(c.get("r"))] = val
        rows[int(row.get("r"))] = cells
    return rows


def serial_to_utc(serial):
    """Serial Excel (1900) interpretado como hora de Madrid -> ISO UTC."""
    naive = datetime(1899, 12, 30) + timedelta(days=float(serial))
    # Redondeo al minuto (los seriales arrastran ruido de coma flotante).
    naive = (naive + timedelta(seconds=30)).replace(second=0, microsecond=0)
    if MADRID is not None:
        utc = naive.replace(tzinfo=MADRID).astimezone(timezone.utc)
    else:
        utc = (naive - timedelta(hours=2)).replace(tzinfo=timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def phase_for(match_id):
    if match_id <= 72:
        return "grupos"
    if match_id <= 88:
        return "1/16"
    if match_id <= 96:
        return "1/8"
    if match_id <= 100:
        return "cuartos"
    if match_id <= 102:
        return "semi"
    if match_id == 103:
        return "3-4"
    return "final"


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    z = zipfile.ZipFile(xlsx)
    shared = load_shared(z)

    equipos = read_rows(z, "sheet8.xml", shared)   # Equipos
    worldcup = read_rows(z, "sheet2.xml", shared)  # WORLDCUP (calendario)
    combis = read_rows(z, "sheet6.xml", shared)    # Combinaciones (terceros)

    # ---- Equipos -> grupo y bandera ----
    group_of, flag_of = {}, {}
    for r in range(2, 50):
        cells = equipos.get(r, {})
        if "B" in cells and "C" in cells:
            group_of[cells["B"]] = cells["C"]
        if "K" in cells and "L" in cells:
            flag_of[cells["K"]] = cells["L"]

    teams = []
    for name in sorted(group_of):
        if name not in TEAM_CODES:
            raise SystemExit(f"Falta código ISO para: {name!r}")
        if name not in flag_of:
            raise SystemExit(f"Falta bandera para: {name!r}")
        teams.append({
            "code": TEAM_CODES[name], "nameEs": name,
            "flagEmoji": flag_of[name], "groupLetter": group_of[name],
        })
    teams.sort(key=lambda t: t["code"])
    assert len(teams) == 48, f"esperaba 48 equipos, hay {len(teams)}"

    # ---- WORLDCUP -> 104 partidos ----
    matches = {}
    for cells in worldcup.values():
        ah = cells.get("AH")
        if not (ah and ah.isdigit() and "AA" in cells and "AF" in cells):
            continue
        mid = int(ah)
        if mid < 1 or mid > 104 or mid in matches:
            continue
        home, away = cells["AA"], cells["AF"]
        when = serial_to_utc(cells["X"])
        if mid <= 72:  # fase de grupos: AA/AF son nombres de equipo
            matches[mid] = {
                "id": mid, "phase": "grupos",
                "groupLetter": group_of[home], "jornada": cells.get("Z"),
                "scheduledAt": when,
                "homeTeamCode": TEAM_CODES[home], "awayTeamCode": TEAM_CODES[away],
            }
        else:  # eliminatorias: AA/AF son slot-refs
            matches[mid] = {
                "id": mid, "phase": phase_for(mid),
                "bracketSlot": f"W{mid}", "scheduledAt": when,
                "homeSlotRef": home, "awaySlotRef": away,
            }
    assert len(matches) == 104, f"esperaba 104 partidos, hay {len(matches)}"
    assert sum(1 for m in matches.values() if m["phase"] == "grupos") == 72

    # ---- Combinaciones -> mejores terceros ----
    # Cabecera fila 1: columnas P..W = slots anfitriones (1A,1B,...). Cada uno
    # corresponde al match de 1/16 cuyo home_slot_ref es ese slot y cuyo rival
    # es un tercero (away_slot_ref empieza por "3").
    header = combis[1]
    slot_cols = {col: header[col] for col in ("P", "Q", "R", "S", "T", "U", "V", "W")}
    slot_to_match = {}
    for m in matches.values():
        ref = m.get("awaySlotRef", "")
        if m["phase"] == "1/16" and ref.startswith("3"):
            slot_to_match[m["homeSlotRef"]] = m["id"]
    col_to_match = {col: slot_to_match[slot] for col, slot in slot_cols.items()}

    mapping = {}
    for r in range(2, 497):
        cells = combis.get(r, {})
        combo = cells.get("N")
        if not combo:
            continue
        inner = {}
        for col, mid in col_to_match.items():
            third = cells.get(col, "")  # p.ej. "3E"
            if third.startswith("3"):
                inner[mid] = third[1:]  # -> "E"
        mapping[combo] = inner
    assert len(mapping) == 495, f"esperaba 495 combinaciones, hay {len(mapping)}"

    write_teams(teams)
    write_matches(matches)
    write_best_thirds(mapping)
    print(f"OK: {len(teams)} equipos, {len(matches)} partidos, {len(mapping)} combinaciones")


HEADER = "// AUTO-GENERADO por lib/db/seed/extract-from-excel.py — no editar a mano.\n"


def js(s):
    """Literal de string JS con comillas simples, conservando el unicode literal
    (los repr de Python escapan los tag-chars de banderas y rompen el TS)."""
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_teams(teams):
    lines = [HEADER, "import type { NewTeam } from '../index';\n\n",
             "export const TEAMS: NewTeam[] = [\n"]
    for t in teams:
        lines.append(
            f"  {{ code: {js(t['code'])}, nameEs: {js(t['nameEs'])}, "
            f"flagEmoji: {js(t['flagEmoji'])}, groupLetter: {js(t['groupLetter'])} }},\n"
        )
    lines.append("];\n")
    _write("lib/db/seed/teams.ts", lines)


def write_matches(matches):
    lines = [HEADER, "import type { NewMatch } from '../index';\n\n",
             "export const MATCHES: NewMatch[] = [\n"]
    for mid in sorted(matches):
        m = matches[mid]
        parts = [f"id: {m['id']}", f"phase: {js(m['phase'])}"]
        if m["phase"] == "grupos":
            parts.append(f"groupLetter: {js(m['groupLetter'])}")
            parts.append(f"jornada: {js(m['jornada'])}")
        else:
            parts.append(f"bracketSlot: {js(m['bracketSlot'])}")
        parts.append(f"scheduledAt: new Date({js(m['scheduledAt'])})")
        if m["phase"] == "grupos":
            parts.append(f"homeTeamCode: {js(m['homeTeamCode'])}")
            parts.append(f"awayTeamCode: {js(m['awayTeamCode'])}")
        else:
            parts.append(f"homeSlotRef: {js(m['homeSlotRef'])}")
            parts.append(f"awaySlotRef: {js(m['awaySlotRef'])}")
        lines.append("  { " + ", ".join(parts) + " },\n")
    lines.append("];\n")
    _write("lib/db/seed/matches.ts", lines)


def write_best_thirds(mapping):
    lines = [HEADER,
             "// Clave: las 8 letras (ordenadas) de los grupos cuyo 3.º clasifica.\n",
             "// Valor: { matchId de 1/16 -> letra del grupo cuyo 3.º juega ahí }.\n\n",
             "export const BEST_THIRDS_MAPPING: Record<string, Record<number, string>> = {\n"]
    for combo in sorted(mapping):
        inner = mapping[combo]
        body = ", ".join(f"{mid}: {js(grp)}" for mid, grp in sorted(inner.items()))
        lines.append(f"  {js(combo)}: {{ {body} }},\n")
    lines.append("};\n")
    _write("lib/scoring/best-thirds-mapping.ts", lines)


def _write(rel, lines):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(lines))


if __name__ == "__main__":
    main()
