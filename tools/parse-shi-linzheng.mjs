#!/usr/bin/env node
// 石学敏临证实验录 -> cases/shixuemin.linzheng.jsonl (403 cases, Parts 1-5)
//                  -> thought/shixuemin/_linzheng-research.chunk.txt (Part 6, for guide writing)
//   node parse-shi-linzheng.mjs
import fs from 'fs';
import path from 'path';
import { scan } from './points.mjs';

const SP = process.env.ACU_SCRATCH || 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\new-books\\';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const OUT = path.join(BANK, '_data', 'cases', 'shixuemin.linzheng.jsonl');
const TITLE = '石学敏临证实验录';

const raw = fs.readFileSync(SP + 'shi-linzheng.txt', 'utf8').replace(/\r/g, '');
const parts = raw.split(/\n===== PAGE (\d+) =====\n/);
const pageText = new Map();
for (let i = 1; i < parts.length; i += 2) pageText.set(+parts[i], parts[i + 1]);

const DROP = [/^\d{1,4}$/, /^[·.:：\s]{1,4}$/, /^石学敏.{0,6}(临证实验录|针灸)/];
// a handful of 髎-suffixed point names lost their last character to OCR and print as a bare "?"
const FIX = [[/次\?/g, '次髎'], [/肩\s*\?/g, '肩髎'], [/臂\?/g, '臂臑']];
const fixLine = (s) => FIX.reduce((a, [r, t]) => a.replace(r, t), s);
const lines = []; // {p, s}
for (const p of [...pageText.keys()].sort((a, b) => a - b)) {
  for (const l0 of pageText.get(p).split('\n')) {
    const s = fixLine(l0.trim());
    if (!s || DROP.some((r) => r.test(s))) continue;
    lines.push({ p, s });
  }
}

// locate the body: from the SECOND "第一篇" (first is the table of contents) to the LAST "第六篇" (ditto)
const chapter1 = []; lines.forEach((x, i) => { if (x.s.replace(/\s+/g, '') === '第一篇疼痛类疾病') chapter1.push(i); });
const chapter6 = []; lines.forEach((x, i) => { if (x.s.replace(/\s+/g, '') === '第六篇实验究摘要' || x.s.replace(/\s+/g, '') === '第六篇实验研究摘要') chapter6.push(i); });
const bodyStart = chapter1[1];   // [0]=front-matter TOC, [1]=actual heading, [2]=a second TOC reprinted at the very end
const bodyEnd = chapter6[1];
const body = lines.slice(bodyStart, bodyEnd);
const researchLines = lines.slice(bodyEnd);

// ---- walk 篇/章/节 hierarchy + case blocks ----
const LABELS = ['主诉', '病史', '查体及实验室检查', '西医诊断', '中医诊断', '治疗原则', '针灸取穴', '治疗过程', '中药', '治疗结果'];
const LAB_RE = new RegExp('^(' + LABELS.join('|') + ')[：:]$');

let dept = '', category = '', disease = '';
const blocks = [];
let cur = null, pendingMarker = '';
for (const { p, s } of body) {
  const compact = s.replace(/\s+/g, '');
  const pm = compact.match(/^第[一二三四五六七八九十]+篇(.+)$/);
  if (pm && compact.length < 16) { dept = pm[1].replace(/疾$/, '疾病'); category = ''; disease = ''; cur = null; continue; }
  const cm = compact.match(/^第[一二三四五六七八九十]+章(.+)$/);
  if (cm && compact.length < 16) { category = cm[1]; disease = ''; cur = null; continue; }
  const sm = compact.match(/^第[一二三四五六七八九十]+节(.+)$/);
  if (sm && compact.length < 16) { disease = sm[1]; cur = null; continue; }
  const mk = s.match(/^【病例\s*(\d*)\s*】$/);
  if (mk) { pendingMarker = mk[1] || ''; cur = { dept, category, disease: disease || category, marker: pendingMarker, p, lines: [] }; blocks.push(cur); continue; }
  if (cur) cur.lines.push(s);
}

