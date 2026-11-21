#!/usr/bin/env python3
"""Builds docs/ from src/ and data/. Python 3 standard library only."""
import html
import importlib.util
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"
SRC = ROOT / "src"

SITE = "Hox Insect Lab"
# name: (title, description, scripts)
PAGES = {
    "index": ("Home", "Switch insect Hox genes on and off and see how the body changes. A free, kid-friendly science site with no accounts and no tracking.", []),
    "learn": ("Learn", "Eight short lessons on segments and Hox genes, each with a try-it button for the Lab and a quick quiz.", ["learn.js"]),
    "glossary": ("Glossary", "Plain-language meanings of Hox gene and insect body words, A to Z, with search.", ["glossary.js"]),
    "teachers": ("For Teachers", "Learning goals, a 45-minute lesson plan, a worksheet with answer key and common misconceptions for the Hox Insect Lab.", []),
    "about": ("About and Sources", "What the Hox Insect Lab is, where its data comes from, credits and our privacy promise.", []),
    "404": ("Page not found", "This page flew away. Head back to the Hox Insect Lab home page.", []),
}
CONTENT = {"teachers": "teachers.html", "about": "about.html"}

THEME_INIT = ("(function(){try{var t=localStorage.getItem('hox-theme');"
              "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();")


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def mark_current(header: str, page: str) -> str:
    """Add aria-current="page" to the nav link for this page."""
    return re.sub(r'(<a href="%s\.html")(>)' % re.escape(page), r'\1 aria-current="page"\2', header, count=1)


def head(page: str, title: str, desc: str) -> str:
    full = SITE if page == "index" else f"{title} · {SITE}"
    full = f"Home · {SITE}" if page == "index" else full
    og_img = ""
    if (SRC / "assets/img/og.png").exists():
        og_img = '\n<meta property="og:image" content="assets/img/og.png">'
    d = html.escape(desc, quote=True)
    t = html.escape(full)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">{og_img}
<link rel="icon" href="assets/img/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="vendor/fonts/fonts.css">
<link rel="stylesheet" href="assets/chrome.css">
<link rel="stylesheet" href="assets/site.css">
<script>{THEME_INIT}</script>
</head>
"""


def main():
    header = read(SRC / "partials/header.html").strip()
    footer = read(SRC / "partials/footer.html").strip()

    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    shutil.copytree(SRC / "assets", DOCS / "assets")
    shutil.copytree(ROOT / "vendor", DOCS / "vendor")
    (DOCS / "data").mkdir()
    for n in ("lessons.json", "glossary.json"):
        f = ROOT / "data" / n
        if f.exists():
            shutil.copy(f, DOCS / "data" / n)
        else:
            print(f"warning: data/{n} missing")

    have_png = (SRC / "assets/img/hero-normal.png").exists() and (SRC / "assets/img/hero-fourwing.png").exists()
    hero = {
        "{{hero_normal}}": "assets/img/hero-normal.png" if have_png else "assets/img/fourwings.svg",
        "{{hero_four}}": "assets/img/hero-fourwing.png" if have_png else "assets/img/fourwings.svg",
    }

    for page, (title, desc, scripts) in PAGES.items():
        body = read(SRC / "pages" / f"{page}.html")
        if page in CONTENT:
            frag = SRC / "content" / CONTENT[page]
            if frag.exists():
                content = read(frag)
            else:
                print(f"warning: {frag.relative_to(ROOT)} missing, using placeholder")
                content = '<p class="callout">Content coming soon.</p>'
            body = body.replace("{{content}}", content)
        for k, v in hero.items():
            body = body.replace(k, v)
        hdr = mark_current(header, page)
        scr = "".join(f'<script src="assets/{s}" defer></script>\n' for s in ["site.js"] + scripts)
        out = head(page, title, desc) + "<body>\n" + hdr + "\n" + body + "\n" + footer + "\n" + scr + "</body>\n</html>\n"
        (DOCS / f"{page}.html").write_text(out, encoding="utf-8")

    lab_note = "lab via build_lab"
    bl = ROOT / "scripts/build_lab.py"
    if bl.exists():
        spec = importlib.util.spec_from_file_location("build_lab", bl)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.build_lab(ROOT, DOCS, mark_current(header, "lab"), footer)
    else:
        print("warning: scripts/build_lab.py missing, writing placeholder lab.html")
        lab_note = "lab PLACEHOLDER"
        out = (head("lab", "Lab", "The Hox Insect Lab: switch genes on and off and see the insect body change.")
               + "<body>\n" + mark_current(header, "lab")
               + '\n<main id="main" class="page"><h1>Lab</h1><p class="callout">The Lab is not built yet.</p></main>\n'
               + footer + '\n<script src="assets/site.js" defer></script>\n</body>\n</html>\n')
        (DOCS / "lab.html").write_text(out, encoding="utf-8")

    n = len(list(DOCS.rglob("*.*")))
    print(f"built {len(PAGES) + 1} pages ({lab_note}), {n} files in docs/")


if __name__ == "__main__":
    sys.exit(main())
