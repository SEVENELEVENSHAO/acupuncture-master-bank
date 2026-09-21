// Parse the raw OCR chunks of 承淡安针灸处方集 (chapters 6-11) into disease entries with verbatim Chinese sections.
// exported: parseRaw() -> [{chapter, section, heading, name, alias, parts:{处方,调护,预后,...}}]
import fs from 'fs';

const CH = 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\claude\\E--Documents-Claude\\0faa0715-47f3-48fc-b0c7-0a237bc61803\\scratchpad\\chengdanan\\chunks\\';
const FILES = ['G9_book2_gyn_peds_endocrine_metabolic_p276-284.txt', 'G10_book2_ent_infectious_p285-295.txt'];

const FOOT = [
  /^\d{1,3}$/, /承淡安针灸精华\s*承淡安针灸处方集/, /^第[一二三四五六七八九十]+章\s*.{2,8}·?\s*\d*$/, /^=+ PAGE \d+ =+$/, /^[·\s]*\d+\s*$/,
  /^[一-鿿\s]{2,12}·\s*\d{0,3}$/,          // running head like "第九章 新陈代谢病·"
];
const CHAPTER_RE = /^第([六七八九十]|十一)章\s*(.+)$/;
const SECTION_RE = /^第([一二三四五六七八九十]+)节\s*(.+)$/;

export function cleanLines(txt) {
  // 醪/髅 -> 髎 and digit+"??" -> digit+"%" are systematic OCR losses in this scan
  return txt.replace(/\r/g, '').replace(/醪|髅/g, '髎').replace(/(\d)\?\?/g, '$1%').split('\n').map((s) => s.trim());
}

export function parseRaw() {
  const entries = [];
  let chapter = '', section = '';
  for (const f of FILES) {
    const lines = cleanLines(fs.readFileSync(CH + f, 'utf8'));
    let cur = null, tag = null;
    const push = () => { if (cur) entries.push(cur); cur = null; tag = null; };
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (!L) continue;
      const compact = L.replace(/\s+/g, '');
      if (/^第[一二三四五六七八九十]+章.*·/.test(compact)) continue;          // running page header, not a chapter title
      const cm = compact.match(CHAPTER_RE);
      if (cm && compact.length < 14) { push(); chapter = cm[2]; section = ''; continue; }
      const sm = compact.match(SECTION_RE);
      if (sm && compact.length < 22) { push(); section = sm[2]; continue; }
      if (/^附[：:]\s*备查药方/.test(compact)) { push(); return entries; }   // herbal appendix: separate note
      if (FOOT.some((r) => r.test(L)) && !L.startsWith('【')) continue;
      // heading = a line followed by a 【处方】 line (or an "附：X" heading before its own 【处方】)
      let j = i + 1; while (j < lines.length && !lines[j]) j++;
      const nextIsRx = j < lines.length && lines[j].startsWith('【处方】');
      if (!L.startsWith('【') && nextIsRx && L.length < 40) {
        push();
        const alias = (L.match(/[（(]([^）)]*)[）)]?\s*$/) || [, ''])[1];
        cur = { chapter, section, heading: L, name: L.replace(/[（(].*$/, '').trim(), alias, parts: {} };
        tag = null; continue;
      }
      if (!cur) continue;
      const tm = L.match(/^【([^】]+)】(.*)$/);
      if (tm) { tag = tm[1]; cur.parts[tag] = (cur.parts[tag] || []); if (tm[2].trim()) cur.parts[tag].push(tm[2].trim()); continue; }
      if (tag) cur.parts[tag].push(L);
    }
    push();
  }
  return entries;
}

// Join wrapped physical lines into paragraphs: a line that ends a sentence and is clearly short ends the paragraph;
// numbered/lettered set headings start a new one.
export function paragraphs(lines) {
  const out = [];
  let buf = '';
  const startsNew = (l) => /^[（(]\s*[一二三四五六七八九十0-9]+\s*[）)]/.test(l) || /^[0-9一二三四五六七八九十]+[.、]/.test(l) || /^取穴[：:]/.test(l) || /^又[：:]/.test(l);
  for (const l of lines) {
    if (buf && (startsNew(l) || (/[。：:；]$/.test(buf) && buf.length - (buf.lastIndexOf('\n') + 1) < 26 && false))) { out.push(buf); buf = ''; }
    buf += l;
    // physical lines are ~32-35 chars; a shorter line that ends a sentence is a paragraph end
    if (/[。]$/.test(l) && l.length < 27) { out.push(buf); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('raw-entries.mjs')) {
  const e = parseRaw();
  console.log('entries:', e.length);
  const by = {}; for (const x of e) by[x.chapter] = (by[x.chapter] || 0) + 1;
  console.log(by);
  for (const x of e) console.log(x.chapter + '/' + x.section + ' | ' + x.heading + ' | tags=' + Object.keys(x.parts).join(','));
}
