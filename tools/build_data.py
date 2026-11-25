"""Empaqueta los artefactos públicos del dashboard en data/deck-data.js.

La presentación lee un único archivo JS (window.DECK = {...}) en vez de hacer
fetch: así funciona también abierta con doble clic (file://), sin servidor y
sin internet el día de la sustentación.

Uso:
    python tools/build_data.py                      # lee ../thesis-dashboard/public/data/lima
    python tools/build_data.py --src RUTA/A/lima

Solo usa los artefactos ya publicados (agregados a celdas de 200 m / 1 km);
no lee nada del pipeline privado.
"""
from __future__ import annotations

import argparse
import json
import struct
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT.parent / "thesis-dashboard" / "public" / "data" / "lima"
FOCUS_MONTH = "2023-04"   # el mes del recorte de explainer.json


def load(src: Path, name: str):
    with open(src / name, encoding="utf-8") as f:
        return json.load(f)


def r(x, nd=3):
    return None if x is None else round(float(x), nd)


def city_grid(src: Path) -> dict:
    """Celdas únicas de crimes.bin con su conteo total y por año."""
    meta = load(src, "crimes_meta.json")
    n = meta["n"]
    buf = (src / "crimes.bin").read_bytes()
    lat = struct.unpack_from(f"<{n}H", buf, 0)
    lon = struct.unpack_from(f"<{n}H", buf, 2 * n)
    month = buf[7 * n: 8 * n]
    months = meta["months"]
    years = sorted({m[:4] for m in months})
    yidx = [years.index(m[:4]) for m in months]
    tot: Counter = Counter()
    per_year: dict = defaultdict(lambda: [0] * len(years))
    for i in range(n):
        k = (lat[i], lon[i])
        tot[k] += 1
        per_year[k][yidx[month[i]]] += 1
    # Se reduce la cuantización a 0..4095 (≈ 20 m sobre Lima): sobra para dibujar.
    cells = []
    for (la, lo), c in tot.items():
        cells.append([lo >> 4, la >> 4, c])
    cells.sort(key=lambda t: t[2])
    return {"bbox": meta["bbox"], "q": 4095, "cells": cells, "years": years,
            "n": n}


def hotspots_detail(src: Path) -> tuple[dict, list]:
    """Detalle de la selección por mes y polígonos del mes foco."""
    gj = load(src, "hotspots.geojson")
    llr: dict = defaultdict(list)
    seen = set()
    polys = []
    for f in gj["features"]:
        p = f["properties"]
        if f["geometry"]["type"] == "Polygon" and p["month"] == FOCUS_MONTH:
            ring = f["geometry"]["coordinates"][0]
            polys.append({"id": p["id"], "crimes": p["crimes"], "rank": p["rank"],
                          "ring": [[round(x, 5), round(y, 5)] for x, y in ring]})
        if p["id"] in seen:
            continue
        seen.add(p["id"])
        llr[p["month"]].append(p["llr"])
    detail = {}
    for row in gj["meta"].get("monthly", []):
        s = row.get("selection") or {}
        if not s.get("candidates") or not s.get("null"):
            continue
        detail[row["month"]] = {
            "cand": s["candidates"], "kept": s["kept"], "thr": r(s["threshold"], 2),
            "nMean": r(s["null"]["mean"], 2), "nMax": r(s["null"]["max"], 2),
            "llr": [r(v, 1) for v in sorted(llr[row["month"]], reverse=True)],
        }
    polys.sort(key=lambda h: h["rank"])
    return detail, polys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "deck-data.js")
    a = ap.parse_args()
    src = a.src

    val = load(src, "validation_report.json")
    ev = load(src, "evaluation.json")
    bench = load(src, "benchmark.json")
    cs = load(src, "casestudies.json")
    ex = load(src, "explainer.json")
    datasets = load(src.parent, "datasets.json")
    ds = next(d for d in datasets["datasets"] if d["id"] == "lima")

    geo = val["geocoding"]
    funnel = {
        "total": val["total_rows"], "duplicates": val["duplicate_rows"],
        "discarded": val["discarded_rows"], "window": val["filtered_rows"],
        "flagged": val["source_by_reason"]["marcada_por_la_fuente"],
        "filler": val["source_by_reason"]["centroide_de_relleno"],
        "recovered": val["recovered_rows"], "kept": val["kept_rows"],
        "holdout_p50": geo["holdout"]["p50_m"],
        "columns_in": len(val["columns_in"]), "columns_kept": len(val["columns_kept"]),
        "top_fallback": val["fallback_points"][0]["rows"] if val["fallback_points"] else None,
    }
    cats = sorted(val["categories"].items(), key=lambda kv: -kv[1])

    reg = bench["regimes"][bench.get("default_regime", "lima")]
    sweep = []
    for p in (reg.get("sweep", {}).get("axes", {}).get("sigma") or []):
        row = {"sigma": p["value"]}
        for m in ("topologico", "voraz", "anchura"):
            if m in p:
                row[m] = {k: r(p[m][k]["mean"]) for k in ("ppv", "sensitivity", "f1")}
        sweep.append(row)

    detail, polys = hotspots_detail(src)

    deck = {
        "dataset": {k: ds[k] for k in ("label", "n", "window", "months", "categories")},
        "caveat": (ds.get("caveats") or [{}])[0],
        "funnel": funnel,
        "months": val["months"],
        "categories": cats[:8],
        "eval": {
            "network": ev["meta"]["network"],
            "params": ev["meta"]["params"],
            "selection": ev["meta"]["selection"],
            "crimes_snapped": ev["meta"]["crimes_snapped"],
            "months": ev["meta"]["months"],
            "methods": ev["methods"],
            "monthly": [{"m": x["month"], "k": x["topo_hotspots"], "crimes": x["crimes"],
                         "cov": r(x["topo_coverage"])} for x in ev["monthly"]],
        },
        "selection": detail,
        "bench": {
            "params": {k: reg["params"][k] for k in ("realisations", "parents", "offspring", "background")},
            "methods": {m: {k: r(v["summary"][k]["mean"]) for k in ("ppv", "sensitivity", "f1")}
                        for m, v in reg["methods"].items()},
            "null_check": reg["null_check"],
            "realisation": reg.get("realisation"),
            "sweep": sweep,
        },
        "cs": {
            "matched_poi_contrast": cs["matched_poi_contrast"],
            "n_pairs": len(cs["matched_pairs"]),
            "quadrants": cs["quadrants"]["counts"],
            "persistence": {k: cs["persistence"][k] for k in ("n_significant", "n_tested", "coverage_mean")},
            "n_persistent": cs["meta"]["n_persistent"], "n_episodic": cs["meta"]["n_episodic"],
            "n_trajectories": len(cs["trajectories"]),
            "topology_contrast": cs["topology_contrast"][:6],
        },
        "city": city_grid(src),
        "focus_hotspots": {"month": FOCUS_MONTH, "polys": polys},
        "explainer": ex,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    js = "/* Generado por tools/build_data.py: no editar a mano. */\nwindow.DECK = " + \
         json.dumps(deck, ensure_ascii=False, separators=(",", ":")) + ";\n"
    a.out.write_text(js, encoding="utf-8")
    print(f"{a.out.relative_to(ROOT)}: {len(js) / 1e6:.2f} MB · "
          f"{len(deck['city']['cells'])} celdas · {len(polys)} hotspots de {FOCUS_MONTH}")


if __name__ == "__main__":
    main()
