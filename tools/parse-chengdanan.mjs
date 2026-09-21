#!/usr/bin/env node
// Parse the 承淡安针灸处方集 Obsidian notes -> _data/prescriptions/chengdanan.json (+ QA report)
//   node parse-chengdanan.mjs
import fs from 'fs';
import path from 'path';
import { scan } from './points.mjs';

const NOTE_ROOT = process.env.CDA_NOTES || 'E:\\Documents\\Obsidian\\TCM Vault\\承淡安针灸\\02 针灸处方集 Acupuncture Prescriptions';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const RAW_G9 = 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\chengdanan\\chunks\\G9_book2_gyn_peds_endocrine_metabolic_p276-284.txt';
const OUT = path.join(BANK, '_data', 'prescriptions', 'chengdanan.json');
const REPORT = path.join(BANK, '_data', 'prescriptions', 'chengdanan.report.txt');

const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

// ---------- collect chapters / notes ----------
const chapters = fs.readdirSync(NOTE_ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d+ /.test(e.name))
  .map((e) => e.name).sort();

const recs = [];
const problems = [];

function sectionsFromIndex(dir) {
  const idx = path.join(dir, '00 索引 Index.md');
  const order = [];               // basenames in index order
  const secOf = new Map();        // basename -> {zh,en,no}
  if (!fs.existsSync(idx)) return { order, secOf };
  let cur = null;
  for (const line of fs.readFileSync(idx, 'utf8').replace(/\r/g, '').split('\n')) {
    const h = line.match(/^#{2,3}\s+第([一二三四五六七八九十]+)节\s+(\S+?)(?:\s+([A-Za-z].*))?$/);
    if (h) { cur = { no: NUM[h[1]] || 0, zh: h[2], en: (h[3] || '').trim() }; continue; }
    if (/^#{1,3}\s/.test(line) && !h) { if (!/第.节/.test(line)) { /* non-section heading: keep current */ } }
    if (line.startsWith('|')) {
      const m = line.match(/\[\[([^\]|\\#]+)/);
      if (m) {
        const base = m[1].trim().split('/').pop();
        if (!order.includes(base)) order.push(base);
        if (cur) secOf.set(base, cur);
      }
    }
  }
  return { order, secOf };
}

// Gyn chapter has 节 in the book's own ToC but not in its index: derive from raw source order
function gynSections() {
  const map = new Map();
  if (!fs.existsSync(RAW_G9)) return map;
  const lines = fs.readFileSync(RAW_G9, 'utf8').replace(/\r/g, '').split('\n').map((s) => s.trim());
  let sec = null, inGyn = false;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^第六章\s*妇人科病/.test(L.replace(/\s+/g, ''))) inGyn = true;
    if (/^第七章/.test(L.replace(/\s+/g, ''))) inGyn = false;
    const s = L.replace(/\s+/g, '').match(/^第([一二三])节(.+)$/);
    if (inGyn && s) { sec = { no: NUM[s[1]], zh: s[2], en: '' }; continue; }
    if (inGyn && sec) {
      // disease heading = a short line whose next non-empty line starts with 【处方】
      let j = i + 1; while (j < lines.length && !lines[j]) j++;
      if (lines[j] && lines[j].startsWith('【处方】') && L && !L.startsWith('【') && L.length < 30) {
        map.set(L.replace(/[（(].*?[）)]/g, '').replace(/\s+/g, ''), sec);
      }
    }
  }
  return map;
}
const GYN = gynSections();
const GYN_EN = { 1: 'External & internal genital diseases', 2: 'Uterus & ovary diseases', 3: 'Other gynecological diseases' };

function parseTitle(h1) {
  // "Acute Enteritis (食泻、热泻) 急性肠炎" | "Hemorrhoids 痔疾" | "Valvular Heart Disease (旧称怔忡、心动悸) 心脏瓣膜症"
  const m = h1.match(/^(.*?[)A-Za-z0-9.'’,\-–—/&])\s+([\u3400-\u9fff].*)$/);
  let lead = m ? m[1].trim() : '', zh = m ? m[2].trim() : h1.trim();
  if (!m && /^[\u3400-\u9fff]/.test(h1)) { lead = ''; zh = h1.trim(); }
  let alias = '';
  const pm = lead.match(/\(([^)]*)\)\s*$/);
  if (pm) { alias = pm[1].replace(/^旧称/, '').trim(); lead = lead.slice(0, pm.index).trim(); }
  return { en: lead, zh, alias };
}

const METHODS = [
  ['强刺激', /强刺激|强针|强度刺激/], ['中刺激', /中等?度?刺激|中度刺激|中刺激/], ['轻刺激', /轻刺激|轻针|轻度刺激|弱刺激/],
  ['皮肤针', /皮肤针|梅花针|捶击|叩打/], ['艾灸', /灸|艾/], ['放血', /放血|刺出血|点刺出血|出血法/],
  ['留针', /留针/], ['浅刺', /浅刺/], ['深刺', /深刺/], ['按摩', /按摩|推拿/], ['拔罐', /拔罐|火罐/], ['电针', /电针/],
];
const NOT_INDICATED = /非针灸|不适用针灸|不适应针灸|非针术|不宜针灸|不适宜针灸|不适宜针术|针灸.{0,6}不适应|针术.{0,8}不适应|列入不适应证|不属针灸|非针灸治疗之适应证|本病非针灸/;
const PLACEHOLDER = /^\*?\(.*(not given|not separately|no separate).*\)\*?$/i;   // agent-written stand-ins for a missing field

let seq = 0;
for (const chDir of chapters) {
  const m = chDir.match(/^(\d+)\s+(\S+)\s+(.*)$/);
  const system = { no: +m[1], zh: m[2], en: m[3] };
  const dir = path.join(NOTE_ROOT, chDir);
  const { order, secOf } = sectionsFromIndex(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('00 ') && !f.startsWith('附录'));
  const base = (f) => f.replace(/\.md$/, '');
  files.sort((a, b) => {
    const ia = order.indexOf(base(a)), ib = order.indexOf(base(b));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
  });

  for (const f of files) {
    const full = path.join(dir, f);
    let t = fs.readFileSync(full, 'utf8').replace(/\r/g, '');
    t = t.replace(/^---[\s\S]*?---\n/, '');
    const h1 = (t.match(/^#\s+(.+)$/m) || [, base(f)])[1].trim();
    const see = t.search(/^##\s+相关 See also/m);
    if (see >= 0) t = t.slice(0, see);
    // drop foldable "[!gloss]-" callouts (earlier English translation, not the source)
    t = t.replace(/^> \[!gloss\][^\n]*\n(?:>[^\n]*\n?)*/gm, '');
    const bodyLines = t.split('\n').filter((l) => !/^#\s/.test(l));
    const noteLines = bodyLines.filter((l) => /^>/.test(l)).map((l) => l.replace(/^>\s*/, '').trim());
    let body = bodyLines.filter((l) => !/^>/.test(l)).join('\n');

    // split on **【tag】**
    const parts = {};
    const re = /\*\*【([^】]+)】\*\*/g;
    const marks = [...body.matchAll(re)];
    if (!marks.length) { problems.push('no 【处方】 marker (skipped): ' + f); continue; }
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].index + marks[i][0].length;
      const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
      let seg = body.slice(start, end).trim();
      seg = seg.replace(/^[A-Za-z][A-Za-z ,'’/&()\-]*[—–]\s*/, '');   // "Prescription — "
      parts[marks[i][1]] = (parts[marks[i][1]] ? parts[marks[i][1]] + '\n\n' : '') + seg;
    }
    if (!parts['处方']) { problems.push('no 处方 section: ' + f); continue; }

    // pull bracketed OCR notes out of the prescription text
    const extraNotes = [];
    let rx = parts['处方'].replace(/\[(?:OCR|Note|Source)[^\]]*\]/gi, (s) => { extraNotes.push(s.slice(1, -1)); return ''; }).trim();

    const { en, zh, alias } = parseTitle(h1);

    // groups: paragraph -> sentence segments with >= 2 points
    const groups = [];
    for (const para of rx.split(/\n\s*\n/)) {
      const rowLines = /^\|/.test(para.trim()) ? para.split('\n') : [para];
      for (const chunk of rowLines) {
        for (const seg of chunk.split(/[。；;]/)) {
          const pts = [...new Set(scan(seg).map((x) => x.name))];
          if (pts.length >= 2) {
            const lab = seg.match(/^\s*[（(]?[一二三四五六七八九十0-9]+[）).、]\s*([^：:，,]{1,14})[：:]/);
            groups.push({ label: lab ? lab[1].trim() : '', points: pts, text: seg.trim().replace(/^\|?\s*/, '') });
          }
        }
      }
    }
    const all = scan(rx);
    const points = [...new Set(all.map((x) => x.name))];
    const codes = [...new Set(all.flatMap((x) => x.codes || []))];

    const method = METHODS.filter(([, r]) => r.test(rx)).map(([n]) => n);
    const gauge = [...new Set([...rx.matchAll(/(\d{2})号针/g)].map((x) => x[1] + '号'))];
    let indication = 'yes';
    if (NOT_INDICATED.test(rx.replace(/\*\*/g, ''))) indication = points.length ? 'conditional' : 'no';

    const secKey = base(f);
    let sec = secOf.get(secKey) || null;
    if (!sec && system.no === 6) {
      const key = zh.replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '');
      for (const [k, v] of GYN) if (k === key || k.includes(key) || key.includes(k)) { sec = v; break; }
    }

    if (!sec && zh === '膣炎') sec = { no: 1, zh: '内外阴部疾患', en: '' };   // source heading is OCR-garbled (腔炎)
    if (sec && system.no === 6 && !sec.en) sec = { ...sec, en: GYN_EN[sec.no] || '' };

    recs.push({
      id: 'cda-rx-' + String(++seq).padStart(3, '0'),
      doctor: 'chengdanan',
      book: '承淡安针灸处方集',
      system: { no: system.no, zh: system.zh, en: system.en },
      section: sec ? { no: sec.no, zh: sec.zh, en: sec.en } : null,
      name: { zh, en },
      alias,
      rx_zh: rx,
      groups,
      points,
      codes,
      care_zh: PLACEHOLDER.test((parts['调护'] || '').trim()) ? '' : (parts['调护'] || '').trim(),
      prognosis_zh: PLACEHOLDER.test((parts['预后'] || '').trim()) ? '' : (parts['预后'] || '').trim(),
      extra: Object.fromEntries(Object.entries(parts).filter(([k]) => !['处方', '调护', '预后'].includes(k))),
      indication,
      method,
      gauge,
      note: [...noteLines, ...extraNotes].join(' ').trim(),
      notes_path: path.relative(path.join(NOTE_ROOT, '..'), full).replace(/\\/g, '/'),
    });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(recs, null, 1));

// ---------- QA report ----------
const rep = [];
rep.push(`records ${recs.length}`);
const by = (fn) => recs.reduce((a, r) => { const k = fn(r); a[k] = (a[k] || 0) + 1; return a; }, {});
rep.push('by system: ' + JSON.stringify(by((r) => r.system.no + r.system.zh)));
rep.push('by indication: ' + JSON.stringify(by((r) => r.indication)));
rep.push('by method: ' + JSON.stringify(recs.flatMap((r) => r.method).reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {})));
rep.push('records without section: ' + recs.filter((r) => !r.section).map((r) => r.name.zh).join('、'));
rep.push('records with 0 points: ' + recs.filter((r) => !r.points.length).map((r) => r.name.zh + '[' + r.indication + ']').join('、'));
rep.push('problems: ' + problems.join(' | '));

// candidate missing point names: tokens in point-bearing segments that resolve to no point
const tok = {};
for (const r of recs) {
  for (const seg of r.rx_zh.split(/[。；;\n]/)) {
    if (scan(seg).length < 2 && !/取穴/.test(seg)) continue;
    for (const tk of seg.split(/[、，,：:（）()\s\|\*·\-—]+/)) {
      if (/^[\u3400-\u9fff]{2,5}$/.test(tk) && !scan(tk).length) tok[tk] = (tok[tk] || 0) + 1;
    }
  }
}
const top = Object.entries(tok).sort((a, b) => b[1] - a[1]).slice(0, 150);
rep.push('\nunresolved tokens in point-bearing segments (top 150):\n' + top.map(([k, v]) => k + ' ' + v).join('\n'));

const freq = {};
for (const r of recs) for (const p of r.points) freq[p] = (freq[p] || 0) + 1;
rep.push('\ntop points:\n' + Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ' ' + v).join('  '));
fs.writeFileSync(REPORT, rep.join('\n'));
console.log('wrote', recs.length, 'records ->', OUT);
console.log('report ->', REPORT);
