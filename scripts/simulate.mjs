#!/usr/bin/env node
// Hox Insect Lab simulation harness.
// Runs the app's own model code (the ENGINE block of src/lab.html) without a browser,
// so batch experiments use exactly the rules the 3D app uses.
//
// Usage:
//   node scripts/simulate.mjs --species "Drosophila melanogaster" --on Ubx:T2
//   node scripts/simulate.mjs --species Tribolium --ko abdA --on Antp:A3,A4
//   node scripts/simulate.mjs --species Bombyx --edits '[{"gene":"pb","op":"on","segs":["T2"]}]' --json
//   node scripts/simulate.mjs --species Apis --sweep          # every single-gene knockout and single-segment gain
//   node scripts/simulate.mjs --guide                         # Markdown change guide (fly + beetle)
//   node scripts/simulate.mjs --list                          # orders with one example species each
// Segments: An Ic Mn Mx Lb T1 T2 T3 A1..A10.  Genes: lab pb Dfd Scr Antp Ubx abdA AbdB (abd-A / Abd-B also accepted).
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/lab.html'), 'utf8');
const block = src.split('/* ENGINE:BEGIN')[1].split('/* ENGINE:END */')[0].replace(/^[^\n]*\n/, '');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block + '\nglobalThis.E = {SEG,GENES,GLABEL,DEF,DOMAIN,defaultExpr,identityOf,dominantOf,ID_NAME,ID_EXPLAIN,templateFor,diffAll,applyEdits,normGene,describeChange};', ctx);
const E = ctx.E;
export const engine = E;
const species = JSON.parse(fs.readFileSync(path.join(root, 'data/species.json'), 'utf8')).species;
const records = JSON.parse(fs.readFileSync(path.join(root, 'data/phenotypes.json'), 'utf8')).records;

export function findSpecies(q) {
  const s = String(q || 'Drosophila melanogaster').toLowerCase();
  return species.find(x => x.name.toLowerCase() === s) || species.find(x => x.name.toLowerCase().includes(s))
    || species.find(x => (x.common || '').toLowerCase().includes(s)) || species.find(x => x.order.toLowerCase() === s || x.family.toLowerCase() === s);
}

export function simulate(spQuery, edits) {
  const sp = findSpecies(spQuery);
  if (!sp) throw new Error('Species not found: ' + spQuery);
  const tpl = E.templateFor(sp);
  const expr = E.applyEdits(E.defaultExpr(), edits);
  const changes = E.diffAll(expr, tpl, sp.order, records).map(c => ({
    seg: c.seg, from: c.from, to: c.to, change: c.desc, meaning: E.ID_EXPLAIN[c.to],
    documented: c.rec ? `${c.rec.id} (${c.rec.species})` : null,
    contradicted: c.conflict ? `${c.conflict.id}: published ${c.conflict.from} -> ${c.conflict.to} (${c.conflict.species})` : null,
  }));
  return { species: sp.name, order: sp.order, family: sp.family, wingless: !!tpl.wingless, edits, changes,
    novel: changes.some(c => !c.documented && !c.contradicted) };
}

function fmt(r) {
  const head = `${r.species} [${r.order}/${r.family}]${r.wingless ? ' (wingless body plan)' : ''}  edits=${JSON.stringify(r.edits)}`;
  if (!r.changes.length) return head + '\n  no identity change';
  return head + '\n' + r.changes.map(c => `  ${c.seg}: ${c.from} -> ${c.to} | ${c.change} | ${c.documented ? 'DOCUMENTED ' + c.documented : c.contradicted ? 'CONTRADICTED ' + c.contradicted : 'NEW (model extrapolation)'}`).join('\n');
}

function parseArgs(argv) {
  const a = { edits: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--species') { a.species = v; i++; }
    else if (k === '--on' || k === '--off') { const [g, segs] = String(v).split(':'); if (!segs) throw new Error(`${k} needs Gene:Seg[,Seg], e.g. ${k} Ubx:T2`); a.edits.push({ gene: g, op: k.slice(2), segs: segs.split(',') }); i++; }
    else if (k === '--ko') { a.edits.push({ gene: v, op: 'ko' }); i++; }
    else if (k === '--edits') { a.edits.push(...JSON.parse(v)); i++; }
    else if (k === '--json') a.json = true;
    else if (k === '--sweep') a.sweep = true;
    else if (k === '--guide') a.guide = true;
    else if (k === '--list') a.list = true;
    else throw new Error('Unknown argument: ' + k);
  }
  return a;
}

function sweep(spq) {
  const out = [];
  for (const g of E.GENES) {
    out.push(simulate(spq, [{ gene: g, op: 'ko' }]));
    for (let i = 0; i < 18; i++) if (!E.DEF[g][i]) out.push(simulate(spq, [{ gene: g, op: 'on', segs: [E.SEG[i]] }]));
  }
  return out;
}

function guide() {
  const fly = 'Drosophila melanogaster', beetle = 'Tribolium castaneum';
  const lines = ['| Change | Segment | Identity | Fly (*Drosophila*) | Beetle (*Tribolium*) | Evidence |', '|---|---|---|---|---|---|'];
  for (const g of E.GENES) {
    const runs = [[`${E.GLABEL[g]} off everywhere`, [{ gene: g, op: 'ko' }]]];
    for (let i = 0; i < 18; i++) if (!E.DEF[g][i]) runs.push([`${E.GLABEL[g]} on in ${E.SEG[i]}`, [{ gene: g, op: 'on', segs: [E.SEG[i]] }]]);
    for (const [label, edits] of runs) {
      const f = simulate(fly, edits), b = simulate(beetle, edits);
      if (!f.changes.length) continue;
      f.changes.forEach((c, k) => {
        const bc = b.changes.find(x => x.seg === c.seg);
        lines.push(`| ${k ? '' : label} | ${c.seg} | ${c.from} → ${c.to} | ${c.change} | ${bc ? bc.change : 'no change'} | ${c.documented ? 'Documented: ' + c.documented : 'Extrapolation'} |`);
      });
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2));
  if (a.list) {
    const seen = new Map(); species.forEach(s => { if (!seen.has(s.order)) seen.set(s.order, []); seen.get(s.order).push(s); });
    for (const [o, l] of seen) console.log(`${o} (${l.length}): e.g. ${l.slice(0, 4).map(s => s.name + ' [' + s.family + ']').join('; ')}`);
  } else if (a.guide) console.log(guide());
  else if (a.sweep) { const r = sweep(a.species); console.log(a.json ? JSON.stringify(r) : r.filter(x => x.changes.length).map(fmt).join('\n')); }
  else { const r = simulate(a.species, a.edits); console.log(a.json ? JSON.stringify(r, null, 1) : fmt(r)); }
}
