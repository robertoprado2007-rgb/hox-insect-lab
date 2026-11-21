# Hox Insect Lab

A free, kid-friendly website about **Hox genes**: the "address genes" that tell each segment of an insect's body what to grow. Kids switch genes on and off and watch a 3D insect change: a fly with four wings, legs where its antennae should be, and more.

- **Learn**: eight short lessons with pictures, quizzes and stars.
- **Lab**: the 3D model. A *Scientist mode* switch shows the evidence behind every change.
- **For Teachers**: learning goals, a 45-minute lesson plan and a worksheet with answers.

Gene records come from **NCBI Datasets** (327 insect species). The rules come from published experiments. Every change in the Lab is labelled as either seen in a real experiment or the model's guess.

No accounts, no ads, no tracking. The site loads nothing from other servers; lesson stars and settings stay in your own browser.

## Build

Needs Python 3 (standard library only). Node is only needed for the checks.

```bash
python3 build.py              # writes the site into docs/
python3 tests/check_site.py   # checks pages, links, lessons and the simulator
```

To preview locally:

```bash
cd docs && python3 -m http.server 8000 --bind 127.0.0.1
# then open http://127.0.0.1:8000
```

## Publish on GitHub Pages

1. Install **GitHub Desktop** and sign in.
2. *File → Add Local Repository…*, choose this folder, and accept *create a repository* if asked. Commit the files.
3. Click **Publish repository** and untick *Keep this code private* (Pages on a free account needs a public repository).
4. On github.com open the repository → **Settings → Pages** → *Deploy from a branch* → branch `main`, folder `/docs` → **Save**.
5. After a minute the site is live at `https://<your-username>.github.io/hox-insect-lab/`.

After any change: run `python3 build.py`, then commit and push in GitHub Desktop.

## Layout

```
build.py                 builds docs/ from src/ and data/
scripts/build_lab.py     builds the Lab page (src/lab.html + data)
scripts/simulate.mjs     runs the Lab's model in Node (used by the checks)
src/                     page templates, content, styles, scripts, pictures
data/                    species, experiments, lessons, glossary, tour
vendor/                  Three.js 0.160.0 and fonts, stored locally
docs/                    the built site that GitHub Pages serves
```

## Licences

Code: MIT (see `LICENSE`). Three.js: MIT (`vendor/three/LICENSE`). Fonts Fredoka, Nunito and IBM Plex Mono: SIL Open Font License 1.1 (`vendor/fonts/OFL.txt`). Gene data: NCBI (public).

The 3D insects are predictions from simple rules, not photos of real animals.
