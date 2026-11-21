#!/usr/bin/env python3
"""Build the Lab page: inject data into src/lab.html and write <out_dir>/lab.html.

Used by build.py (build_lab) or run alone for a test build in .tmp/.
"""
import json
import pathlib
import shutil
import sys

TOKENS = {
    "__SPECIES_JSON__": ("data/species.json", None),
    "__PHENO_JSON__": ("data/phenotypes.json", {"records": []}),
    "__HYPO_JSON__": ("data/hypotheses.json", {"items": []}),
    "__ATLAS_JSON__": ("data/atlas.json", {"classes": []}),
    "__LESSONS_JSON__": ("data/lessons.json", {"lessons": []}),
    "__TOUR_JSON__": ("data/tour.json", {"steps": []}),
}


def js(o):
    """JSON safe inside <script type="application/json">."""
    return json.dumps(o, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")


def build_lab(root: pathlib.Path, out_dir: pathlib.Path, header_html: str, footer_html: str) -> pathlib.Path:
    root, out_dir = pathlib.Path(root), pathlib.Path(out_dir)
    tpl = (root / "src/lab.html").read_text(encoding="utf-8")
    for tok in list(TOKENS) + ["{{header}}", "{{footer}}"]:
        assert tpl.count(tok) == 1, f"{tok} must appear exactly once in src/lab.html"
    out = tpl
    for tok, (rel, default) in TOKENS.items():
        p = root / rel
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
        elif default is not None:
            data = default
        else:
            raise FileNotFoundError(p)
        out = out.replace(tok, js(data))
    # header/footer last so their text is never scanned for data tokens
    out = out.replace("{{header}}", header_html).replace("{{footer}}", footer_html)
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "lab.html"
    dest.write_text(out, encoding="utf-8")
    return dest


if __name__ == "__main__":
    root = pathlib.Path(__file__).resolve().parent.parent
    out_dir = root / ".tmp"
    header = '<header class="site-head"><a href="index.html">Hox Insect Lab (test header)</a></header>'
    footer = '<footer class="site-foot"><p>Test footer</p></footer>'
    dest = build_lab(root, out_dir, header, footer)
    for sub, src in (("vendor", root / "vendor"), ("assets", root / "src/assets")):
        d = out_dir / sub
        if d.exists():
            shutil.rmtree(d)
        if src.exists():
            shutil.copytree(src, d)
    print(f"wrote {dest} ({dest.stat().st_size // 1024} KB)", file=sys.stderr)
