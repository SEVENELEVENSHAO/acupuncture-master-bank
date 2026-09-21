#!/usr/bin/env node
// Replace English-glossed 处方/调护/预后 in the chapter 6-11 vault notes with the book's verbatim Chinese,
// keeping the old English as a foldable [!gloss] callout.
//   node restore-zh.mjs            dry run (prints mapping + 3 samples)
//   node restore-zh.mjs --write    rewrite the notes
import fs from 'fs';
import path from 'path';
import { parseRaw, paragraphs } from './raw-entries.mjs';

const WRITE = process.argv.includes('--write');
const BANK = 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank\\_data\\prescriptions\\chengdanan.json';
const NOTES = 'E:\\Documents\\Obsidian\\TCM Vault\\承淡安针灸';

const cjk = (s) => (s.match(/[\u3400-\u9fff]/g) || []).length;
const lat = (s) => (s.match(/[A-Za-z]/g) || []).length;
const rx = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const affected = rx.filter((r) => r.system.no >= 6 && lat(r.rx_zh) > cjk(r.rx_zh));
const raw = parseRaw();
const norm = (s) => s.replace(/[（(].*?[）)]/g, '').replace(/[)）]/g, '').replace(/^附[：:]/, '').replace(/\s+/g, '');
const MANUAL = { 膣炎: '腔炎', '疫痢) 赤痢(附疫痢)': '赤痢' };

const used = new Set();
const pairs = [];
for (const r of affected) {
  const want = norm(MANUAL[r.name.zh] || r.name.zh);
  let idx = raw.findIndex((e, i) => !used.has(i) && norm(e.name) === want);
  if (idx < 0) idx = raw.findIndex((e, i) => !used.has(i) && (norm(e.name).includes(want) || want.includes(norm(e.name))));
  if (idx < 0) { console.log('NO MATCH', r.name.zh); continue; }
  used.add(idx); pairs.push([r, raw[idx]]);
}
console.log('affected', affected.length, 'matched', pairs.length, 'raw', raw.length, 'unused raw:', raw.filter((_, i) => !used.has(i)).map((e) => e.heading));

const TAGORDER = ['处方', '调护', '预后', '外治', '消毒', '注意', '手术'];
function zhBody(e) {
  const tags = [...TAGORDER.filter((t) => e.parts[t]), ...Object.keys(e.parts).filter((t) => !TAGORDER.includes(t))];
  return tags.map((t) => '**【' + t + '】** ' + paragraphs(e.parts[t]).join('\n\n')).join('\n\n');
}

function rewrite(file, e) {
  const old = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const m = old.match(/^([\s\S]*?)(?=\*\*【)/);
  const head = m ? m[1].trimEnd() : old.split('\n').slice(0, 6).join('\n');
  const seeIdx = old.search(/^##\s+相关 See also/m);
  const see = seeIdx >= 0 ? old.slice(seeIdx).trimEnd() : '';
  const body = old.slice(m ? m[1].length : 0, seeIdx >= 0 ? seeIdx : old.length).trim();
  // keep existing editor notes (blockquotes that are not the gloss) after the Chinese, and fold the English
  const lines = body.split('\n');
  const notes = lines.filter((l) => /^>/.test(l)).join('\n');
  const english = lines.filter((l) => !/^>/.test(l)).join('\n').trim();
  const gloss = english.split('\n').map((l) => '> ' + l).join('\n');
  return head + '\n\n' + zhBody(e) + '\n\n> [!gloss]- English gloss (earlier translation pass; the Chinese above is the verbatim source)\n' + gloss
    + (notes ? '\n\n' + notes : '') + (see ? '\n\n' + see : '') + '\n';
}

if (!WRITE) {
  for (const name of ['月经困难症', '伤寒', '子宫癌肿']) {
    const p = pairs.find(([r]) => r.name.zh === name);
    if (p) console.log('\n===== ' + name + ' =====\n' + zhBody(p[1]).slice(0, 1400));
  }
} else {
  let n = 0;
  for (const [r, e] of pairs) {
    const file = path.join(NOTES, r.notes_path.replace(/\//g, path.sep));
    fs.writeFileSync(file, rewrite(file, e));
    n++;
  }
  console.log('rewrote', n, 'notes');
}
