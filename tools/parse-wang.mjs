#!/usr/bin/env node
// 王居易针灸医案讲习录 -> cases/wangjuyi.jsonl  (+ essay/front-matter chunks for guide writing)
//   node parse-wang.mjs
import fs from 'fs';
import path from 'path';
import { scan, normPoint } from './points.mjs';

const SP = process.env.ACU_SCRATCH || 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\new-books\\';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const OUT = path.join(BANK, '_data', 'cases', 'wangjuyi.jsonl');
const TITLE = '王居易针灸医案讲习录';

// ---- pages ----
const raw = fs.readFileSync(SP + 'wang-yian.txt', 'utf8').replace(/\r/g, '');
const parts = raw.split(/\n===== PAGE (\d+) =====\n/);
const pages = new Map();
for (let i = 1; i < parts.length; i += 2) pages.set(+parts[i], parts[i + 1]);

// ---- OCR normalisation (systematic in this scan) ----
const FIX = [[/中皖/g, '中脘'], [/上皖/g, '上脘'], [/下皖/g, '下脘'], [/瑜穴/g, '腧穴'], [/瑜/g, '腧'], [/辩经/g, '辨经'], [/膏育/g, '膏肓'], [/擅中/g, '膻中'], [/鹏/g, '腧']];
const fix = (s) => FIX.reduce((a, [r, t]) => a.replace(r, t), s);

// ---- TOC -> groups by starting PDF page ----
const NUMS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', '拾壹', '拾贰', '拾叁', '拾肆'];
const DEPT = ['呼吸系统', '心血管', '消化系统', '泌尿系统', '神经与带状疱疹', '汗证', '过敏性疾病', '妇科', '儿科', '外科杂病', '皮肤科', '疼痛症', '五官', '神志病'];
const toc = fs.readFileSync(SP + 'wang-yian.toc.txt', 'utf8').split('\n').filter(Boolean).map((l) => { const [t, p] = l.trim().split('\t'); return { t, p: +p }; });
const groups = [];       // {chapter, dept, name, from, to(case nos), pdf}
const essays = [];       // {chapter, title, pdf}
let ch = -1;
for (const e of toc) {
  const cm = e.t.match(/^(壹|贰|叁|肆|伍|陆|柒|捌|玖|拾壹|拾贰|拾叁|拾肆|拾)／\d+$/);
  if (cm) { ch = NUMS.indexOf(cm[1]); continue; }
  if (ch < 0) continue;
  const g = e.t.match(/^(.+?)（案(\d+)(?:[～~]案?(\d+))?）／\d+$/);
  if (g) groups.push({ chapter: ch, dept: DEPT[ch], name: g[1], from: +g[2], to: +(g[3] || g[2]), pdf: e.p });
  else if (/^诊后絮语/.test(e.t) || /／\d+$/.test(e.t)) essays.push({ chapter: ch, title: e.t.replace(/／\d+$/, ''), pdf: e.p });
}
groups.sort((a, b) => a.pdf - b.pdf);
const groupAt = (pdf) => { let g = groups[0]; for (const x of groups) if (x.pdf <= pdf) g = x; return g; };
const CHAP_START = groups.filter((g, i) => i === 0 || g.chapter !== groups[i - 1].chapter).map((g) => g.pdf);
const FIRST = groups[0].pdf;                      // 27
const LAST = toc.find((e) => /^跋/.test(e.t)).p;   // 254

// ---- body lines with page ----
const NOISE = [/^\d{3}$/, /^[\w.@]{3,10}$/, /^王居易\W*$/, /针灸医案讲习录/, /^王居?$/, /^针灸医$/, /^一?针灸$/, /^[\W_a-zA-Z@.。？?，,·]{1,10}$/, /^es\.?\S?$/i, /^S5O/];
const lines = [];
for (let p = FIRST; p < LAST; p++) {
  for (const l0 of (pages.get(p) || '').split('\n')) {
    const l = fix(l0.trim());
    if (!l || NOISE.some((r) => r.test(l))) continue;
    lines.push({ p, s: l });
  }
}

