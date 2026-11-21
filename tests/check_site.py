#!/usr/bin/env python3
"""Checks the built site in docs/. Run after `python3 build.py`.

Exits 1 and lists every failure; prints each lesson's simulated changes so a
reviewer can compare them with the lesson text.
"""
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
PAGES = ["index", "learn", "lab", "glossary", "teachers", "about", "404"]
PICTURES = {"segments", "genes", "backwins", "fourwings", "headlegs", "flybeetle", "headcode", "evidence"}
fails = []


def fail(msg):
    fails.append(msg)


class Refs(HTMLParser):
    """Collects resource references (things the browser loads) and links."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.loads, self.links, self.tags, self.importmaps = [], [], {}, []
        self._in_importmap = False
        self._in_style = False
        self.styles = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.setdefault(tag, []).append(a)
        if tag == "script" and a.get("type") == "importmap":
            self._in_importmap = True
        if tag == "style":
            self._in_style = True
        if tag in ("script", "img", "source", "iframe", "video", "audio") and a.get("src"):
            self.loads.append(a["src"])
        if tag == "img" and a.get("srcset"):
            self.loads += [p.strip().split(" ")[0] for p in a["srcset"].split(",")]
        if tag == "link" and a.get("href"):
            rel = (a.get("rel") or "").lower()
            (self.loads if rel in ("stylesheet", "icon", "preload", "modulepreload", "manifest", "apple-touch-icon") else self.links).append(a["href"])
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_importmap = False
        if tag == "style":
            self._in_style = False

    def handle_data(self, data):
        if self._in_importmap:
            self.importmaps.append(data)
        if self._in_style:
            self.styles.append(data)


def is_external(u):
    return bool(re.match(r"^(https?:)?//", u.strip(), re.I))


def resolves(page: Path, ref: str) -> bool:
    if not ref or ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:")) or is_external(ref):
        return True
    if ref.startswith("/"):
        fail(f"{page.name}: absolute link {ref} breaks under /hox-insect-lab/")
        return True
    path = unquote(urlsplit(ref).path)
    if not path:
        return True
    target = (page.parent / path).resolve()
    if target.is_dir():
        target = target / "index.html"
    return target.exists() and DOCS.resolve() in target.parents or target == DOCS.resolve()


def check_css(css_file: Path, text: str):
    for u in re.findall(r"url\(\s*['\"]?([^'\")]+)", text):
        if is_external(u):
            fail(f"{css_file}: external url() {u}")
        elif not u.startswith("data:") and not (css_file.parent / unquote(u.split("#")[0].split("?")[0])).exists():
            fail(f"{css_file}: url() target missing {u}")
    for imp in re.findall(r"@import\s+(?:url\()?['\"]?([^'\");]+)", text):
        if is_external(imp):
            fail(f"{css_file}: external @import {imp}")


def check_pages():
    if not DOCS.is_dir():
        fail("docs/ missing: run python3 build.py first")
        return
    if not (DOCS / ".nojekyll").exists():
        fail("docs/.nojekyll missing")
    for name in PAGES:
        page = DOCS / f"{name}.html"
        if not page.exists():
            fail(f"{page.name} missing")
            continue
        html = page.read_text(encoding="utf-8")
        if not re.match(r"\s*<!doctype html>", html, re.I):
            fail(f"{page.name}: no <!doctype html> at the top")
        if not re.search(r"<html[^>]*\blang=\"en\"", html):
            fail(f'{page.name}: <html lang="en"> missing')
        p = Refs()
        p.feed(html)
        metas = p.tags.get("meta", [])
        if not any(m.get("charset", "").lower() == "utf-8" for m in metas):
            fail(f"{page.name}: meta charset utf-8 missing")
        if not any(m.get("name") == "viewport" and "width=device-width" in (m.get("content") or "") for m in metas):
            fail(f"{page.name}: meta viewport missing")
        if not any(m.get("name") == "description" and (m.get("content") or "").strip() for m in metas):
            fail(f"{page.name}: meta description missing")
        if not re.search(r"<title>[^<]+</title>", html):
            fail(f"{page.name}: <title> missing")
        for u in p.loads:
            if is_external(u):
                fail(f"{page.name}: loads external resource {u}")
            elif not resolves(page, u):
                fail(f"{page.name}: missing resource {u}")
        for u in p.links:
            if not resolves(page, u):
                fail(f"{page.name}: broken link {u}")
        for im in p.importmaps:
            for target in json.loads(im).get("imports", {}).values():
                if is_external(target):
                    fail(f"{page.name}: import map points outside the site: {target}")
                elif not target.endswith("/") and not resolves(page, target):
                    fail(f"{page.name}: import map target missing {target}")
        for css in p.styles:
            check_css(page, css)
        for img in p.tags.get("img", []):
            if "alt" not in img:
                fail(f"{page.name}: <img src={img.get('src')}> has no alt")
    lab = DOCS / "lab.html"
    if lab.exists() and "./vendor/three/three.module.js" not in lab.read_text(encoding="utf-8"):
        fail("lab.html: import map does not point at ./vendor/three/three.module.js")
    for css_file in DOCS.rglob("*.css"):
        check_css(css_file, css_file.read_text(encoding="utf-8"))


TAG_OK = re.compile(r"</?(i|b)>")


def only_i_b(where, text):
    if text and re.sub(TAG_OK, "", text).count("<"):
        fail(f"{where}: only <i> and <b> tags allowed: {text[:80]}")


def simulate(species, edits):
    out = subprocess.run(["node", str(ROOT / "scripts/simulate.mjs"), "--species", species, "--edits", json.dumps(edits), "--json"],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode:
        raise RuntimeError(out.stderr.strip().splitlines()[-1] if out.stderr.strip() else "simulate failed")
    return json.loads(out.stdout)


def check_lessons():
    f = ROOT / "data/lessons.json"
    if not f.exists():
        fail("data/lessons.json missing")
        return
    lessons = json.loads(f.read_text(encoding="utf-8")).get("lessons", [])
    if len(lessons) != 8:
        fail(f"lessons.json: expected 8 lessons, found {len(lessons)}")
    for i, L in enumerate(lessons, 1):
        w = f"lesson {L.get('id', i)}"
        for k in ("id", "title", "subtitle", "picture", "body", "quiz"):
            if not L.get(k):
                fail(f"{w}: '{k}' missing")
        if L.get("picture") not in PICTURES:
            fail(f"{w}: picture '{L.get('picture')}' not in {sorted(PICTURES)}")
        for para in L.get("body", []):
            only_i_b(w, para)
        only_i_b(w + " look_for", L.get("look_for") or "")
        q = L.get("quiz") or {}
        if len(q.get("options", [])) != 4 or not isinstance(q.get("answer"), int) or not 0 <= q.get("answer", -1) < 4:
            fail(f"{w}: quiz needs 4 options and answer 0-3")
        for t in [q.get("q", ""), q.get("explain", "")] + q.get("options", []):
            only_i_b(w + " quiz", t)
        t = L.get("try")
        if t:
            try:
                r = simulate(t["species"], t["edits"])
                if r["species"] != t["species"]:
                    fail(f"{w}: species resolved to {r['species']}")
                if not r["changes"]:
                    fail(f"{w}: Try it changes nothing")
                print(f"  {L['id']} {t.get('label')}: " + "; ".join(f"{c['seg']} {c['from']}>{c['to']} ({c['change']})" for c in r["changes"]))
            except Exception as e:  # noqa: BLE001
                fail(f"{w}: simulate error {e}")


def check_glossary():
    f = ROOT / "data/glossary.json"
    if not f.exists():
        fail("data/glossary.json missing")
        return
    terms = json.loads(f.read_text(encoding="utf-8")).get("terms", [])
    if not 18 <= len(terms) <= 24:
        fail(f"glossary.json: expected 18-24 terms, found {len(terms)}")
    names = [t.get("term", "") for t in terms]
    if names != sorted(names, key=str.lower):
        fail("glossary.json: terms not alphabetical")
    for t in terms:
        if not t.get("term") or not t.get("simple"):
            fail(f"glossary term {t.get('term')!r}: term and simple are required")


if __name__ == "__main__":
    check_pages()
    check_lessons()
    check_glossary()
    if fails:
        print(f"FAIL ({len(fails)})")
        for m in fails:
            print("  - " + m)
        sys.exit(1)
    print("OK: all site checks passed")
