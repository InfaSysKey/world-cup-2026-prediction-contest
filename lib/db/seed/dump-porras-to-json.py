#!/usr/bin/env python3
"""Extrae las predicciones de cada Excel de `porras-excel/` a JSON legible.

Lee la hoja `WORLDCUP` de cada .xlsx (mismo parser que import-porra-from-excel.py)
y vuelca un JSON por jugador en `porras-json/<archivo>.json`. Pensado para
inspeccionar lo que el Excel REALMENTE contiene antes de importar a la BD: si
algún jugador rellenó mal (LibreOffice/Numbers desplazó algún marcador, p. ej.),
se ve mucho más rápido en JSON que en .xlsx.

El JSON incluye los datos crudos de cada cruce (J, AH, row, AC, AD, col D) para
que puedas detectar desfases. Si el archivo está "sano", J == AH == match_id en
todos los partidos.

Uso:
  python3 lib/db/seed/dump-porras-to-json.py
  python3 lib/db/seed/dump-porras-to-json.py porras-excel/Excel-...-CARLOS.xlsx

Sin args procesa TODOS los .xlsx de porras-excel/.
"""

import glob
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _col(ref: str) -> str:
    return re.match(r"([A-Z]+)\d+", ref).group(1)


def _load_shared(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [
        "".join(t.text or "" for t in si.iter(f"{NS}t"))
        for si in root.findall(f"{NS}si")
    ]


def _read_rows(z: zipfile.ZipFile, sheet: str, shared: list[str]) -> dict:
    root = ET.fromstring(z.read(f"xl/worksheets/{sheet}"))
    sd = root.find(f"{NS}sheetData")
    rows = {}
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
                cells[_col(c.get("r"))] = val
        rows[int(row.get("r"))] = cells
    return rows


def dump_porra(xlsx_path: str) -> dict:
    z = zipfile.ZipFile(xlsx_path)
    shared = _load_shared(z)
    wc = _read_rows(z, "sheet2.xml", shared)

    group = {}
    knockout = {}
    for rn, cells in sorted(wc.items()):
        ac = cells.get("AC")
        ad = cells.get("AD")
        if ac is None or ad is None:
            continue
        ah = cells.get("AH", "")
        j = cells.get("J", "")
        d = cells.get("D", "")
        if ah.isdigit() and 1 <= int(ah) <= 72:
            mid = int(ah)
            group[mid] = {
                "local": int(ac),
                "visitante": int(ad),
                "row": rn,
                "J": j,
                "AH": int(ah),
            }
            continue
        if j.isdigit() and 73 <= int(j) <= 104:
            mid = int(j)
            knockout[mid] = {
                "local": int(ac),
                "visitante": int(ad),
                "row": rn,
                "J": int(j),
                "AH": int(ah) if ah.isdigit() else None,
                "winner_override": d or None,
            }

    def aa(row):
        return wc.get(row, {}).get("AA")

    boots = [aa(154), aa(155), aa(156)]
    balls = [aa(158), aa(159), aa(160)]

    sano_grupos = all(g["J"] == str(mid) for mid, g in group.items())
    sano_knockouts = all(k["AH"] == mid for mid, k in knockout.items())

    return {
        "file": os.path.basename(xlsx_path),
        "sanity": {
            "groups_J_eq_AH": sano_grupos,
            "knockouts_J_eq_AH": sano_knockouts,
            "knockouts_count": len(knockout),
            "groups_count": len(group),
        },
        "group_matches": dict(sorted(group.items())),
        "knockout": dict(sorted(knockout.items())),
        "boots": boots,
        "balls": balls,
    }


def main():
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "porras-excel", "*.xlsx")))
    out_dir = os.path.join(ROOT, "porras-json")
    os.makedirs(out_dir, exist_ok=True)
    for f in files:
        if not os.path.isfile(f):
            print(f"⚠️  {f} no existe, salto.", file=sys.stderr)
            continue
        data = dump_porra(f)
        out_name = os.path.splitext(os.path.basename(f))[0] + ".json"
        out_path = os.path.join(out_dir, out_name)
        with open(out_path, "w", encoding="utf-8") as out:
            json.dump(data, out, indent=2, ensure_ascii=False)
        san = data["sanity"]
        warn = "" if (san["groups_J_eq_AH"] and san["knockouts_J_eq_AH"]) else "  ⚠️ DESFASE J≠AH"
        print(f"{out_name}  ({san['groups_count']} grupos · {san['knockouts_count']} knockouts){warn}")


if __name__ == "__main__":
    main()
