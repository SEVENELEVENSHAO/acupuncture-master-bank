#!/usr/bin/env node
// 石学敏针灸全集 (Part 3 治疗各论) + 石学敏实用针灸学 (下篇 疾病各论)
//   -> prescriptions/shixuemin.json  +  cases/shixuemin.practical.jsonl (验案举例 of the textbook)
//   node parse-shi-books.mjs
import fs from 'fs';
import path from 'path';
import { scan } from './points.mjs';

const SP = process.env.ACU_SCRATCH || 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\new-books\\';
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const OUT_RX = path.join(BANK, '_data', 'prescriptions', 'shixuemin.json');
const OUT_CASES = path.join(BANK, '_data', 'cases', 'shixuemin.practical.jsonl');

const FIX = [[/抢转/g, '捻转'], [/雀[啄琢]/g, '雀啄'], [/中皖/g, '中脘'], [/辩证/g, '辨证'], [/醒脑开窝|醒脑开穿/g, '醒脑开窍']];
const fix = (s) => FIX.reduce((a, [r, t]) => a.replace(r, t), s);
const DROP = [/^=+ PAGE \d+ =+$/, /石学[敏傲做]?.{0,3}(针灸.{0,2}集|实用针灸学)/, /^第[三四]部分第.{1,4}章.{2,10}\d{2,4}$/, /^第[八九十]+章.{2,8}$/, /^[·.:：\s]*\d{1,4}[·.:：\s]*$/, /^[+＋·.\s]{1,4}$/];

// ---------- department (系统) labels ----------
const SYS = {
  内科: { no: 1, en: 'Internal Medicine' }, 骨伤风湿免疫科: { no: 2, en: 'Orthopedics, Rheumatology & Immunology' }, 妇科: { no: 3, en: 'Gynecology' }, 男科: { no: 4, en: 'Andrology' },
  儿科: { no: 5, en: 'Pediatrics' }, 皮肤科: { no: 6, en: 'Dermatology' }, 外科: { no: 7, en: 'Surgery' }, 五官科: { no: 8, en: 'ENT, Eye & Mouth' }, 眼科: { no: 8, en: 'ENT, Eye & Mouth' },
  精神科: { no: 9, en: 'Psychiatry' }, 急症: { no: 10, en: 'Emergencies' }, 其他病症: { no: 11, en: 'Other Conditions' },
};
const sysOf = (zh) => ({ no: (SYS[zh] || { no: 12 }).no, zh: zh === '眼科' ? '五官科' : zh, en: (SYS[zh] || { en: zh }).en });
const SEC2SYS = (t) => (/内科/.test(t) ? '内科' : /骨伤|风湿/.test(t) ? '骨伤风湿免疫科' : /妇科/.test(t) ? '妇科' : /男科/.test(t) ? '男科' : /儿科/.test(t) ? '儿科' : /皮肤/.test(t) ? '皮肤科'
  : /外科/.test(t) ? '外科' : /五官|眼科/.test(t) ? '五官科' : /精神/.test(t) ? '精神科' : /急症/.test(t) ? '急症' : /其他/.test(t) ? '其他病症' : null);

// ---------- generic block parser ----------
const TAGS = '临床表现与诊断|临床表现|鉴别诊断|针灸治疗|治疗规范|配方理论|转归及预后|预后|预防与调护|验案举例|临证提要|病因病机|诊断|治疗';
const TAG_RE = new RegExp('^[【（(\\[]{0,3}(' + TAGS + ')(?:[】）)\\]]|\\s*$)');     // tolerates OCR-damaged brackets: "【（针灸治疗）", "配方理论】", bare "针灸治疗"
const SUBL_RE = /^[1-9１-９]\s*[.．、]\s*(治则|配方|操作|疗程|注意事项|处方|方义)\s*(.*)$/;      // label may be followed by its content on the same line
const NEWPARA = /^(（[一二三四五六七八九十]+）|\d+[)）]|\d+[.．、]|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+[、.．]|加减[：:]|主穴[：:]|配穴[：:])/;

function paras(lines) {
  const out = []; let buf = '';
  for (const l of lines) { if (buf && NEWPARA.test(l)) { out.push(buf); buf = ''; } buf += l; }
  if (buf) out.push(buf);
  return out;
}