// ---- split into cases ----
const HDR = /^[案索]\s*([0-9lIiOo]+)\s*[：:]\s*(.*)$/;   // "索26" = OCR of 案26
const cases = [];
let cur = null;
for (const { p, s } of lines) {
  const m = s.match(HDR);
  if (m) { cur = { n: +m[1].replace(/[lIi]/g, '1').replace(/[Oo]/g, '0'), hdr: m[2], p, lines: [] }; cases.push(cur); continue; }
  if (/^(壹|贰|叁|肆|伍|陆|柒|捌|玖|拾壹?|拾贰|拾叁|拾肆)$/.test(s) && cur) { cur.lines.push({ p, s: '\u0001CHAPTER' }); continue; }
  if (cur) cur.lines.push({ p, s });
}

// ---- parse a case ----
const LABEL = /^(初诊|[二三四五六七八九十]+诊(?:[至、][二三四五六七八九十]+诊)*|主诉|症候|经络诊察|辨经|选经|选穴|疗效|中药处方|按语|【医案解读】|医案解读|治疗(?=[：:]))\s*[：:]?\s*/;
const HERB_RE = /\d+\s*g/;
// "点" only as the stimulation code ("点大椎", "大椎（点）", "点刺"), never inside 重点 / 5点; "灸" never as part of 针灸
const TECH = [['点刺', /点刺|（点）|(^|[，。；、：:\s])点(?=[㐀-鿿]{2})/], ['操法', /操[^作]|操中|操脾/], ['灸', /(?<!针)灸/], ['加灸', /加灸/], ['刺络放血', /刺络|放血/], ['拔罐', /拔罐|水罐/], ['TDP', /TDP/]];
const GRADE = ['临床痊愈', '显效', '有效', '无效'];

function parseCase(c) {
  // cut trailing chapter marker & stop at 诊后絮语
  const ls = [];
  for (const x of c.lines) { if (x.s === '\u0001CHAPTER' || /^诊后絮语/.test(x.s)) break; ls.push(x.s); }
  const fields = [];   // {label, text[]}
  let f = null;
  const stray = [];
  const SINGLE = new Set(['主诉', '辨经', '选经', '选穴']);      // one-sentence fields: after their full stop, unlabelled lines are remarks, not part of the field
  for (const s of ls) {
    const m = s.match(LABEL);
    if (m) { f = { label: m[1].replace(/^【|】$/g, '').replace(/^治疗$/, '选穴'), text: [s.slice(m[0].length)] }; fields.push(f); }
    else if (f && SINGLE.has(f.label) && /。$/.test(f.text.join('').trim())) stray.push(s);
    else if (f) f.text.push(s);
    else { f = { label: '_pre', text: [s] }; fields.push(f); }
  }
  // 疗效 is one sentence; whatever follows it is the author's own remarks (按语-style), not outcome
  for (const x of fields) {
    if (x.label !== '疗效') continue;
    let k = 1;
    while (k < x.text.length && !/[。！]$/.test(x.text.slice(0, k).join('').trim()) && k < 2) k++;
    stray.push(...x.text.slice(k));
    x.text = x.text.slice(0, k);
  }
  const get = (lab) => fields.filter((x) => x.label === lab).map((x) => x.text.join('').trim());
  const first = (lab) => get(lab)[0] || '';
  const visits = fields.filter((x) => /^(初诊|[二三四五六七八九十]+诊)/.test(x.label)).map((x) => ({ label: x.label, text: x.text.join('').trim() }));
  const commentary = [...get('医案解读'), ...(stray.length ? [stray.join('')] : []), ...get('按语').map((t) => '按语：' + t)].join('\n\n');
  const herbs = fields.filter((x) => x.label === '中药处方').map((x) => x.text.join(' ').replace(/\s+/g, ' ').trim());
  // any 中药处方 embedded inside a visit's text
  const emb = visits.map((v) => (v.text.match(/中药处方[：:].*$/) || [''])[0]).filter(Boolean);
  const selPts = scan(first('选穴')).map((h) => h.name);
  const txSent = visits.flatMap((v) => v.text.split(/[。；;]/).filter((x) => /取|针|点|操|灸|加|去|配|刺/.test(x)));
  const laterPts = txSent.flatMap((x) => scan(x).map((h) => h.name));
  const points = [...new Set([...selPts, ...laterPts])];
  const outcome = first('疗效');
  const grade = GRADE.find((g) => outcome.includes(g)) || '';
  const passage = ls.join('\n');
  const tech = TECH.filter(([, r]) => r.test(first('选穴') + visits.map((v) => v.text).join(''))).map(([n]) => n);
  return { fields, first, get, visits, commentary, herbs: [...herbs, ...emb], points, outcome, grade, passage, tech };
}

