#!/usr/bin/env node
// 石学敏针灸全集 第四部分 临床医案 -> cases/shixuemin.jsonl
//   node parse-shi-cases.mjs
import fs from 'fs';
import path from 'path';
import { scan } from './points.mjs';

const SP = process.env.ACU_SCRATCH || 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\new-books\\';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const OUT = path.join(BANK, '_data', 'cases', 'shixuemin.jsonl');
const TITLE = '石学敏针灸全集';

const all = fs.readFileSync(SP + 'shi-quanji.txt', 'utf8').replace(/\r/g, '').split('\n');
// Part 4 starts at the second "第四部分临床医案" (the first is the table of contents)
let start = -1;
all.forEach((l, i) => { if (/^第四部分临床医案/.test(l.trim())) start = i; });

const FIX = [[/抢转/g, '捻转'], [/千部/g, '干部'], [/雀[啄琢]/g, '雀啄'], [/中皖/g, '中脘']];
const fix = (s) => FIX.reduce((a, [r, t]) => a.replace(r, t), s);
const DROP = [/^=+ PAGE \d+ =+$/, /石学敏针灸.{0,2}集/, /^第四部分第.{1,4}章.{2,10}\d{2,4}$/, /^\d{1,4}$/, /^[+＋·.\s]{1,4}$/, /^录xi?$/i];

const DEPT = { 九: '内科', 十: '骨伤风湿免疫', 十一: '妇科', 十二: '男科', 十三: '儿科', 十四: '皮肤科', 十五: '外科', 十六: '五官科', 十七: '精神科', 十八: '急症', 十九: '其他病症' };
const lines = [];
for (let i = start; i < all.length; i++) {
  let s = fix(all[i].trim());
  if (!s || DROP.some((r) => r.test(s))) continue;
  lines.push(s);
}
// headings split over two lines ("第十四章" / "皮肤科疾病", "第一节" / "网状淋巴管炎") -> join
for (let i = 0; i < lines.length - 1; i++) {
  if (/^第[一二三四五六七八九十]+[章节]$/.test(lines[i]) && !/^第/.test(lines[i + 1]) && lines[i + 1].length < 24) { lines[i] += lines[i + 1]; lines.splice(i + 1, 1); }
}

const LABELS = ['主诉', '病史', '查体和实验室检查', '查体及实验室检查', '中医诊断', '西医诊断', '辨证', '治则', '选穴', '操作', '治疗经过', '疗效', '随访'];
const LAB = new RegExp('^(' + LABELS.join('|') + ')[，,、·:：\\s]*');
const PATIENT = /(男|女)\s*\d+\s*(岁|月|天)|入院日期|初诊日期|就诊日期/;
const COMM = /^(本例|本病例|本病案|该病例|该病案|以上|上述|病案分析|按语|体会|讨论|小结|分析|石学敏院士|石氏|醒脑开窍(针刺)?法|现代医学|针刺治疗)/;
// OCR sometimes leaves 1-2 stray characters before a label ("留主诉", "不病史"): tolerate them only if that label has not been seen yet in this case
const LAB_STRAY = new RegExp('^[\\u3400-\\u9fff0-9a-zA-Z\\-+.·]{1,2}(' + LABELS.join('|') + ')[，,、·:：\\s]*');