function splitBlock(lines) {
  // -> {intro:[], tags:{name:[lines]}, order:[]}
  const r = { intro: [], tags: {}, order: [] };
  let cur = r.intro;
  for (const l of lines) {
    const m = l.match(TAG_RE);
    if (m) { const name = m[1] === '治疗规范' ? '针灸治疗' : m[1] === '转归及预后' ? '预后' : m[1] === '临床表现' ? '临床表现与诊断' : m[1]; if (!r.tags[name]) { r.tags[name] = []; r.order.push(name); } cur = r.tags[name]; const rest = l.slice(m[0].length).trim(); if (rest) cur.push(rest); continue; }
    cur.push(l);
  }
  // fallback: the 针灸治疗 label was lost to OCR. Treatment then starts at the first short "（1）发作期"-style line
  // (or a "1.治则" line) inside the diagnosis text, and runs to the end of that section.
  if (!r.tags['针灸治疗']) {
    const holder = r.tags['鉴别诊断'] ? '鉴别诊断' : r.tags['临床表现与诊断'] ? '临床表现与诊断' : null;
    if (holder) {
      const arr = r.tags[holder];
      const k = arr.findIndex((l, i) => i > 1 && (/^1\s*[.．]\s*治则/.test(l) || /^（1）[^：:。，]{2,10}$/.test(l)));
      if (k > 0) { r.tags['针灸治疗'] = arr.slice(k); r.tags[holder] = arr.slice(0, k); r.order.push('针灸治疗'); r.fallback = true; }
    }
  }
  return r;
}
function splitTreat(lines) {
  const sub = {}; let cur = null; const order = [];
  for (const l of lines) {
    const m = l.match(SUBL_RE);
    if (m && m[2].length < 200 && !/^[的之是为]/.test(m[2])) { cur = m[1] === '处方' ? '配方' : m[1]; sub[cur] = []; order.push(cur); if (m[2].trim()) sub[cur].push(m[2].trim()); continue; }
    if (cur) sub[cur].push(l);
    else { sub._pre = sub._pre || []; sub._pre.push(l); }
  }
  return { sub, order };
}

const METHODS = [['醒脑开窍', /醒脑开窍/], ['捻转补法', /捻转补法/], ['提插泻法', /提插泻法/], ['捻转泻法', /捻转泻法/], ['平补平泻', /平补平泻/], ['雀啄', /雀啄/], ['刺络放血', /放血|刺络|点刺出血/], ['拔罐', /拔罐|拨罐|火罐/],
  ['温针灸', /温针/], ['艾灸', /艾灸|艾条|艾炷|隔[姜盐附]|雷火针|灸法/], ['电针', /电针/], ['透刺', /透刺|透向|针向/], ['头针', /头针|头皮针/], ['耳针', /耳针|耳穴/], ['皮肤针', /皮肤针|梅花针/], ['火针', /火针/], ['三棱针', /三棱针/], ['TDP', /TDP/], ['芒针', /芒针/], ['水针', /水针|穴位注射/]];