const out = [];
const problems = [];
let seq = 0;
for (const c of cases) {
  const P = parseCase(c);
  const g = groupAt(c.p);
  const hm = c.hdr.match(/(男|女)[，,\s]*(\d+)\s*岁/) || c.hdr.match(/(男|女)/);
  const sex = hm ? (hm[1] === '男' ? 'M' : 'F') : '';
  const age = hm && hm[2] ? hm[2] : '';
  const start = P.get('初诊')[0] || '';
  const date = (start.match(/\d{4}年\d{1,2}月\d{1,2}日/) || [''])[0];
  const visitsN = P.visits.length;
  const complaint = P.first('主诉');
  const disease = /咳/.test(g.name) ? '咳嗽' : g.name;
  const kv = [
    ['主诉', complaint], ['症候', P.first('症候')], ['经络诊察', P.first('经络诊察')], ['辨经', P.first('辨经')], ['选经', P.first('选经')], ['选穴', P.first('选穴')],
    ...P.visits.filter((v) => v.label !== '初诊').map((v) => [v.label, v.text]),
    ...(P.herbs.length ? [['中药处方', P.herbs.join(' ｜ ')]] : []), ['疗效', P.outcome],
  ].filter(([, t]) => t);
  if (!complaint) problems.push('案' + c.n + ' no 主诉');
  if (!P.first('选穴')) problems.push('案' + c.n + ' no 选穴');
  if (!P.outcome) problems.push('案' + c.n + ' no 疗效');
  const id = 'wjy-' + String(++seq).padStart(3, '0');
  out.push({
    id, doctor_id: 'wangjuyi', source_slug: 'wangjuyi-yian', source_title: TITLE,
    ref: `《${TITLE}》案${c.n} · ${g.dept}·${g.name}·${disease} (王居易)`,
    modality: P.herbs.length ? 'mixed' : 'acupuncture',
    patient: { sex, age }, date, title_zh: (complaint || disease).replace(/[。.]$/, ''),
    complaint_zh: complaint, pattern_zh: P.first('辨经'), channels_zh: P.first('选经'),
    formula_zh: P.first('选穴'), herbs_zh: P.herbs.join(' ｜ '),
    points: P.points, outcome_zh: P.outcome, kv_zh: kv, commentary_zh: P.commentary,
    original_passage: P.passage,
    tags: [...P.tech, ...(P.grade ? [P.grade] : []), visitsN + '诊', ...(P.herbs.length ? ['配合中药'] : [])],
    _pdf: c.p,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n');

// ---- prescription bank compiled from his own recorded 选穴 (one entry per disease; NOT a formulary in the book) ----
{
  const byDis = new Map();
  for (const r of out) { const p = r.ref.split(' · ')[1].split('·'); const k = p[0] + '|' + p[2]; if (!byDis.has(k)) byDis.set(k, { dept: p[0], disease: p[2], cases: [] }); byDis.get(k).cases.push(r); }
  const rxs = [];
  for (const g of byDis.values()) {
    const freq = new Map();
    for (const c of g.cases) for (const pt of c.points) freq.set(pt, (freq.get(pt) || 0) + 1);
    const ordered = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const paras = g.cases.map((c) => `**${c.ref.match(/案\d+/)[0]}　${(c.complaint_zh || '').replace(/[。.]$/, '')}**\n\n选穴：${(c.kv_zh.find(([k]) => k === '选穴') || [, c.formula_zh])[1] || '（本案未列选穴，见医案）'}${c.pattern_zh ? '\n\n辨经：' + c.pattern_zh : ''}`);
    const groups = g.cases.filter((c) => c.points.length >= 2).map((c) => ({ label: c.ref.match(/案\d+/)[0], points: [...new Set(scan((c.kv_zh.find(([k]) => k === '选穴') || [, ''])[1]).map((h) => h.name))], text: (c.kv_zh.find(([k]) => k === '选穴') || [, ''])[1] })).filter((x) => x.points.length >= 2);
    const stats = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, k]) => `${n} ×${k}`).join('，');
    const tech = [...new Set(g.cases.flatMap((c) => c.tags.filter((t) => ['点刺', '操法', '灸', '加灸', '刺络放血', '拔罐', 'TDP'].includes(t))))];
    rxs.push({
      id: 'wjy-rx-' + String(rxs.length + 1).padStart(3, '0'), doctor: 'wangjuyi', book: TITLE, system: { no: DEPT.indexOf(g.dept) + 1, zh: g.dept, en: '' }, section: null,
      name: { zh: g.disease, en: '' }, alias: `据 ${g.cases.length} 个医案汇编`, rx_zh: paras.join('\n\n'), groups, points: ordered,
      codes: [...new Set(ordered.flatMap((n) => (scan(n)[0] || {}).codes || []))], care_zh: '', prognosis_zh: '',
      extra: { '常用穴统计': stats + '（次数 = 该病医案中出现的案数）' }, indication: 'yes', method: tech, gauge: [],
      note: '本条由王居易医案中记录的“选穴”汇编而成，并非原书列出的成方；每案选穴均为原文。', notes_path: '', derived: true,
    });
  }
  const RXOUT = path.join(BANK, '_data', 'prescriptions', 'wangjuyi.json');
  fs.mkdirSync(path.dirname(RXOUT), { recursive: true });
  fs.writeFileSync(RXOUT, JSON.stringify(rxs, null, 1));
  console.log('compiled prescriptions', rxs.length);
}

