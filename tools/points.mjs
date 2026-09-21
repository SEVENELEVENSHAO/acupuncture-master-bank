// Acupoint dictionary: 361 WHO points (tcm-learn seed) + extra-meridian points + old-name aliases.
// scan(text) finds point mentions by longest-match dictionary lookup (never by comma-splitting),
// so "风池、肩井" and "取风池，肩井" and "风池·肩井" all work.
import fs from 'fs';

const CSV = process.env.ACU_POINTS_CSV || 'E:\\Documents\\Claude\\tcm-learn\\data\\seed\\points\\points.csv';

function parseCsv(txt) {
  const rows = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const head = rows.shift();
const col = Object.fromEntries(head.map((h, i) => [h, i]));

export const POINTS = new Map();   // canonical zh name -> {name, code, channel, pinyin, en}
for (const r of rows) {
  POINTS.set(r[col.name_zh], {
    name: r[col.name_zh], code: r[col.code], channel: r[col.channel_id],
    pinyin: r[col.name_pinyin], en: r[col.name_en],
  });
}

// old names / abbreviations used by the source -> canonical WHO name
// bare 三里/五里 = 足三里/足五里 in the leg contexts of the 承淡安 text; 阳关 = 督脉腰阳关 (beside 命门);
// 人中 = 水沟; 含厌/和髎 = 颔厌/耳和髎 (variant writings)
const ALIAS = {
  阴陵: '阴陵泉', 阳陵: '阳陵泉', 曲泉穴: '曲泉', 环跳穴: '环跳',
  三里: '足三里', 五里: '足五里', 阳关: '腰阳关', 人中: '水沟', 含厌: '颔厌', 和髎: '耳和髎',
  // OCR variants seen in the 王居易 / 石学敏 scans
  隔俞: '膈俞', 晴明: '睛明', 擅中: '膻中', 大籽: '大椎', 肩井穴: '肩井', 揽竹: '攒竹', 赞竹: '攒竹', 鑫沟: '蠡沟', 阴郊: '阴郄', 额厌: '颔厌', 颌厌: '颔厌', 胞育: '胞肓', 膏育: '膏肓', 中皖: '中脘', 上皖: '上脘', 下皖: '下脘',
};
// collective / extra-meridian entries: no WHO code is asserted
const EXTRA = {
  八髎: { codes: ['BL31', 'BL32', 'BL33', 'BL34'], note: '上髎、次髎、中髎、下髎（两侧）' },
  四关: { codes: ['LI4', 'LR3'], note: '合谷 + 太冲' },
  印堂: {}, 太阳: {}, 四神聪: {}, 鱼腰: {}, 球后: {}, 金津: {}, 玉液: {}, 内迎香: {}, 翳明: {}, 安眠: {}, 牵正: {},
  夹脊: {}, 华佗夹脊: {}, 定喘: {}, 腰眼: {}, 十七椎: {}, 腰奇: {}, 痞根: {}, 子宫穴: {}, 二白: {}, 四缝: {}, 十宣: {},
  八邪: {}, 八风: {}, 外劳宫: {}, 落枕穴: {}, 中魁: {}, 大骨空: {}, 小骨空: {}, 鹤顶: {}, 膝眼: {}, 胆囊穴: {}, 阑尾穴: {},
  百虫窝: {}, 内踝尖: {}, 外踝尖: {}, 气端: {}, 十井: {}, 十井穴: {}, 阿是: {}, 阿是穴: {}, 天应穴: {},
  胃脘下俞: {}, 崇骨: {}, 鬼哭: {},
};
if (process.env.ACU_EXTRA_JSON && fs.existsSync(process.env.ACU_EXTRA_JSON)) {
  Object.assign(EXTRA, JSON.parse(fs.readFileSync(process.env.ACU_EXTRA_JSON, 'utf8')));
}

// name -> entry used at scan time
const DICT = new Map();
for (const [n, p] of POINTS) DICT.set(n, { name: n, codes: [p.code] });
for (const [a, canon] of Object.entries(ALIAS)) {
  const p = POINTS.get(canon);
  if (p) DICT.set(a, { name: canon, codes: [p.code] });
}
for (const [n, e] of Object.entries(EXTRA)) DICT.set(n, { name: n, codes: e.codes || [], extra: true });

const MAXLEN = Math.max(...[...DICT.keys()].map((k) => k.length));

/** returns [{name, codes, start, end}] in order of appearance, longest match first */
export function scan(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (let L = Math.min(MAXLEN, text.length - i); L >= 2; L--) {
      const e = DICT.get(text.slice(i, i + L));
      if (e) { hit = { ...e, start: i, end: i + L, raw: text.slice(i, i + L) }; break; }
    }
    if (hit) { out.push(hit); i = hit.end; } else i++;
  }
  return out;
}

export function lookup(name) { return DICT.get(name) || null; }

const BY_CODE = new Map([...POINTS.values()].map((p) => [p.code, p.name]));
/** any way a source may write a point (Chinese name, alias, WHO code like "LU7"/"LV3"/"BL 23") -> canonical Chinese name, else the input */
export function normPoint(x) {
  const s = String(x).trim();
  const d = DICT.get(s);
  if (d) return d.name;
  const m = s.match(/^([A-Za-z]{2})\s*-?\s*(\d+)$/);
  if (m) {
    let c = m[1].toUpperCase();
    if (c === 'LV') c = 'LR'; else if (c === 'SJ') c = 'TE'; else if (c === 'CO') c = 'CV';
    const n = BY_CODE.get(c + m[2]);
    if (n) return n;
  }
  return s;
}
export function dictSize() { return DICT.size; }
export { DICT };