function buildRecord({ book, sys, name, alias, lines, seqRef }) {
  const b = splitBlock(lines);
  const tr = b.tags['针灸治疗'] ? splitTreat(b.tags['针灸治疗']) : { sub: {}, order: [] };
  const parts = [];
  for (const k of ['治则', '配方', '操作', '疗程', '注意事项', '方义']) if (tr.sub[k] && tr.sub[k].length) parts.push('**【' + k + '】**\n\n' + paras(tr.sub[k]).join('\n\n'));
  if (!parts.length && b.tags['针灸治疗']) parts.push(paras(b.tags['针灸治疗']).join('\n\n'));
  const rx = parts.join('\n\n');
  const formula = (tr.sub['配方'] || []);
  const groups = [];
  for (const p of paras(formula)) {
    for (const seg of p.split(/[；;]/)) {
      const pts = [...new Set(scan(seg).map((h) => h.name))];
      if (pts.length >= 2) { const lab = seg.match(/^[^：:，,。]{1,16}(?=[：:])/); groups.push({ label: lab ? lab[0].replace(/^[（(]?[一二三四五六七八九十0-9]+[）).、]/, '').trim() : '', points: pts, text: seg.trim() }); }
    }
  }
  const points = [...new Set(scan(formula.join('')).map((h) => h.name))];
  const codes = [...new Set(scan(formula.join('')).flatMap((h) => h.codes || []))];
  const tech = (tr.sub['操作'] || []).join('') + (tr.sub['治则'] || []).join('');
  const method = METHODS.filter(([, r]) => r.test(tech + rx)).map(([n]) => n);
  const gauge = [...new Set([...rx.matchAll(/(\d{2})号/g)].map((x) => x[1] + '号'))];
  const extra = {};
  const intro = paras(b.intro).join('\n\n');
  if (intro) extra['概述'] = intro;
  if (b.tags['临床表现与诊断']) extra['临床表现与诊断'] = paras(b.tags['临床表现与诊断']).join('\n\n');
  if (b.tags['鉴别诊断']) extra['鉴别诊断'] = paras(b.tags['鉴别诊断']).join('\n\n');
  if (b.tags['配方理论']) extra['配方理论'] = paras(b.tags['配方理论']).join('\n\n');
  if (b.tags['临证提要']) extra['临证提要'] = paras(b.tags['临证提要']).join('\n\n');
  return {
    id: '', doctor: 'shixuemin', book, system: sys, section: null, name: { zh: name, en: '' }, alias: alias || '',
    rx_zh: rx, groups, points, codes, care_zh: b.tags['预防与调护'] ? paras(b.tags['预防与调护']).join('\n\n') : '',
    prognosis_zh: b.tags['预后'] ? paras(b.tags['预后']).join('\n\n') : '', extra, indication: 'yes', method, gauge, note: '', notes_path: '',
    _hasTreat: !!b.tags['针灸治疗'], _cases: b.tags['验案举例'] || [],
  };
}

// =====================================================================
// 全集 Part 3
// =====================================================================
const NAME_FIX = { 春咽困难: '吞咽困难', 癫鼻痫: '癫痫', 疯: '瘛疭', 瘘证: '痿证', 便小秘: '便秘', 神经性尿猪留: '神经性尿潴留', 勃起功能障碍中司: '勃起功能障碍', 尊麻疹: '荨麻疹', 痒疹免器电业: '痒疹', 视神经委缩: '视神经萎缩', 喉暗: '喉喑', 脑骨外上炎: '肱骨外上髁炎', 慢性疲劳综合征: '慢性疲劳综合征' };
function quanji() {
  const all = fs.readFileSync(SP + 'shi-quanji.txt', 'utf8').replace(/\r/g, '').split('\n');
  let a = -1, z = all.length;
  all.forEach((l, i) => { if (/^第八章.{0,2}治疗各论/.test(l.trim())) a = i; });          // the LAST one is the body heading (earlier ones are the table of contents)
  for (let i = a + 1; i < all.length; i++) if (/^第四部分临床医案/.test(all[i].trim())) { z = i; break; }
  const lines = [];
  for (let i = a; i < z; i++) { const s = fix(all[i].trim()); if (!s || DROP.some((r) => r.test(s))) continue; lines.push(s); }
  const H1 = /^([一二三四五六七八九十士百]{1,3})[、，,.．]?\s*([\u3400-\u9fffA-Za-z（）()、，·\-\s]{2,22})$/;
  const H2 = /^[（(]([一二三四五六七八九十]+)[）)]\s*([\u3400-\u9fff、（）()]{2,16})$/;
  const recs = []; let sys = '内科', cur = null;
  const flush = () => { if (cur) { const r = buildRecord({ book: '石学敏针灸全集', sys: sysOf(cur.sys), name: cur.name, alias: '', lines: cur.lines }); r._h2 = cur.h2; recs.push(r); } cur = null; };
  for (const s of lines) {
    const sm = s.match(/^第([一二三四五六七八九十]+)节\s*(.{2,16})$/);
    if (sm && s.length < 22 && SEC2SYS(sm[2])) { flush(); sys = SEC2SYS(sm[2]); continue; }
    const hm = s.match(H1);
    if (hm && s.length <= 26 && !TAG_RE.test(s) && !SUBL_RE.test(s)) {
      const nm = hm[2].trim().replace(/\s+/g, '');
      if (!/[。，；]/.test(nm)) { flush(); cur = { sys, name: NAME_FIX[nm] || nm, lines: [], h2: [] }; continue; }
    }
    if (!cur) continue;
    const h2 = s.match(H2);
    if (h2) cur.h2.push({ at: cur.lines.length, name: h2[2] });
    cur.lines.push(s);
  }
  flush();
  return recs;
}

