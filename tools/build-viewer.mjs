#!/usr/bin/env node
// Build <BANK>/viewer.html — one self-contained page for the Acupuncture Master Bank.
//   node build-viewer.mjs [--out <file>] [--artifact <file>]
// Env: ACU_BANK (bank root), ACU_POINTS_CSV (points.csv)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scan, POINTS, normPoint } from './points.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BANK = process.env.ACU_BANK || 'E:\\Documents\\Obsidian\\TCM Vault\\Acupuncture Bank';
const DATA = path.join(BANK, '_data');
const argv = process.argv;
const arg = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
const OUT = arg('--out') || path.join(BANK, 'viewer.html');

const readJson = (p, dflt) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : dflt);
const doctors = readJson(path.join(DATA, 'doctors.json'), []);
if (!doctors.length) { console.error('no doctors.json in ' + DATA); process.exit(1); }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ---- point-aware rich text: escape, **bold**, markdown tables, and clickable point chips ----
function linkify(raw) {
  let out = '', last = 0;
  for (const h of scan(raw)) {
    out += esc(raw.slice(last, h.start)) + '<button class="pt' + (h.extra ? ' ex' : '') + '" data-point="' + esc(h.name) + '">' + esc(h.raw) + '</button>';
    last = h.end;
  }
  return (out + esc(raw.slice(last))).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function linkifyKeepTags(raw) {
  // bold markers wrap arbitrary text; do bold split first so chips are not broken by ** boundaries
  return raw.split(/(\*\*[^*]+\*\*)/).map((seg) => {
    const m = seg.match(/^\*\*([^*]+)\*\*$/);
    return m ? '<strong>' + linkify(m[1]) + '</strong>' : linkify(seg);
  }).join('');
}
function richHTML(text) {
  const blocks = String(text || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    if (/^\|/.test(b)) {
      const rows = b.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*[-:| ]+\|?\s*$/.test(l))
        .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      if (!rows.length) return '';
      const [head, ...body] = rows;
      return '<div class="tbl-wrap" style="margin:6px 0"><table class="tbl"><thead><tr>' + head.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>'
        + body.map((r) => '<tr>' + r.map((c) => '<td>' + linkifyKeepTags(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    }
    return '<p>' + linkifyKeepTags(b).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

// ---- prescriptions ----
const rx = [];
for (const d of doctors) {
  const p = path.join(DATA, 'prescriptions', d.id + '.json');
  for (const r of readJson(p, [])) {
    const extra_html = {};
    for (const [k, v] of Object.entries(r.extra || {})) extra_html[k] = richHTML(v);
    const { rx_zh, care_zh, prognosis_zh, extra, ...keep } = r;
    rx.push({ ...keep, doctor: r.doctor || d.id, rx_html: richHTML(rx_zh), care_html: care_zh ? richHTML(care_zh) : '', prog_html: prognosis_zh ? richHTML(prognosis_zh) : '', extra_html,
      hay: [rx_zh, care_zh, prognosis_zh, ...Object.values(extra || {})].join(' ') });
  }
}

// ---- guides ----
const guides = [];
for (const d of doctors) {
  const dir = path.join(DATA, 'thought', d.id);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    try { const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); g.doctor = g.doctor || d.id; guides.push(g); }
    catch (e) { console.error('BAD JSON', f, e.message); }
  }
}

// ---- cases (same shape as the Case Bank) ----
function parseRef(ref) {
  const out = { book: '', caseNo: '', dept: '', category: '', disease: '', doctor: '' };
  if (!ref) return out;
  const bookM = ref.match(/^《([^》]*)》\s*(?:案|病例)?\s*([0-9a-z一二三四五六七八九十]+)?/);
  if (bookM) { out.book = bookM[1]; out.caseNo = bookM[2] || ''; }
  let rest = ref.replace(/^《[^》]*》\s*(?:案|病例)?\s*[0-9a-z一二三四五六七八九十]*\s*·?\s*/, '');
  const docs = []; let m;
  while ((m = rest.match(/\s*\(([^()]+)\)\s*$/))) { docs.unshift(m[1].trim()); rest = rest.slice(0, m.index).trimEnd(); }
  out.doctor = docs.length ? docs[0] : '';
  rest = rest.replace(/\s+—\s.*$/, '');
  const parts = rest.split('·').map((s) => s.trim()).filter(Boolean);
  out.dept = parts[0] || ''; out.category = parts[1] || '';
  out.disease = (parts.slice(2).join('·') || parts[1] || '').replace(/\s+—\s.*$/, '');
  return out;
}
const MOD_LABEL = { herbal: 'Herbal', acupuncture: 'Acupuncture', moxa: 'Moxa', tuina: 'Tuina', 'gua-sha': 'Gua sha', cupping: 'Cupping', mixed: 'Mixed', other: 'Other' };
const cases = [];
const caseDir = path.join(DATA, 'cases');
const caseFiles = (d) => (fs.existsSync(caseDir) ? fs.readdirSync(caseDir).filter((f) => f === d.id + '.jsonl' || (f.startsWith(d.id + '.') && f.endsWith('.jsonl'))).sort() : []);
for (const d of doctors) {
  for (const cf of caseFiles(d)) {
  const p = path.join(caseDir, cf);
  for (const line of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line); const pr = parseRef(r.ref);
    const cjk = /^[㐀-鿿]/.test(pr.disease);
    const pts = Array.isArray(r.points) ? r.points : [];
    cases.push({
      title_zh: r.title_zh || '', complaint_zh: r.complaint_zh || '', principle_zh: r.principle_zh || '', dx_zh: r.dx_zh || '', channels_zh: r.channels_zh || '',
      outcome_zh: r.outcome_zh || '', kv_zh: Array.isArray(r.kv_zh) ? r.kv_zh : [], commentary_zh: r.commentary_zh || '', date: r.date || '',
      sex: (r.patient && r.patient.sex) || '', age: (r.patient && r.patient.age) || '',
      id: r.id, doctor: d.id, doctorName: pr.doctor, src: r.source_title || r.source_slug || '', caseNo: pr.caseNo, dept: pr.dept, category: pr.category, disease: pr.disease,
      diseaseZh: cjk ? (pr.disease.replace(/\s+[A-Za-z(].*$/, '').trim() || pr.disease) : pr.disease,
      diseaseEn: cjk ? (pr.disease.match(/\s+([A-Za-z(].*)$/) || ['', ''])[1].trim() : '',
      ref: r.ref || '', modality: r.modality || 'other', modLabel: MOD_LABEL[r.modality] || r.modality || '',
      complaint: r.complaint_en || '', pattern_en: r.pattern_en || '', pattern_zh: r.pattern_zh || '', dx_en: r.dx_en || '', formula_en: r.formula_en || '', formula_zh: r.formula_zh || '',
      herbs_zh: r.herbs_zh || '', points: pts, ptsN: pts.map(normPoint),
      outcome_en: r.outcome_en || '', followup_en: r.followup_en || '', summary_en: r.summary_en || '', passage: r.original_passage || '', tags: Array.isArray(r.tags) ? r.tags : [],
    });
  }
  }
}

// ---- points table (361 WHO + extras used) ----
const points = {};
for (const [n, p] of POINTS) points[n] = { code: p.code, channel: p.channel, pinyin: p.pinyin, en: p.en };

const meta = { generated: new Date().toISOString().slice(0, 10) };
const db = { meta, doctors, guides, cases, rx, points };
const json = JSON.stringify(db).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const css = fs.readFileSync(path.join(HERE, 'viewer', 'viewer.css'), 'utf8');
const js = fs.readFileSync(path.join(HERE, 'viewer', 'viewer.js'), 'utf8');
const tpl = fs.readFileSync(path.join(HERE, 'viewer', 'template.html'), 'utf8');
const html = tpl.replace('/*CSS*/', () => css).replace('/*JS*/', () => js).replace('/*DATA*/', () => json);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`viewer -> ${OUT}  (${doctors.length} doctors, ${guides.length} guides, ${cases.length} cases, ${rx.length} prescriptions, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);

// --artifact <path>: page body only, for claude.ai Artifacts (publisher supplies doctype/html/head/body)
const art = arg('--artifact');
if (art) {
  const a = html.replace(/^<!doctype html>\n<html[^>]*>\n<head>\n<meta charset="utf-8" \/>\n<meta name="viewport"[^\n]*\n/, '')
    .replace('<title>针灸医家库 Acupuncture Bank</title>', '<title>针灸医家库 Acupuncture Bank</title>')
    .replace('</head>\n<body>\n', '').replace(/<\/body>\n<\/html>\n$/, '');
  fs.writeFileSync(art, a);
  console.log('artifact -> ' + art + '  (' + (Buffer.byteLength(a) / 1024).toFixed(0) + ' KB)');
}