// ---- parse each case block ----
function parseBlock(b) {
  const f = {}; // label -> [lines]
  const order = [];
  let cur = null;
  let sawResult = false;
  let demo = '';
  const commentary = [];
  for (const s of b.lines) {
    const m = s.match(LAB_RE);
    if (m) { cur = m[1]; f[cur] = f[cur] || []; order.push(cur); if (cur === '治疗结果') sawResult = true; continue; }
    if (!cur && !demo && /(男|女)/.test(s)) { demo = s; continue; }   // the "<name>，男/女，<age>岁，初诊日期：…" line right after 【病例N】
    if (/^按\s*语$/.test(s)) {
      if (sawResult) { cur = '__commentary'; continue; }
      continue; // misplaced heading (page-layout artifact before 治疗结果): drop the marker, keep surrounding text flowing
    }
    if (cur === '__commentary') commentary.push(s);
    else if (cur) f[cur].push(s);
  }
  // page-column layout quirk: occasionally a label's own content is printed AFTER the next label
  // (e.g. "治疗原则：" <page break> "<principle>。<points list>。" "针灸取穴：" "<process>"), so the points
  // list ends up appended to 治疗原则 while 针灸取穴 has nothing. Detect + repair: if 针灸取穴 is empty but
  // 治疗原则's text contains a trailing point-bearing sentence, split it off.
  if (!(f['针灸取穴'] || []).some(Boolean) && (f['治疗原则'] || []).length) {
    const text = f['治疗原则'].join('');
    const sentences = text.split(/(?<=。)/).filter(Boolean);
    if (sentences.length > 1) {
      const tail = sentences.slice(1).join('');
      if (scan(tail).length >= 2) { f['治疗原则'] = [sentences[0]]; f['针灸取穴'] = [tail]; }
    }
  }
  const get = (k) => (f[k] || []).join('');
  const dm = demo.match(/(男|女)\s*[，,]?\s*(\d+)\s*岁/);
  const dateM = demo.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return { get, commentary: commentary.join(''), header: b, demo, sex: dm ? (dm[1] === '男' ? 'M' : 'F') : '', age: dm ? dm[2] : '', date: dateM ? `${dateM[1]}-${dateM[2].padStart(2, '0')}-${dateM[3].padStart(2, '0')}` : '' };
}

const METHODS = [['捻转补法', /捻转补法/], ['捻转泻法', /捻转泻法/], ['提插补法', /提插补法/], ['提插泻法', /提插泻法/], ['平补平泻', /平补平泻/], ['呼吸补法', /呼吸补法/], ['呼吸泻法', /呼吸泻法/],
  ['雀啄', /雀啄/], ['醒脑开窍', /醒脑开窍/], ['刺络放血', /放血|刺络|点刺出血/], ['拔罐', /拔罐|拨罐/], ['温针灸', /温针/], ['艾灸', /艾灸|艾条|艾炷|隔[姜盐附]|雷火针/], ['电针', /电针/],
  ['TDP', /TDP/], ['耳针', /耳针|耳穴/], ['头针', /头针|头皮针/], ['皮肤针', /皮肤针|梅花针/], ['火针', /火针/], ['芒针', /芒针/], ['水针', /水针|穴位注射/], ['透刺', /透向|透刺/]];