// =====================================================================
// 实用针灸学 下篇
// =====================================================================
function practical() {
  const all = fs.readFileSync(SP + 'shi-practical.txt', 'utf8').replace(/\r/g, '').split('\n');
  const toc = fs.readFileSync(SP + 'shi-practical.toc.txt', 'utf8').split('\n').filter(Boolean).map((l) => { const [t, p] = l.split('\t'); return { t: t.trim(), p: +p, lvl: (l.match(/^\s*/)[0].length) }; });
  const i0 = toc.findIndex((e) => /^第八章/.test(e.t));
  const items = []; let chapter = '';
  for (const e of toc.slice(i0)) {
    const c = e.t.match(/^第[八九十]+章\s*(.+)$|^第十[一二]章\s*(.+)$/);
    if (c) { chapter = (c[1] || c[2]).trim(); continue; }
    const d = e.t.match(/^([一二三四五六七八九十]+)、\s*(.+)$/);
    if (d) items.push({ chapter, num: d[1], raw: d[2].trim(), page: e.p });      // bookmark page = PDF page
  }
  const lines = [], pageOf = [];
  let curPage = 0;
  for (let i = 0; i < all.length; i++) {
    const pm = all[i].match(/^===== PAGE (\d+) =====$/);
    if (pm) { curPage = +pm[1]; continue; }
    const s = fix(all[i].trim());
    if (!s || DROP.some((r) => r.test(s))) continue;
    lines.push(s); pageOf.push(curPage);
  }
  const firstIdx = new Map(); pageOf.forEach((p, i) => { if (!firstIdx.has(p)) firstIdx.set(p, i); });
  // locate each disease heading on its bookmarked page (OCR-tolerant: match on the first two characters of the name)
  const heads = [];
  let pos = 0;
  for (const it of items) {
    const nm2 = it.raw.match(/^(.+?)[（(](.+?)[）)]?\s*$/);
    const nameOnly = (nm2 ? nm2[1] : it.raw).replace(/\s+/g, ''), alias = nm2 ? nm2[2].replace(/\s+/g, '') : '';
    const key = nameOnly.slice(0, 2);
    const lo = Math.max(pos, firstIdx.get(it.page) ?? 0);
    const inRange = (k) => k < lines.length && pageOf[k] <= it.page + 1;
    let j = -1, cut = 0;
    const CHP = /^(内科|外科|五官科|妇科|眼科)疾病、/;
    const nline = (k) => { const l = lines[k].replace(/\s+/g, ''); const m = l.match(CHP); return { l: m ? l.slice(m[0].length) : l, off: m ? m[0].length : 0 }; };
    // 0) the ordinal ("二十六、") is the one thing OCR rarely damages: a short line starting with it that shares a character with the name/alias
    for (let k = lo; inRange(k); k++) {
      const { l, off } = nline(k);
      if (!l.startsWith(it.num + '、') || l.length >= 45) continue;
      const rest = l.slice(it.num.length + 1);
      if (rest.length === 0 || l.length <= 12 || [...(nameOnly + alias)].some((ch) => rest.includes(ch))) { j = k; const close = rest.search(/[）)]/); cut = close >= 0 && close < 30 ? off + it.num.length + 1 + close + 1 : 0; break; }
    }
    // 0b) heading merged into the chapter title and the ordinal lost: "眼科疾病、近视近视是以视远不清…"
    if (j < 0) for (let k = lo; inRange(k); k++) {
      const { l, off } = nline(k);
      if (off && l.startsWith(nameOnly)) { j = k; cut = off + nameOnly.length; break; }
    }
    // 1) a line that carries the bracketed alias, e.g. "十二、痿证（截瘫）随意运动的功能…" or "外科疾病、腹胀（肠梗阻）肠梗阻是…"
    if (j < 0 && alias) for (let k = lo; inRange(k); k++) {
      const l = lines[k].replace(/\s+/g, '');
      const at = l.indexOf('（' + alias) >= 0 ? l.indexOf('（' + alias) : l.indexOf('(' + alias);
      if (at >= 0 && at < 24 && (l.includes(nameOnly) || l.slice(0, at).includes(key))) { j = k; const close = l.search(/[）)]/); cut = close >= 0 ? close + 1 : 0; break; }
    }
    // 2) numbered heading containing the name
    if (j < 0) for (let k = lo; inRange(k); k++) {
      const l = lines[k].replace(/\s+/g, '');
      if (/^[一二三四五六七八九十士]+[、.．]/.test(l) && l.length < 40 && l.replace(/^[一二三四五六七八九十士]+[、.．]/, '').includes(key)) { j = k; break; }
    }
    // 3) a short line that is (or starts with) the name
    if (j < 0) for (let k = lo; inRange(k); k++) {
      const l = lines[k].replace(/\s+/g, '').replace(/^[一二三四五六七八九十士]+[、.．]?/, '');
      if (l.length < 30 && (l.startsWith(key) || l.startsWith(nameOnly)) && !/[。，；]/.test(l)) { j = k; break; }
    }
    if (j < 0) {
      // heading lost entirely: the disease starts after the previous disease's closing paragraph (first short line ending in 。 on that page)
      j = lo;
      for (let k = lo; inRange(k); k++) { if (lines[k].endsWith('。') && lines[k].length < 32) { j = k; break; } }
      console.log('practical heading missing in OCR, started after previous paragraph:', it.raw);
    }
    heads.push({ ...it, at: j, cut }); pos = j + 1;
  }
  const recs = [];
  heads.forEach((h, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].at : lines.length;
    // strip trailing chapter headings inside the block
    const rest0 = h.cut ? lines[h.at].replace(/\s+/g, '').slice(h.cut) : '';        // text that follows a bracket-alias heading on the same line
    const blk = [...(rest0 ? [rest0] : []), ...lines.slice(h.at + 1, end)].filter((l) => !/^第[八九十]+章|^第十[一二]章/.test(l));
    const nm = h.raw.match(/^(.+?)[（(](.+?)[）)]?$/);
    const name = nm ? nm[1] : h.raw, alias = nm ? nm[2] : '';
    const sysz = SEC2SYS(h.chapter) || '内科';
    const r = buildRecord({ book: '石学敏实用针灸学', sys: sysOf(sysz), name, alias, lines: blk });
    r._chapter = h.chapter;
    recs.push(r);
  });
  return recs;
}