// ---- chunks for guide writing ----
const front = [];
for (let p = 13; p <= 20; p++) front.push(`===== PAGE ${p} =====\n` + fix(pages.get(p) || ''));
fs.writeFileSync(SP + 'wang-front.txt', front.join('\n'));
// essays: from each chapter's 诊后絮语 heading page to the next chapter start
const ess = [];
CHAP_START.forEach((start, i) => {
  const end = i + 1 < CHAP_START.length ? CHAP_START[i + 1] : LAST;
  const es = essays.filter((e) => e.chapter === i);
  const from = es.length ? Math.min(...es.map((e) => e.pdf)) : end;
  ess.push(`\n######## CHAPTER ${NUMS[i]} ${DEPT[i]}  essays: ${es.map((e) => e.title + '@' + e.pdf).join(' | ')}\n`);
  for (let p = from; p < end; p++) ess.push(`===== PAGE ${p} =====\n` + fix(pages.get(p) || ''));
});
fs.writeFileSync(SP + 'wang-essays.txt', ess.join('\n'));

// ---- report ----
const byGroup = {};
for (const r of out) { const k = r.ref.split(' · ')[1]; byGroup[k] = (byGroup[k] || 0) + 1; }
console.log('cases', out.length, 'expected 125 (+1 dup no.)');
console.log('groups', groups.length, 'essay TOC entries', essays.length);
console.log('no points:', out.filter((r) => !r.points.length).map((r) => r.ref.match(/案\d+/)[0]).join(' '));
console.log('problems:', problems.join(' | ') || 'none');
console.log('avg points', (out.reduce((s, r) => s + r.points.length, 0) / out.length).toFixed(1));
console.log(JSON.stringify(byGroup));
