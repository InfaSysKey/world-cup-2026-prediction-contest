#!/usr/bin/env python3
"""Compara para cada Excel: lo que el archivo MUESTRA (AA=home name, AF=away
name, D=winner name, cacheados por las fórmulas) vs lo que el importer extrae
y deduce para cada cruce. Reporta solo las discrepancias.

Si el Excel del jugador tiene fórmulas activas (las 7 porras del grupo lo
tienen, menos Carlos), AA/AF/D están con valor cacheado y son la fuente más
fiable de "qué cruce ve el jugador en esa fila".

Para Carlos (fórmulas rotas) no hay valores cacheados → se reporta solo el
mid y se confía en la resolución del importer.
"""

import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.dirname(__file__))
_g = {"__name__": "_imp", "__file__": "lib/db/seed/import-porra-from-excel.py"}
exec(compile(open("lib/db/seed/import-porra-from-excel.py").read(), "imp", "exec"), _g)
parse_porra = _g["parse_porra"]
compute_group_tables = _g["compute_group_tables"]
derive_standings = _g["derive_standings"]
derive_best_thirds = _g["derive_best_thirds"]
resolve_bracket = _g["resolve_bracket"]
load_best_thirds_mapping = _g["load_best_thirds_mapping"]
KNOCKOUT_MATCHES = _g["KNOCKOUT_MATCHES"]
TEAM_NAME_ES = _g["TEAM_NAME_ES"]
TEAM_CODE_TO_NAME = {v: k for k, v in TEAM_NAME_ES.items()}


def name(code: str) -> str:
    return TEAM_CODE_TO_NAME.get(code, code or "?")


def col_of(ref: str) -> str:
    return re.match(r"([A-Z]+)\d+", ref).group(1)


def normalize(s: str) -> str:
    """Devuelve nombre canónico en español si lo reconoce, si no el string sin
    cambios. Cubre alias comunes ("Inglaterra" == "England", etc.) no, dejamos
    solo la forma normalizada del catálogo."""
    if not s:
        return ""
    s = s.strip()
    code = TEAM_NAME_ES.get(s)
    if code:
        return TEAM_CODE_TO_NAME.get(code, s)
    # tolerancia: minúsculas + tildes
    import unicodedata
    nfd = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()
    for n, c in TEAM_NAME_ES.items():
        nfd2 = "".join(c2 for c2 in unicodedata.normalize("NFD", n) if unicodedata.category(c2) != "Mn").lower()
        if nfd == nfd2:
            return n
    return s


