// Check that every point / prescription id / case id a guide links to exists, for every doctor.
import fs from 'fs';
import path from 'path';
import { POINTS, lookup } from './points.mjs';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const D = path.join(BANK, '_data');
const readJson = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d);
const readJsonl = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
let total = 0, bad = 0;
for (const doc of readJson(path.join(D, 'doctors.json'), [])) {
  const rx = new Set(readJson(path.join(D, 'prescriptions', doc.id + '.json'), []).map((r) => r.id));
  const cs = new Set();
  const cdir = path.join(D, 'cases');
  if (fs.existsSync(cdir)) for (const f of fs.readdirSync(cdir)) if (f === doc.id + '.jsonl' || (f.startsWith(doc.id + '.') && f.endsWith('.jsonl'))) readJsonl(path.join(cdir, f)).forEach((c) => cs.add(c.id));
  const dir = path.join(D, 'thought', doc.id);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const see = g.see || {};
    for (const p of see.points || []) { total++; if (!POINTS.has(p) && !lookup(p)) { bad++; console.log(doc.id, f, 'unknown point:', p); } }
    for (const id of see.rx || []) { total++; if (!rx.has(id)) { bad++; console.log(doc.id, f, 'unknown rx id:', id); } }
    for (const id of see.cases || []) { total++; if (!cs.has(id)) { bad++; console.log(doc.id, f, 'unknown case id:', id); } }
  }
}
console.log(`links checked ${total}; problems ${bad}`);