// ---- walk: hierarchy + case blocks ----
let dept = '', sect = '', dis = '', sub = '';
const blocks = [];            // {dept,sect,dis,sub,marker,headerLines,lines[]}
let cur = null, pendingMarker = '', hdrBuf = [];
for (const s of lines) {
  const cm = s.match(/^第([九十]|十[一二三四五六七八九])章\s*(.*)$/);
  if (cm && s.length < 24 && /疾病|科|急症|病症/.test(s)) { dept = DEPT[cm[1]] || s; sect = dis = sub = ''; cur = null; hdrBuf = []; continue; }
  const sm = s.match(/^第([一二三四五六七八九十]+)节\s*[?？·.]?\s*([\u3400-\u9fff、，（）()]{2,24})$/);
  if (sm && s.length < 26) { sect = sm[2]; dis = ''; sub = ''; cur = null; hdrBuf = []; continue; }
  const dm = s.match(/^[一二三四五六七八九十]{1,3}[、，.．]\s*([\u3400-\u9fff、（）()]{2,20})$/);
  if (dm && s.length < 24 && !LAB.test(s)) { dis = dm[1]; sub = ''; cur = null; hdrBuf = []; continue; }
  const s2 = s.match(/^[（(][一二三四五六七八九十]+[）)]\s*([\u3400-\u9fff、（）()]{2,16})$/);
  if (s2 && s.length < 22) { sub = s2[1]; continue; }
  const mk = s.match(/^[+＋]?病(例|案)\s*(\d*)/);
  if (mk && s.length < 14) { pendingMarker = mk[2] || ''; cur = null; hdrBuf = []; continue; }
  if (PATIENT.test(s) && s.length < 60 && !LAB.test(s)) { cur = { dept, sect, dis, sub, marker: pendingMarker, header: s, lines: [] }; blocks.push(cur); pendingMarker = ''; hdrBuf = []; continue; }
  const l = s.match(LAB);
  if (l && l[1] === '主诉' && !cur) { cur = { dept, sect, dis, sub, marker: pendingMarker, header: '', lines: [] }; blocks.push(cur); pendingMarker = ''; }
  if (cur) cur.lines.push(s);
}

// ---- parse each block ----
function parse(b) {
  const f = {};       // label -> text
  let label = null; const order = [];
  const extra = [];
  let ended = false;
  for (const s of b.lines) {
    let m = s.match(LAB);
    if (!m) { const st = s.match(LAB_STRAY); if (st && !f[st[1].replace('查体及实验室检查', '查体和实验室检查')]) m = st; }
    if (m) { label = m[1].replace('查体及实验室检查', '查体和实验室检查'); f[label] = (f[label] ? f[label] + ' ' : '') + s.slice(m[0].length); order.push(label); ended = false; continue; }
    if (!label) { extra.push(s); continue; }
    if (label === '治疗经过' && COMM.test(s)) ended = true;
    if (ended) extra.push(s); else f[label] += s;
  }
  // safety cap: a 治疗经过 longer than 800 chars has swallowed the disease-level discussion
  for (const k of ['治疗经过', '疗效']) if (f[k] && f[k].length > 800) { const cut = f[k].indexOf('。', 600); if (cut > 0) { extra.unshift(f[k].slice(cut + 1)); f[k] = f[k].slice(0, cut + 1); } }
  return { f, extra };
}

