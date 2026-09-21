#!/usr/bin/env node
// Verify guides: valid shape, every takeaway cite resolves, every evidence quote is verbatim in the raw source text.
//   node check-guides.mjs <doctor-id> <raw-text-file> [more raw files...]
import fs from 'fs';
import path from 'path';

const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const [, , doctor, ...raws] = process.argv;
if (!doctor || !raws.length) { console.error('usage: check-guides.mjs <doctor> <raw.txt>...'); process.exit(1); }

const norm = (s) => s.replace(/[\s·•\u3000]/g, '').replace(/醪|髅/g, '髎').replace(/\?\?|%/g, '').replace(/[“”"「」，,。、；;：:()（）《》\-—]/g, '');
const corpus = norm(raws.map((f) => fs.readFileSync(f, 'utf8')).join('\n'));

const dir = path.join(BANK, '_data', 'thought', doctor);
let bad = 0, quotes = 0, missing = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  let g;
  try { g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.log('INVALID JSON', f, e.message); bad++; continue; }
  const issues = [];
  for (const k of ['id', 'title', 'summary', 'takeaways', 'group']) if (!g[k]) issues.push('missing ' + k);
  if (g.id !== f.replace(/\.json$/, '')) issues.push('id != filename');
  const ids = new Set((g.evidence || []).map((e) => e.id));
  for (const t of g.takeaways || []) for (const c of t.cite || []) if (!ids.has(c)) issues.push('dangling cite ' + c);
  for (const t of g.takeaways || []) if (!t.zh || !t.en) issues.push('takeaway missing zh/en');
  for (const e of g.evidence || []) {
    quotes++;
    const q = norm(e.quote || '').replace(/[…\.]{2,}|\.\.\./g, '|').split('|').filter((x) => x.length >= 4);
    const ok = q.length && q.every((part) => corpus.includes(part));
    if (!ok) { missing++; issues.push('quote not found: ' + e.id + ' ' + (e.quote || '').slice(0, 40)); }
  }
  console.log((issues.length ? 'WARN ' : 'ok   ') + f + '  takeaways=' + (g.takeaways || []).length + ' tables=' + (g.tables || []).length + ' evidence=' + (g.evidence || []).length + (issues.length ? '\n     - ' + issues.join('\n     - ') : ''));
}
console.log(`quotes checked ${quotes}, not found ${missing}, bad files ${bad}`);