// ---------- run ----------
const Q = quanji(), P = practical();
console.log('quanji records', Q.length, 'with treatment', Q.filter((r) => r._hasTreat).length, ' practical records', P.length, 'with treatment', P.filter((r) => r._hasTreat).length);
console.log('quanji without treatment block:', Q.filter((r) => !r._hasTreat).map((r) => r.name.zh).join('、'));
console.log('practical without treatment block:', P.filter((r) => !r._hasTreat).map((r) => r.name.zh).join('、'));

// split 全集 records that hold several treatment blocks (e.g. 脏腑痛证 = 心脏绞痛 / 胆绞痛 / 肾绞痛) is left as one record with sections;
// records with no treatment block are dropped from the prescription bank
const all = [...Q, ...P].filter((r) => r._hasTreat);
all.forEach((r, i) => { r.id = 'sxm-rx-' + String(i + 1).padStart(3, '0'); });

// ---------- 验案举例 of the textbook ----------
const CLAB = /^(主诉|病史|现病史|既往史|查体|体格检查|印象|诊断|辨证|治则|选穴|操作|治疗经过|疗效|检查|舌脉)\s*[：:]\s*/;
const cases = [];
for (const r of P) {
  if (!r._cases.length) continue;
  const blocks = []; let cur = null;
  for (const l of r._cases) {
    const m = l.match(/^案([一二三四五六七八九十]+)\s*(.*)$/);
    if (m) { cur = { no: m[1], header: m[2], lines: [] }; blocks.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  for (const b of blocks) {
    const f = {}; let lab = null;
    for (const l of b.lines) { const m = l.match(CLAB); if (m) { lab = m[1]; f[lab] = (f[lab] ? f[lab] + ' ' : '') + l.slice(m[0].length); } else if (lab) f[lab] += l; }
    const hm = b.header.match(/^(.{1,5}?)[，,]?\s*(男|女)[，,]?\s*(\d+)\s*岁/);
    const sex = hm ? (hm[2] === '男' ? 'M' : 'F') : '', age = hm ? hm[3] : '';
    const date = (b.header.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) || []).slice(1).join('-');
    const sel = f['选穴'] || '';
    const pts = [...new Set(scan(sel).map((h) => h.name))];
    const imp = f['印象'] || f['诊断'] || '';
    const sysz = r.system.zh;
    cases.push({
      id: 'sxp-' + String(cases.length + 1).padStart(3, '0'), doctor_id: 'shixuemin', source_slug: 'shixuemin-practical', source_title: '石学敏实用针灸学',
      ref: `《石学敏实用针灸学》案${b.no} · ${sysz}·${r.name.zh}·${r.alias || r.name.zh} (石学敏)`, modality: 'acupuncture', patient: { sex, age }, date,
      title_zh: (imp.match(/中医[：:]\s*([^；;]+)/) || [, r.name.zh])[1].trim(), complaint_zh: f['主诉'] || '', pattern_zh: f['辨证'] || '', formula_zh: '', principle_zh: f['治则'] || '',
      dx_zh: imp, points: pts, outcome_zh: f['治疗经过'] || f['疗效'] || '',
      kv_zh: [['主诉', f['主诉']], ['病史', f['病史'] || f['现病史']], ['查体', f['查体'] || f['体格检查']], ['诊断印象', imp], ['辨证', f['辨证']], ['治则', f['治则']], ['选穴', sel], ['操作', f['操作']], ['治疗经过', f['治疗经过'] || f['疗效']]].filter(([, t]) => t),
      commentary_zh: '', original_passage: b.header + '\n' + b.lines.join('\n'), tags: [], _key: hm ? hm[1] + sex + age + date : '',
    });
  }
}
// drop textbook cases that are the same patient as a case in the 全集 (same name/sex/age/date)
const quanjiCases = fs.existsSync(path.join(BANK, '_data', 'cases', 'shixuemin.jsonl')) ? fs.readFileSync(path.join(BANK, '_data', 'cases', 'shixuemin.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const qk = new Set(quanjiCases.map((c) => { const h = (c.original_passage.split('\n')[0] || ''); const m = h.match(/^(.{1,5}?)[，,·]?\s*(男|女)\s*(\d+)/); const d = (h.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) || []).slice(1).join('-'); return m ? m[1] + (m[2] === '男' ? 'M' : 'F') + m[3] + d : ''; }).filter(Boolean));
const fresh = cases.filter((c) => !c._key || !qk.has(c._key));
console.log('textbook cases', cases.length, 'duplicates of 全集 cases', cases.length - fresh.length, 'kept', fresh.length);
fresh.forEach((c, i) => { c.id = 'sxp-' + String(i + 1).padStart(3, '0'); delete c._key; });

fs.mkdirSync(path.dirname(OUT_RX), { recursive: true });
fs.writeFileSync(OUT_RX, JSON.stringify(all.map((r) => { const { _hasTreat, _cases, _h2, _chapter, ...k } = r; return k; }), null, 1));
fs.writeFileSync(OUT_CASES, fresh.map((c) => JSON.stringify(c)).join('\n') + '\n');
console.log('prescriptions', all.length, 'by system:', JSON.stringify(all.reduce((a, r) => (a[r.system.zh] = (a[r.system.zh] || 0) + 1, a), {})));
console.log('records with 0 points:', all.filter((r) => !r.points.length).map((r) => r.book.slice(2, 5) + ':' + r.name.zh).join('、'));