def excel_view(path: str) -> dict:
    """Devuelve {mid: (home_name, away_name, gl, gv, winner_name)} extraído del
    Excel (cacheado por fórmulas si las tiene). mid se toma de AH (cruce real)."""
    z = zipfile.ZipFile(path)
    shared = []
    try:
        rs = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in rs.findall(f"{NS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    except KeyError:
        pass

    root = ET.fromstring(z.read("xl/worksheets/sheet2.xml"))
    sd = root.find(f"{NS}sheetData")
    out = {}
    for row in sd.findall(f"{NS}row"):
        cells = {}
        for c in row.findall(f"{NS}c"):
            t, v, isv = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
            if t == "s" and v is not None and shared:
                val = shared[int(v.text)]
            elif t == "inlineStr" and isv is not None:
                val = "".join(x.text or "" for x in isv.iter(f"{NS}t"))
            elif v is not None:
                val = v.text
            else:
                continue
            if val not in (None, ""):
                cells[col_of(c.get("r"))] = val
        ah = cells.get("AH", "")
        ac = cells.get("AC")
        ad = cells.get("AD")
        if ah.isdigit() and ac is not None and ad is not None and 73 <= int(ah) <= 104:
            mid = int(ah)
            out[mid] = (
                cells.get("AA", ""),
                cells.get("AF", ""),
                int(ac),
                int(ad),
                cells.get("D", ""),
            )
    return out


def importer_view(path: str) -> dict:
    """Devuelve {mid: (home_name, away_name, gl, gv, winner_name)} según el
    bracket que resuelve el importer."""
    p = parse_porra(path)
    tables = compute_group_tables(p["group_marcadores"])
    standings = derive_standings(tables)
    best_thirds = derive_best_thirds(tables)
    mapping = load_best_thirds_mapping()
    standings = _g.get("merge_with_excel_standings", lambda s, e: s)(standings, p.get("excel_standings", {}))
    best_thirds = _g.get("derive_best_thirds_from_standings", _g["derive_best_thirds"])(standings, tables) if "derive_best_thirds_from_standings" in _g else best_thirds
    winners = resolve_bracket(standings, best_thirds, p["knockout_marcadores"], p["knockout_winner_override"], mapping)
    KO_BY_ID = {m[0]: m for m in KNOCKOUT_MATCHES}
    TEAM_GROUP = _g["TEAM_GROUP"]

    STANDING_REF = r"^([12])([A-L])$"
    THIRD_REF = r"^3[A-L]+$"
    WINNER_REF = r"^W(\d+)$"
    LOSER_REF = r"^L(\d+)$"

    third_groups = sorted({TEAM_GROUP[t] for t in best_thirds})
    combo = "".join(third_groups) if len(third_groups) == 8 else None
    third_map = mapping.get(combo, {}) if combo else {}

    def resolve_side(ref: str, own_mid: int) -> str:
        m = re.match(STANDING_REF, ref)
        if m:
            pos, grp = m.group(1), m.group(2)
            return standings[grp][int(pos) - 1]
        if re.match(THIRD_REF, ref):
            grp = third_map.get(own_mid)
            return standings[grp][2] if grp else "?"
        m = re.match(WINNER_REF, ref)
        if m:
            return winners.get(int(m.group(1)), "?")
        m = re.match(LOSER_REF, ref)
        if m:
            rid = int(m.group(1))
            rm = KO_BY_ID.get(rid)
            if not rm:
                return "?"
            rh = resolve_side(rm[1], rid)
            ra = resolve_side(rm[2], rid)
            rw = winners.get(rid)
            if rw == rh:
                return ra
            if rw == ra:
                return rh
            return "?"
        return "?"

    out = {}
    for mid, hs, as_, _ in KNOCKOUT_MATCHES:
        home = resolve_side(hs, mid)
        away = resolve_side(as_, mid)
        gl, gv = p["knockout_marcadores"][mid]
        out[mid] = (name(home), name(away), gl, gv, name(winners[mid]))
    return out


def diff_porra(path: str) -> list:
    ex = excel_view(path)
    im = importer_view(path)
    issues = []
    for mid in sorted(im):
        exh, exa, exgl, exgv, exwin = ex.get(mid, ("?", "?", "?", "?", "?"))
        imh, ima, imgl, imgv, imwin = im[mid]
        exh_n, exa_n, exwin_n = normalize(exh), normalize(exa), normalize(exwin)
        if not exh_n and not exa_n:
            # Fórmulas rotas (caso Carlos). No podemos comparar contra el Excel,
            # confiamos en lo que el importer infiere.
            continue
        # Comparamos los nombres tras normalizar
        if exh_n and imh != exh_n:
            issues.append(f"  cruce {mid}: home Excel='{exh_n}' importer='{imh}'")
        if exa_n and ima != exa_n:
            issues.append(f"  cruce {mid}: away Excel='{exa_n}' importer='{ima}'")
        if (imgl, imgv) != (exgl, exgv):
            issues.append(f"  cruce {mid}: marcador Excel={exgl}-{exgv} importer={imgl}-{imgv}")
        if exwin_n and imwin != exwin_n:
            issues.append(f"  cruce {mid}: winner Excel='{exwin_n}' importer='{imwin}'")
    return issues


def main():
    import glob
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "porras-excel", "*.xlsx")))
    total_issues = 0
    for f in files:
        issues = diff_porra(f)
        title = os.path.basename(f)
        if not issues:
            print(f"✅ {title}")
        else:
            print(f"❌ {title}  ({len(issues)} discrepancias)")
            for i in issues:
                print(i)
            total_issues += len(issues)
    print(f"\nTotal discrepancias: {total_issues}")


if __name__ == "__main__":
    main()