const out = [];
let seq = 0;
const perDis = new Map();
for (const b of blocks) {
  const { f, extra } = parse(b);
  if (!f['主诉'] && !f['选穴']) continue;
  const disease = b.dis || b.sect || '其他';
  const key = b.dept + '|' + b.sect + '|' + disease;
  perDis.set(key, (perDis.get(key) || 0) + 1);
  const no = b.marker || String(perDis.get(key));
  const hm = b.header.match(/(男|女)\s*(\d+)\s*(岁|月|天)/);
  const sex = hm ? (hm[1] === '男' ? 'M' : 'F') : '';
  const age = hm ? hm[2] + (hm[3] === '岁' ? '' : hm[3]) : '';
  const date = (b.header.match(/(?:入院|初诊|就诊)日期[：:]?\s*([0-9]{4}年[0-9]{0,2}月?[0-9]{0,2}日?)/) || [])[1] || '';
  const tcm = (f['中医诊断'] || '').replace(/[。.]$/, ''), wm = (f['西医诊断'] || '').replace(/[。.]$/, '');
  const sel = f['选穴'] || '', op = f['操作'] || '';
  let points = [...new Set(scan(sel).map((h) => h.name))];
  if (!points.length) points = [...new Set(scan(op).map((h) => h.name))];
  const passage = [b.header, ...b.lines].join('\n');
  const TECH = [['醒脑开窍', /醒脑开窍/], ['刺络放血', /放血|刺络|点刺出血/], ['拔罐', /拔罐|拨罐/], ['温针灸', /温针/], ['艾灸', /艾灸|艾条|艾炷|隔[姜盐附]|雷火针/], ['电针', /电针/], ['TDP', /TDP/], ['耳针', /耳针|耳穴/], ['头针', /头针|头皮针/], ['皮肤针', /皮肤针|梅花针/], ['火针', /火针/], ['芒针', /芒针/], ['透刺', /透刺|透向|针向|透[^明]/], ['水针', /水针|穴位注射/], ['三棱针', /三棱针/]];
  const tech = TECH.filter(([, r]) => r.test(f['治则'] + sel + op)).map(([n]) => n);
  out.push({
    id: 'sxm-' + String(++seq).padStart(3, '0'), doctor_id: 'shixuemin', source_slug: 'shixuemin-quanji', source_title: TITLE,
    ref: `《${TITLE}》病例${no} · ${b.dept}·${b.sect || disease}·${disease} (石学敏)`,
    modality: /中药|汤剂|方药|口服/.test(op) ? 'mixed' : 'acupuncture',
    patient: { sex, age }, date, title_zh: tcm || wm || disease,
    complaint_zh: f['主诉'] || '', pattern_zh: f['辨证'] || '', formula_zh: '', principle_zh: f['治则'] || '',
    dx_zh: [tcm && '中医：' + tcm, wm && '西医：' + wm].filter(Boolean).join('；'),
    points, outcome_zh: f['治疗经过'] || f['疗效'] || '',
    kv_zh: [['主诉', f['主诉']], ['病史', f['病史']], ['查体', f['查体和实验室检查']], ['中医诊断', tcm], ['西医诊断', wm], ['辨证', f['辨证']], ['治则', f['治则']], ['选穴', sel], ['操作', op], ['治疗经过', f['治疗经过'] || f['疗效']]].filter(([, t]) => t),
    commentary_zh: extra.join('\n'),
    original_passage: passage, tags: [...tech, ...(b.sub ? [b.sub] : [])], _sect: b.sect,
  });
}

// "选穴同前 / 同病例N": inherit the points of the referenced earlier case in the same disease group (kept visible via a tag)
let inherited = 0;
for (let i = 0; i < out.length; i++) {
  const r = out[i];
  if (r.points.length) continue;
  const sel = (r.kv_zh.find(([k]) => k === '选穴') || [, ''])[1];
  if (!/^同/.test(sel)) continue;
  const grp = r.ref.split(' · ')[1];
  const want = (sel.match(/同病例\s*(\d+)/) || [])[1];
  let src = null;
  for (let j = i - 1; j >= 0 && out[j].ref.split(' · ')[1] === grp; j--) {
    if (!out[j].points.length) continue;
    if (want && !out[j].ref.includes('病例' + want + ' ')) { if (!src) src = out[j]; continue; }
    src = out[j]; break;
  }
  if (src) { r.points = [...src.points]; r.tags.push('选穴同前'); inherited++; }
}
console.log('points inherited from earlier case:', inherited);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n');

const by = {}; for (const r of out) { const k = r.ref.split(' · ')[1].split('·')[0]; by[k] = (by[k] || 0) + 1; }
console.log('cases', out.length, by);
console.log('no 选穴:', out.filter((r) => !r.kv_zh.some(([k]) => k === '选穴')).length, ' no points:', out.filter((r) => !r.points.length).length,
  ' no 治则:', out.filter((r) => !r.principle_zh).length, ' no 主诉:', out.filter((r) => !r.complaint_zh).length, ' no 辨证:', out.filter((r) => !r.pattern_zh).length);
const long = out.filter((r) => (r.outcome_zh || '').length > 700);
console.log('long outcome (>700):', long.length, long.slice(0, 8).map((r) => r.ref.match(/病例\S+/)[0] + '/' + r._sect).join(' '));
const disMap = new Map(); for (const r of out) { const k = r.ref.split(' · ')[1]; disMap.set(k, (disMap.get(k) || 0) + 1); }
console.log('distinct dept·sect·disease:', disMap.size);