const out = [];
const problems = [];
const perGroup = new Map();
for (const b of blocks) {
  const key = b.dept + '|' + b.category + '|' + b.disease;
  perGroup.set(key, (perGroup.get(key) || 0) + 1);
  const no = b.marker || String(perGroup.get(key));
  const P = parseBlock(b);
  const complaint = P.get('主诉');
  const history = P.get('病史');
  const exam = P.get('查体及实验室检查');
  const wm = P.get('西医诊断').replace(/[。.]$/, '');
  let tcm = P.get('中医诊断').replace(/[。.]$/, '');
  const patM = tcm.match(/^(.*?)[，,]?\s*证型[：:]\s*(.+)$/);
  const dxName = patM ? patM[1].trim() : tcm, pattern = patM ? patM[2].trim() : '';
  const principle = P.get('治疗原则').replace(/[。.]$/, '');
  const sel = P.get('针灸取穴');
  const proc = P.get('治疗过程');
  const herbs = P.get('中药');
  const outcome = P.get('治疗结果');
  if (!complaint) problems.push(b.dept + '/' + b.disease + ' no 主诉');
  if (!sel) problems.push(b.dept + '/' + b.disease + ' no 针灸取穴');
  const points = [...new Set(scan(sel).map((h) => h.name))];
  const tech = METHODS.filter(([, r]) => r.test(proc + sel + principle)).map(([n]) => n);
  const passage = ['【病例' + (b.marker || '') + '】', P.demo, complaint && '主诉：' + complaint, history && '病史：' + history, exam && '查体及实验室检查：' + exam,
    wm && '西医诊断：' + wm, tcm && '中医诊断：' + tcm, principle && '治疗原则：' + principle, sel && '针灸取穴：' + sel, proc && '治疗过程：' + proc,
    herbs && '中药：' + herbs, outcome && '治疗结果：' + outcome, P.commentary && '按语：' + P.commentary].filter(Boolean).join('\n');
  out.push({
    id: 'sxl-' + String(out.length + 1).padStart(3, '0'), doctor_id: 'shixuemin', source_slug: 'shixuemin-linzheng', source_title: TITLE,
    ref: `《${TITLE}》病例${no} · ${b.dept}·${b.category}·${b.disease} (石学敏)`,
    modality: herbs ? 'mixed' : 'acupuncture', patient: { sex: P.sex, age: P.age }, date: P.date,
    title_zh: dxName || b.disease, complaint_zh: complaint, pattern_zh: pattern, formula_zh: '', principle_zh: principle,
    dx_zh: [wm && '西医：' + wm, tcm && '中医：' + tcm].filter(Boolean).join('；'),
    points, outcome_zh: outcome,
    kv_zh: [['主诉', complaint], ['病史', history], ['查体及实验室检查', exam], ['西医诊断', wm], ['中医诊断', tcm], ['治疗原则', principle], ['针灸取穴', sel], ['治疗过程', proc], ['中药', herbs], ['治疗结果', outcome]].filter(([, v]) => v),
    commentary_zh: P.commentary, original_passage: passage, tags: tech,
  });
}

// flag (not drop) cases that are the same patient as one already in the other two 石学敏 case files —
// this book draws from the same hospital case pool and legitimately reprints some of the same patients
// with fuller commentary; keep both, just cross-reference.
{
  const readJsonl = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const other = [...readJsonl(path.join(BANK, '_data', 'cases', 'shixuemin.jsonl')), ...readJsonl(path.join(BANK, '_data', 'cases', 'shixuemin.practical.jsonl'))];
  const keyOf = (h) => { const m = h.match(/^(.{1,5}?)[，,]?\s*(男|女)\s*(\d+)/); const d = (h.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) || []).slice(1).join('-'); return m ? m[1] + (m[2] === '男' ? 'M' : 'F') + m[3] + d : ''; };
  const otherKeys = new Map(); for (const p of other) { const k = keyOf(p.original_passage.split('\n')[0] || ''); if (k) otherKeys.set(k, p.id); }
  let dup = 0;
  for (const r of out) {
    const demoLine = r.original_passage.split('\n')[1] || '';
    const k = demoLine ? demoLine.match(/^(.{1,5}?)[，,]/)?.[1] + r.patient.sex + r.patient.age + r.date : '';
    if (k && otherKeys.has(k)) { r.tags.push('同患者见 ' + otherKeys.get(k)); dup++; }
  }
  console.log('cross-book duplicate patients flagged (kept, not dropped):', dup);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n');

// research chapter (Part 6), cleaned, for guide-writing
const researchOut = researchLines.map((x) => x.s).join('\n');
fs.writeFileSync(SP + 'shi-linzheng-research.txt', researchOut);

const byDept = {}; for (const r of out) { const k = r.ref.split(' · ')[1].split('·')[0]; byDept[k] = (byDept[k] || 0) + 1; }
console.log('cases', out.length, byDept);
console.log('no points:', out.filter((r) => !r.points.length).length, ' no pattern_zh(证型):', out.filter((r) => !r.pattern_zh).length, ' with herbs:', out.filter((r) => r.kv_zh.some(([k]) => k === '中药')).length);
console.log('problems:', problems.length ? problems.join(' | ') : 'none');
console.log('research chapter chars:', researchOut.length);
const distinctDis = new Set(out.map((r) => r.ref.split(' · ')[1]));
console.log('distinct dept·category·disease:', distinctDis.size);
