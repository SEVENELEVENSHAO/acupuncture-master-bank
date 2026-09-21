'use strict';
const DB = JSON.parse(document.getElementById('db').textContent);
const DOCS = DB.doctors, GUIDES = DB.guides, CASES = DB.cases, RX = DB.rx, PTS = DB.points, META = DB.meta;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');

let LANG = 'zh';
try { const s = localStorage.getItem('acu-bank-lang'); if (s === 'en' || s === 'zh') LANG = s; } catch (e) {}

const T = {
  en: {
    brandSub: 'ACUPUNCTURE MASTER BANK', doctor: 'DOCTOR', module: 'MODULE', allDocs: 'All doctors', pending: 'sources pending',
    mThought: 'Thought', mThoughtZh: '学术思想', mCases: 'Cases', mCasesZh: '医案', mRx: 'Prescriptions', mRxZh: '处方库', mPts: 'Points', mPtsZh: '腧穴索引',
    search: 'Search…', all: 'All', count: (n, u) => n + ' ' + u,
    uGuide: 'guides', uCase: 'cases', uRx: 'prescriptions', uPt: 'points',
    hThought: 'Academic thought & treatment principles', bThought: 'How each doctor reasons: principles, technique, point-selection habits — every guide is grounded in the doctor’s own text, with citations.',
    hCases: 'Case records', bCases: 'Verbatim source passage + structured summary, as in the Case Bank.',
    hRx: 'Prescription bank', bRx: 'Point prescriptions organised by body system, with the doctor’s own care and prognosis notes. Point names are clickable.',
    hPts: 'Point index', bPts: 'Every point that appears in the bank, with how often each doctor uses it.',
    profile: 'Doctor', sources: 'Sources', dataGroup: 'Data', statsTitle: 'Point-selection patterns', statsSub: 'Computed from the prescription bank',
    takeaways: 'Key ideas', evidence: 'Evidence from the text', howTo: 'How to use this', caveats: 'Caveats', summary: 'In brief', relatedPts: 'Points mentioned', relatedRx: 'Prescriptions this draws on', relatedCases: 'Illustrative cases',
    nTake: (n) => n + ' key ideas', nTbl: (n) => n + ' tables',
    noGuides: 'No guides for this selection yet.', noCasesDoc: 'No case records for this doctor yet.', noRxDoc: 'No prescriptions for this doctor yet.',
    noMatch: 'Nothing matches.', method: 'Technique', indication: 'Acupuncture indication', indAll: 'Any', indNo: 'Not indicated', indCond: 'Conditional',
    flagNo: 'The source says this condition is NOT indicated for acupuncture', flagCond: 'The source limits acupuncture to certain causes/stages',
    rxText: 'Prescription (处方)', care: 'Care (调护)', prog: 'Prognosis (预后)', sets: 'Point sets', src: 'Source', note: 'Editorial note',
    random: 'Random', pointFilter: 'Point', filterRx: 'Show prescriptions with this point', filterCases: 'Show cases with this point', back: 'Back',
    usedIn: 'Prescriptions using this point', usedInCases: 'Cases using this point', pairs: 'Most often needled together with',
    extraPt: 'Extra-meridian / collective point (no WHO code asserted)', showAll: 'Include unused points', channel: 'Channel',
    genNote: (g) => 'Generated ' + g + '. Read-only; rebuild with build-viewer.mjs.', sourceZh: 'Source text is Chinese; tap a point name for code, pinyin and English.',
    kTop: 'Most-used points', kSys: 'By body system', kPairs: 'Frequent pairs (within one point set)', kTech: 'Technique tags by system',
    rxN: 'prescriptions', withPts: 'with point lists', avgPts: 'avg points / set', distinct: 'distinct points', noAcu: 'not indicated', sysCol: 'System', nCol: 'n', topCol: 'Top points',
    complaint: 'Complaint', passage: 'Original passage · 原文', tags: 'Tags', ref: 'Source ref', kDx: 'Diagnosis', kPat: 'Pattern', kFor: 'Formula', kOutcome: 'Outcome', kFollow: 'Follow-up',
    enSummary: 'English summary', dis: 'All diseases', kPoints: 'Points', book: 'Source book', derivedBadge: 'compiled from cases',
  },
  zh: {
    brandSub: '针灸医家库', doctor: '医家', module: '模块', allDocs: '全部医家', pending: '资料待补充',
    mThought: 'Thought', mThoughtZh: '学术思想', mCases: 'Cases', mCasesZh: '医案', mRx: 'Rx', mRxZh: '处方库', mPts: 'Points', mPtsZh: '腧穴索引',
    search: '搜索…', all: '全部', count: (n, u) => n + ' ' + u,
    uGuide: '篇导读', uCase: '条医案', uRx: '首处方', uPt: '个腧穴',
    hThought: '学术思想与治疗原则', bThought: '每位医家的思路：治疗原则、刺灸法、取穴习惯——全部据医家原著提炼，并附原文依据。',
    hCases: '医案', bCases: '逐条保留原书原文 + 结构化提要，体例同医案库。',
    hRx: '处方库', bRx: '按系统编排的针灸处方，附医家原有的调护与预后。点击腧穴名可查看穴位详情。',
    hPts: '腧穴索引', bPts: '库中出现的全部腧穴，以及各医家的使用频次。',
    profile: '医家', sources: '资料来源', dataGroup: '数据', statsTitle: '取穴规律看板', statsSub: '据处方库统计',
    takeaways: '要点', evidence: '原文依据', howTo: '学习要点', caveats: '注意', summary: '一句话', relatedPts: '涉及腧穴', relatedRx: '相关处方', relatedCases: '相关医案',
    nTake: (n) => n + ' 条要点', nTbl: (n) => n + ' 张表',
    noGuides: '这一选择下暂无导读。', noCasesDoc: '该医家暂无医案。', noRxDoc: '该医家暂无处方。',
    noMatch: '未找到匹配项。', method: '刺灸法', indication: '针灸适应', indAll: '不限', indNo: '非适应证', indCond: '有条件适用',
    flagNo: '原书明确：本病不属针灸适应证', flagCond: '原书限定：仅部分病因／阶段可用针灸',
    rxText: '处方', care: '调护', prog: '预后', sets: '取穴组', src: '出处', note: '编者按',
    random: '随机', pointFilter: '腧穴', filterRx: '在处方库中筛选此穴', filterCases: '在医案中筛选此穴', back: '返回',
    usedIn: '用到此穴的处方', usedInCases: '用到此穴的医案', pairs: '常与之同用',
    extraPt: '奇穴／合称（不标 WHO 编码）', showAll: '含未用到的腧穴', channel: '经脉',
    genNote: (g) => '生成于 ' + g + '，只读视图；重跑 build-viewer.mjs 可刷新。', sourceZh: '点击腧穴名可查看编码、拼音与英文名。',
    kTop: '最常用腧穴', kSys: '分系统用穴', kPairs: '常见搭配（同一取穴组内）', kTech: '各系统刺灸法标签',
    rxN: '首处方', withPts: '含取穴', avgPts: '每组平均穴数', distinct: '不同腧穴', noAcu: '非适应证', sysCol: '系统', nCol: '数', topCol: '常用穴',
    complaint: '主诉', passage: '原文', tags: '标签', ref: '出处', kDx: '诊断', kPat: '证型', kFor: '主方', kOutcome: '转归', kFollow: '复诊',
    enSummary: '英文提要', dis: '全部病种', kPoints: '腧穴', book: '出处', derivedBadge: '据医案汇编',
  },
};
const t = (k) => (T[LANG][k] !== undefined ? T[LANG][k] : T.en[k]);
const L = (x) => (x == null ? '' : typeof x === 'string' ? x : x[LANG] || x.zh || x.en || '');
const LO = (x) => (x == null || typeof x === 'string' ? '' : LANG === 'zh' ? x.en || '' : x.zh || '');   // the other language

const CHAN = {
  LU: ['手太阴肺经', 'Lung'], LI: ['手阳明大肠经', 'Large Intestine'], ST: ['足阳明胃经', 'Stomach'], SP: ['足太阴脾经', 'Spleen'],
  HT: ['手少阴心经', 'Heart'], SI: ['手太阳小肠经', 'Small Intestine'], BL: ['足太阳膀胱经', 'Bladder'], KI: ['足少阴肾经', 'Kidney'],
  PC: ['手厥阴心包经', 'Pericardium'], TE: ['手少阳三焦经', 'Triple Energizer'], GB: ['足少阳胆经', 'Gallbladder'], LR: ['足厥阴肝经', 'Liver'],
  CV: ['任脉', 'Conception Vessel'], GV: ['督脉', 'Governing Vessel'], EX: ['奇穴 / 合称', 'Extra & collective'],
};
const CHAN_ORDER = Object.keys(CHAN);
const chanName = (c) => (LANG === 'zh' ? CHAN[c][0] : CHAN[c][1]);
const MOD_ZH = { herbal: '中药', acupuncture: '针刺', moxa: '艾灸', tuina: '推拿', 'gua-sha': '刮痧', cupping: '拔罐', mixed: '综合', other: '其他' };

const state = {
  doc: '__all', mod: 'thought', q: '', gGroup: '__all',
  dept: '__all', cat: '__all', dis: '__all', cmod: '__all',
  sys: '__all', sec: '__all', tag: '__all', ind: '__all', book: '__all',
  point: '__all', chan: '__all', showAll: false, open: {},
};
const inDoc = (d) => state.doc === '__all' || d.doctor === state.doc;
const doc = (id) => DOCS.find((d) => d.id === id);
const docName = (id) => { const d = doc(id); return d ? L(d.name) : id; };
const tone = (i) => 't-' + (Math.max(0, i) % 7);

// ---- point usage index ----
const USE = new Map();   // name -> {rx:[rec], cases:[rec]}
const useOf = (n) => { if (!USE.has(n)) USE.set(n, { rx: [], cases: [] }); return USE.get(n); };
for (const r of RX) for (const p of r.points) useOf(p).rx.push(r);
for (const c of CASES) for (const p of c.ptsN || []) useOf(p).cases.push(c);
const ptInfo = (n) => PTS[n] || null;

// ---------- sidebar ----------
function counts() {
  return {
    thought: GUIDES.filter(inDoc).length + (RX.filter(inDoc).length ? 1 : 0),
    cases: CASES.filter(inDoc).length,
    rx: RX.filter(inDoc).length,
    pts: [...USE.entries()].filter(([, u]) => u.rx.some(inDoc) || u.cases.some(inDoc)).length,
  };
}

function renderSidebar() {
  const c = counts();
  const docBtns = DOCS.map((d) =>
    '<button class="side-btn ' + (state.doc === d.id ? 'active ' : '') + (d.pending ? 'off' : '') + '" ' + (d.pending ? '' : 'data-act="doc" data-v="' + esc(d.id) + '"') + '>'
    + '<span><b>' + esc(L(d.name)) + '</b><small>' + esc(d.pending ? t('pending') : d.years || '') + '</small></span>'
    + (d.pending ? '' : '<span class="n">' + (GUIDES.filter((g) => g.doctor === d.id).length + RX.filter((r) => r.doctor === d.id).length + CASES.filter((x) => x.doctor === d.id).length) + '</span>') + '</button>').join('');
  const mods = [['thought', 'mThought', 'mThoughtZh', c.thought], ['cases', 'mCases', 'mCasesZh', c.cases], ['rx', 'mRx', 'mRxZh', c.rx], ['pts', 'mPts', 'mPtsZh', c.pts]]
    .map(([k, en, zh, n]) => '<button class="mod-btn ' + (state.mod === k ? 'active' : '') + '" data-act="mod" data-v="' + k + '">'
      + esc(LANG === 'zh' ? t(zh) : t(en)) + '<i>' + n + '</i></button>').join('');
  let tree = '';
  if (state.mod === 'thought') tree = thoughtTree();
  else if (state.mod === 'cases') tree = casesTree();
  else if (state.mod === 'rx') tree = rxTree();
  else tree = ptsTree();
  $('#sidebar').innerHTML =
    '<div class="brand"><div class="brand-mark">&#38024;</div><div><strong>' + (LANG === 'zh' ? '针灸医家库' : 'ACUPUNCTURE BANK') + '</strong><span>' + esc(t('brandSub')) + '</span></div></div>'
    + '<div class="side-h">' + esc(t('doctor')) + '</div>'
    + '<button class="side-btn ' + (state.doc === '__all' ? 'active' : '') + '" data-act="doc" data-v="__all"><b>' + esc(t('allDocs')) + '</b></button>' + docBtns
    + '<div class="side-h">' + esc(t('module')) + '</div><div class="mod-row">' + mods + '</div>'
    + tree + '<div class="side-note">' + esc(t('genNote')(META.generated)) + '</div>';
}

function thoughtTree() {
  const g = groupsOf(GUIDES.filter(inDoc));
  const hasRx = RX.filter(inDoc).length > 0;
  const rows = g.map((x) => '<button class="side-btn ' + (state.gGroup === x.key ? 'active' : '') + '" data-act="ggroup" data-v="' + esc(x.key) + '"><b>' + esc(x.label) + '</b><span class="n">' + x.items.length + '</span></button>').join('')
    + (hasRx ? '<button class="side-btn ' + (state.gGroup === '__data' ? 'active' : '') + '" data-act="ggroup" data-v="__data"><b>' + esc(t('dataGroup')) + '</b><span class="n">1</span></button>' : '');
  return '<div class="side-h">' + esc(t('mThoughtZh') === '学术思想' && LANG === 'zh' ? '主题' : 'TOPIC') + '</div>'
    + '<button class="side-btn ' + (state.gGroup === '__all' ? 'active' : '') + '" data-act="ggroup" data-v="__all"><b>' + esc(t('all')) + '</b></button>' + rows;
}
function groupsOf(list) {
  const m = new Map();
  for (const g of list) {
    const key = g.group ? g.group.zh : '';
    if (!m.has(key)) m.set(key, { key, label: L(g.group), order: g.order || 99, items: [] });
    const e = m.get(key); e.items.push(g); e.order = Math.min(e.order, g.order || 99);
  }
  return [...m.values()].sort((a, b) => a.order - b.order);
}

function tree2(items, getA, getB, stA, stB, act) {
  // generic two-level tree: returns [{name,count,subs:[{name,count}]}] keeping first-seen order
  const A = new Map();
  for (const it of items) {
    const a = getA(it); if (!a) continue;
    if (!A.has(a.key)) A.set(a.key, { key: a.key, label: a.label, n: 0, subs: new Map() });
    const e = A.get(a.key); e.n++;
    const b = getB(it);
    if (b) e.subs.set(b.key, { key: b.key, label: b.label, n: (e.subs.get(b.key) || { n: 0 }).n + 1 });
  }
  return [...A.values()];
}

function casesTree() {
  const T2 = tree2(CASES.filter(inDoc), (c) => c.dept && { key: c.dept, label: c.dept }, (c) => ({ key: c.category || 'Other', label: c.category || 'Other' }));
  if (!T2.length) return '';
  const rows = T2.map((g, gi) => {
    const open = state.open['c' + g.key] || state.dept === g.key;
    const cats = [...g.subs.values()].map((s) => '<button class="cat-btn ' + (state.dept === g.key && state.cat === s.key ? 'active' : '') + '" data-act="ccat" data-dept="' + esc(g.key) + '" data-v="' + esc(s.key) + '"><b>' + esc(s.label) + '</b><span class="n">' + s.n + '</span></button>').join('');
    return '<div class="dept-group ' + (open ? 'is-open' : '') + ' tone-' + (gi % 7) + '"><button class="dept-head ' + (state.dept === g.key && state.cat === '__all' ? 'active' : '') + '" data-act="cdept" data-v="' + esc(g.key) + '">'
      + '<span class="dept-toggle" data-act="toggle" data-v="c' + esc(g.key) + '">&#8250;</span><b>' + esc(g.label) + '</b><span class="n">' + g.n + '</span></button>' + (open ? '<div class="cat-list">' + cats + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="side-h">' + (LANG === 'zh' ? '科别 / 病类' : 'DEPARTMENT / CATEGORY') + '</div>' + rows;
}

function rxTree() {
  const list = RX.filter(inDoc);
  const T2 = tree2(list, (r) => ({ key: r.system.zh, label: L(r.system) }), (r) => r.section && { key: r.section.zh, label: L(r.section) });
  if (!T2.length) return '';
  const rows = T2.map((g, gi) => {
    const open = state.open['r' + g.key] || state.sys === g.key;
    const subs = [...g.subs.values()].map((s) => '<button class="cat-btn ' + (state.sys === g.key && state.sec === s.key ? 'active' : '') + '" data-act="rsec" data-sys="' + esc(g.key) + '" data-v="' + esc(s.key) + '"><b>' + esc(s.label) + '</b><span class="n">' + s.n + '</span></button>').join('');
    return '<div class="dept-group ' + (open ? 'is-open' : '') + ' tone-' + (gi % 7) + '"><button class="dept-head ' + (state.sys === g.key && state.sec === '__all' ? 'active' : '') + '" data-act="rsys" data-v="' + esc(g.key) + '">'
      + '<span class="dept-toggle" data-act="toggle" data-v="r' + esc(g.key) + '">&#8250;</span><b>' + esc(g.label) + '</b><span class="n">' + g.n + '</span></button>' + (open && subs ? '<div class="cat-list">' + subs + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="side-h">' + (LANG === 'zh' ? '系统 / 节' : 'SYSTEM / SECTION') + '</div>' + rows;
}

function ptsTree() {
  const rows = CHAN_ORDER.map((k) => {
    const n = ptList().filter((p) => p.chan === k).length;
    return n ? '<button class="side-btn ' + (state.chan === k ? 'active' : '') + '" data-act="chan" data-v="' + k + '"><b>' + esc(chanName(k)) + '</b><span class="n">' + n + '</span></button>' : '';
  }).join('');
  return '<div class="side-h">' + esc(t('channel').toUpperCase()) + '</div><button class="side-btn ' + (state.chan === '__all' ? 'active' : '') + '" data-act="chan" data-v="__all"><b>' + esc(t('all')) + '</b></button>' + rows;
}

// ---------- main ----------
function setHead(crumb, title, blurb) { $('#crumb').textContent = crumb; $('#title').textContent = title; $('#blurb').textContent = blurb || ''; }
function docCrumb() { return state.doc === '__all' ? (LANG === 'zh' ? '针灸医家库' : 'Acupuncture Bank') : docName(state.doc); }
function emptyBox(title, sub) { return '<div class="empty"><b>' + esc(title) + '</b>' + esc(sub || '') + '</div>'; }

function render() {
  renderSidebar();
  $('#q').placeholder = t('search');
  document.querySelectorAll('#langSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
  $('#extra').innerHTML = '';
  if (state.mod === 'thought') renderThought();
  else if (state.mod === 'cases') renderCases();
  else if (state.mod === 'rx') renderRx();
  else renderPoints();
}

function chip(label, on, attrs, cls) { return '<button class="chip ' + (cls || '') + (on ? ' on' : '') + '" ' + attrs + '>' + label + '</button>'; }
const qmatch = (hay) => !state.q.trim() || hay.toLowerCase().includes(state.q.trim().toLowerCase());

// ----- thought -----
function guideHay(g) {
  return [L(g.title), g.title && g.title.zh, g.title && g.title.en, g.summary && g.summary.zh, g.summary && g.summary.en,
    (g.takeaways || []).map((x) => (x.zh || '') + ' ' + (x.en || '')).join(' '),
    (g.sections || []).map((s) => JSON.stringify(s)).join(' ')].join(' ');
}
function renderThought() {
  setHead(docCrumb(), t('hThought'), t('bThought'));
  $('#toolbar').innerHTML = '';
  const list = GUIDES.filter(inDoc).filter((g) => (state.gGroup === '__all' || (g.group && g.group.zh === state.gGroup)) && qmatch(guideHay(g)));
  const groups = state.gGroup === '__data' ? [] : groupsOf(list);
  const showStats = RX.filter(inDoc).length > 0 && (state.gGroup === '__all' || state.gGroup === '__data') && qmatch('取穴规律 point patterns statistics 数据');
  const nStats = new Set(RX.filter(inDoc).map((r) => r.doctor)).size;
  const d = state.doc !== '__all' ? doc(state.doc) : null;
  let html = '';
  if (d && !state.q.trim() && state.gGroup === '__all') html += profileHTML(d);
  html += groups.map((g) => '<div class="catsec"><div class="catsec-h"><h2>' + esc(g.label) + '</h2><em>' + g.items.length + '</em></div><div class="grid">' + g.items.map(guideCard).join('') + '</div></div>').join('');
  if (showStats) html += '<div class="catsec"><div class="catsec-h"><h2>' + esc(t('dataGroup')) + '</h2><em>' + nStats + '</em></div><div class="grid">' + statsCard() + '</div></div>';
  $('#count').textContent = t('count')(list.length + (showStats ? nStats : 0), t('uGuide'));
  $('#grid').innerHTML = html;
  $('#empty').hidden = !!html;
  $('#empty').innerHTML = html ? '' : emptyBox(t('noGuides'));
}
function profileHTML(d) {
  const nG = GUIDES.filter((g) => g.doctor === d.id).length, nR = RX.filter((r) => r.doctor === d.id).length, nC = CASES.filter((c) => c.doctor === d.id).length;
  return '<div class="profile"><div class="seal">' + esc((L(d.name) || '').slice(0, 3)) + '</div><div><h2>' + esc(L(d.name)) + '<small>' + esc(d.years || '') + '</small></h2>'
    + '<p>' + esc(L(d.tagline)) + '</p><p>' + esc(L(d.bio)) + '</p>'
    + '<div class="src"><span class="badge mod">' + nG + ' ' + esc(t('uGuide')) + '</span><span class="badge mod">' + nC + ' ' + esc(t('uCase')) + '</span><span class="badge mod">' + nR + ' ' + esc(t('uRx')) + '</span>'
    + (d.sources || []).map((s) => '<span class="badge">' + esc(s.title) + '</span>').join('') + '</div></div></div>';
}
function guideCard(g) {
  const idx = Math.max(0, GUIDES.filter((x) => x.doctor === g.doctor).indexOf(g));
  return '<button class="card ' + tone(((g.order || 1) - 1)) + '" data-act="open" data-k="guide" data-v="' + esc(g.id) + '">'
    + '<span class="path">' + esc(L(g.group)) + '</span><span class="zh">' + esc(L(g.title)) + '</span>'
    + '<span class="cx' + (LANG === 'zh' ? ' zhtxt' : '') + '">' + esc(L(g.summary)) + '</span>'
    + '<span class="foot"><span class="badge mod">' + esc(docName(g.doctor)) + '</span><span class="badge">' + esc(t('nTake')((g.takeaways || []).length)) + '</span>'
    + ((g.tables || []).length ? '<span class="badge">' + esc(t('nTbl')(g.tables.length)) + '</span>' : '') + '</span></button>';
}
function statsCard() {
  const ids = [...new Set(RX.filter(inDoc).map((r) => r.doctor))];
  return ids.map((id) => '<button class="card t-2" data-act="open" data-k="stats" data-v="' + esc(id) + '"><span class="path">' + esc(t('dataGroup')) + '</span><span class="zh">' + esc(t('statsTitle')) + '</span>'
    + '<span class="cx' + (LANG === 'zh' ? ' zhtxt' : '') + '">' + esc(t('statsSub')) + ' · ' + RX.filter((r) => r.doctor === id).length + ' ' + esc(t('uRx')) + '</span>'
    + '<span class="foot"><span class="badge mod">' + esc(docName(id)) + '</span></span></button>').join('');
}

// ----- cases -----
function caseHay(c) {
  return [c.ref, c.doctorName, c.title_zh, c.complaint, c.complaint_zh, c.dx_en, c.dx_zh, c.pattern_en, c.pattern_zh, c.principle_zh, c.formula_en, c.formula_zh, c.herbs_zh, c.summary_en, c.outcome_en, c.outcome_zh,
    c.commentary_zh, c.passage, (c.points || []).join(' '), (c.tags || []).join(' ')].join(' ');
}
function casesFiltered() {
  return CASES.filter(inDoc).filter((c) => (state.dept === '__all' || c.dept === state.dept) && (state.cat === '__all' || (c.category || 'Other') === state.cat)
    && (state.cmod === '__all' || c.modality === state.cmod) && (state.dis === '__all' || c.diseaseZh === state.dis)
    && (state.tag === '__all' || (c.tags || []).includes(state.tag)) && (state.point === '__all' || (c.ptsN || []).includes(state.point)) && qmatch(caseHay(c)));
}
function renderCases() {
  setHead(docCrumb(), state.cat !== '__all' ? state.cat : state.dept !== '__all' ? state.dept : t('hCases'), t('bCases'));
  const all = CASES.filter(inDoc);
  if (!all.length) {
    $('#toolbar').innerHTML = ''; $('#count').textContent = ''; $('#grid').innerHTML = '';
    const d = state.doc !== '__all' ? doc(state.doc) : null;
    $('#empty').hidden = false;
    $('#empty').innerHTML = emptyBox(t('noCasesDoc'), d && d.notes && d.notes.cases ? L(d.notes.cases) : '');
    return;
  }
  const mods = [...new Set(all.map((c) => c.modality))];
  let bar = chip(t('all'), state.cmod === '__all', 'data-act="cmod" data-v="__all"')
    + mods.map((m) => chip(esc(LANG === 'zh' ? MOD_ZH[m] || m : m), state.cmod === m, 'data-act="cmod" data-v="' + esc(m) + '"')).join('')
    + chip(esc(t('random')), false, 'data-act="rnd"', 'rnd');
  if (state.point !== '__all') bar += chip(esc(t('pointFilter')) + ': ' + esc(state.point) + ' &#215;', true, 'data-act="clear" data-v="point"');
  if (state.tag !== '__all') bar += chip('# ' + esc(state.tag) + ' &#215;', true, 'data-act="clear" data-v="tag"');
  $('#toolbar').innerHTML = bar;
  const list = casesFiltered();
  const pool = all.filter((c) => (state.dept === '__all' || c.dept === state.dept) && (state.cat === '__all' || (c.category || 'Other') === state.cat));
  const dc = new Map(); for (const c of pool) if (c.diseaseZh) dc.set(c.diseaseZh, (dc.get(c.diseaseZh) || 0) + 1);
  if (dc.size > 1 && (state.cat !== '__all')) {
    $('#extra').innerHTML = '<div class="toolbar">' + chip(esc(t('dis')), state.dis === '__all', 'data-act="cdis" data-v="__all"')
      + [...dc.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => chip('<span>' + esc(d) + '</span> <span class="cn">' + n + '</span>', state.dis === d, 'data-act="cdis" data-v="' + esc(d) + '"')).join('') + '</div>';
  }
  $('#count').textContent = t('count')(list.length, t('uCase'));
  $('#grid').innerHTML = '<div class="grid">' + list.map(caseCard).join('') + '</div>';
  $('#empty').hidden = list.length > 0; $('#empty').innerHTML = list.length ? '' : emptyBox(t('noMatch'));
}
function caseCard(c) {
  const dIdx = [...new Set(CASES.map((x) => x.dept))].indexOf(c.dept);
  const path = [c.category, c.diseaseZh].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' › ');
  const body = LANG === 'zh' ? c.complaint_zh || c.pattern_zh || c.diseaseEn || c.formula_zh || (c.complaint || '').slice(0, 24) : c.complaint || c.summary_en || c.complaint_zh || c.pattern_zh;
  const zhBody = c.complaint_zh && c.pattern_zh && LANG === 'zh' ? c.complaint_zh + ' ｜ ' + c.pattern_zh : body;
  return '<button class="card ' + tone(dIdx) + '" data-act="open" data-k="case" data-v="' + esc(c.id) + '"><span class="path">' + esc(path || c.dept) + '</span>'
    + '<span class="zh">' + esc(c.title_zh || c.formula_zh || c.diseaseZh || (c.complaint || '').slice(0, 18)) + '</span><span class="cx' + (LANG === 'zh' ? ' zhtxt' : '') + '">' + esc(zhBody) + '</span>'
    + ((c.points || []).length ? '<span class="pts">' + c.points.slice(0, 6).map((p) => '<em>' + esc(p) + '</em>').join('') + (c.points.length > 6 ? '<em class="more">+' + (c.points.length - 6) + '</em>' : '') + '</span>' : '')
    + '<span class="foot"><span class="badge mod">' + esc(LANG === 'zh' ? MOD_ZH[c.modality] || c.modLabel : c.modLabel) + '</span>' + (c.doctorName ? '<span class="badge">' + esc(c.doctorName) + '</span>' : '')
    + (c.caseNo ? '<span>&#26696;' + esc(c.caseNo) + '</span>' : '') + '</span></button>';
}

// ----- prescriptions -----
function rxHay(r) {
  return [r.name.zh, r.name.en, r.alias, r.hay, r.points.join(' '), r.codes.join(' '), r.system.zh, r.system.en, r.section ? r.section.zh + ' ' + r.section.en : '', r.method.join(' ')].join(' ');
}
function rxFiltered() {
  return RX.filter(inDoc).filter((r) => (state.sys === '__all' || r.system.zh === state.sys) && (state.sec === '__all' || (r.section && r.section.zh === state.sec))
    && (state.book === '__all' || r.book === state.book)
    && (state.tag === '__all' || r.method.includes(state.tag)) && (state.ind === '__all' || (state.ind === 'no' ? r.indication !== 'yes' : r.indication === state.ind))
    && (state.point === '__all' || r.points.includes(state.point)) && qmatch(rxHay(r)));
}
function renderRx() {
  const all = RX.filter(inDoc);
  const sysLabel = state.sys !== '__all' ? L((all.find((r) => r.system.zh === state.sys) || {}).system) : '';
  setHead(docCrumb(), state.sec !== '__all' ? state.sec : sysLabel || t('hRx'), t('bRx'));
  if (!all.length) {
    $('#toolbar').innerHTML = ''; $('#count').textContent = ''; $('#grid').innerHTML = ''; $('#empty').hidden = false;
    const dd = state.doc !== '__all' ? doc(state.doc) : null;
    $('#empty').innerHTML = emptyBox(t('noRxDoc'), dd && dd.notes && dd.notes.rx ? L(dd.notes.rx) : ''); return;
  }
  const methods = [...new Set(all.flatMap((r) => r.method))];
  const books = [...new Set(all.map((r) => r.book))];
  let bar = (books.length > 1 ? '<span class="count" style="margin:8px 6px 0 0">' + esc(t('book')) + '</span>' + chip(t('all'), state.book === '__all', 'data-act="rbook" data-v="__all"')
      + books.map((b) => chip(esc(b.replace(/^石学敏|^承淡安|^王居易/, '')), state.book === b, 'data-act="rbook" data-v="' + esc(b) + '"')).join('') + '<span style="flex-basis:100%;height:0"></span>' : '')
    + '<span class="count" style="margin:8px 6px 0 0">' + esc(t('method')) + '</span>' + chip(t('all'), state.tag === '__all', 'data-act="rtag" data-v="__all"')
    + methods.map((m) => chip(esc(m), state.tag === m, 'data-act="rtag" data-v="' + esc(m) + '"')).join('')
    + '<span class="count" style="margin:8px 6px 0 14px">' + esc(t('indication')) + '</span>'
    + chip(t('indAll'), state.ind === '__all', 'data-act="rind" data-v="__all"') + chip(t('indNo'), state.ind === 'no', 'data-act="rind" data-v="no"', 'warn')
    + chip(esc(t('random')), false, 'data-act="rnd"', 'rnd');
  if (state.point !== '__all') bar += chip(esc(t('pointFilter')) + ': ' + esc(state.point) + ' &#215;', true, 'data-act="clear" data-v="point"');
  $('#toolbar').innerHTML = bar;
  const list = rxFiltered();
  $('#count').textContent = t('count')(list.length, t('uRx'));
  const showSec = state.sys === '__all' && !state.q.trim() && state.point === '__all' && state.tag === '__all' && state.ind === '__all';
  let html;
  if (showSec) {
    const bySys = new Map(); for (const r of list) { if (!bySys.has(r.system.zh)) bySys.set(r.system.zh, []); bySys.get(r.system.zh).push(r); }
    html = [...bySys.values()].map((rs) => '<div class="catsec"><div class="catsec-h"><h2>' + esc(L(rs[0].system)) + '</h2><em>' + rs.length + '</em></div><div class="grid">' + rs.map(rxCard).join('') + '</div></div>').join('');
  } else html = '<div class="grid">' + list.map(rxCard).join('') + '</div>';
  $('#grid').innerHTML = html; $('#empty').hidden = list.length > 0; $('#empty').innerHTML = list.length ? '' : emptyBox(t('noMatch'));
}
function rxCard(r) {
  const path = [L(r.system), r.section ? L(r.section) : ''].filter(Boolean).join(' › ');
  const main = LANG === 'zh' ? r.name.zh : r.name.en || r.name.zh;
  const sub = LANG === 'zh' ? (r.alias ? '（' + r.alias + '）' : '') : r.name.zh;
  return '<button class="card ' + tone(r.system.no - 1) + '" data-act="open" data-k="rx" data-v="' + esc(r.id) + '"><span class="path">' + esc(path) + '</span>'
    + '<span class="zh">' + esc(main) + '<small>' + esc(sub) + '</small></span>'
    + (r.points.length ? '<span class="pts">' + r.points.slice(0, 8).map((p) => '<em>' + esc(p) + '</em>').join('') + (r.points.length > 8 ? '<em class="more">+' + (r.points.length - 8) + '</em>' : '') + '</span>' : '<span class="cx">' + (LANG === 'zh' ? '（无取穴处方）' : '(no point prescription)') + '</span>')
    + '<span class="foot">' + (r.derived ? '<span class="badge cond">' + esc(t('derivedBadge')) + '</span>' : '') + (r.indication === 'no' ? '<span class="badge no">' + esc(t('indNo')) + '</span>' : r.indication === 'conditional' ? '<span class="badge cond">' + esc(t('indCond')) + '</span>' : '')
    + r.method.slice(0, 3).map((m) => '<span class="badge">' + esc(m) + '</span>').join('') + '</span></button>';
}

// ----- points -----
let _ptl = null;
function ptList() {
  const out = [];
  const seen = new Set();
  for (const [name, p] of Object.entries(PTS)) {
    const u = USE.get(name) || { rx: [], cases: [] };
    out.push({ name, code: p.code, chan: p.channel, pinyin: p.pinyin, en: p.en, nrx: u.rx.filter(inDoc).length, ncase: u.cases.filter(inDoc).length }); seen.add(name);
  }
  for (const [name, u] of USE) if (!seen.has(name)) out.push({ name, code: '', chan: 'EX', pinyin: '', en: '', nrx: u.rx.filter(inDoc).length, ncase: u.cases.filter(inDoc).length });
  return out.filter((p) => state.showAll || p.nrx + p.ncase > 0);
}
function renderPoints() {
  setHead(docCrumb(), state.chan !== '__all' ? chanName(state.chan) : t('hPts'), t('bPts'));
  $('#toolbar').innerHTML = chip(esc(t('showAll')), state.showAll, 'data-act="showall"') + chip(esc(t('random')), false, 'data-act="rnd"', 'rnd');
  const num = (c) => parseInt(c.replace(/\D/g, ''), 10) || 0;
  const list = ptList().filter((p) => (state.chan === '__all' || p.chan === state.chan) && qmatch([p.name, p.code, p.pinyin, p.en].join(' ')))
    .sort((a, b) => CHAN_ORDER.indexOf(a.chan) - CHAN_ORDER.indexOf(b.chan) || num(a.code) - num(b.code) || (b.nrx + b.ncase) - (a.nrx + a.ncase));
  $('#count').textContent = t('count')(list.length, t('uPt'));
  const card = (p) => '<button class="ptcard" data-act="open" data-k="point" data-v="' + esc(p.name) + '"><span class="code">' + esc(p.code || 'EX') + '</span><span class="zh">' + esc(p.name) + '</span>'
    + '<span class="py">' + esc(LANG === 'zh' ? p.pinyin || '' : [p.pinyin, p.en].filter(Boolean).join(' · ')) + '</span>'
    + '<span class="use">' + (p.nrx ? '<em>' + esc(t('mRxZh')) + ' ' + p.nrx + '</em>' : '') + (p.ncase ? '<em>' + esc(t('mCasesZh')) + ' ' + p.ncase + '</em>' : '') + '</span></button>';
  let html;
  if (state.chan === '__all') {
    html = CHAN_ORDER.map((k) => { const ps = list.filter((p) => p.chan === k); return ps.length ? '<div class="catsec"><div class="catsec-h"><h2>' + esc(chanName(k)) + '</h2><em>' + ps.length + '</em></div><div class="ptgrid">' + ps.map(card).join('') + '</div></div>' : ''; }).join('');
  } else html = '<div class="ptgrid">' + list.map(card).join('') + '</div>';
  $('#grid').innerHTML = html; $('#empty').hidden = list.length > 0; $('#empty').innerHTML = list.length ? '' : emptyBox(t('noMatch'));
}

// ---------- sheets ----------
let stack = [];
function openSheet(kind, id, push) {
  if (push !== false) { const top = stack[stack.length - 1]; if (!top || top.k !== kind || top.v !== id) stack.push({ k: kind, v: id }); }
  renderSheet();
  $('#overlay').classList.add('open'); document.body.style.overflow = 'hidden';
  $('#overlay').scrollTop = 0;
}
function closeSheet() { $('#overlay').classList.remove('open'); document.body.style.overflow = ''; stack = []; }
function backSheet() { stack.pop(); if (stack.length) renderSheet(); else closeSheet(); }
function shell(path, title, sub, body) {
  $('#sheet').innerHTML = '<div class="sheet-top">' + (stack.length > 1 ? '<button class="x" data-act="back" title="' + esc(t('back')) + '">&#8592;</button>' : '')
    + '<div><div class="path">' + esc(path) + '</div><h2>' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div><button class="x" data-act="close">&#215;</button></div><div class="sheet-body">' + body + '</div>';
  document.querySelectorAll('#sheet .pt[data-point]').forEach((b) => { const p = ptInfo(b.dataset.point); if (p) b.title = p.code + ' · ' + p.pinyin + ' · ' + p.en; });
}
const sect = (h, body) => '<div class="sect"><h3>' + esc(h) + '</h3>' + body + '</div>';
const kvRows = (pairs) => '<dl class="kv">' + pairs.map((p) => '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>').join('') + '</dl>';
const ptChip = (p, cls) => '<button class="tag pt ' + (cls || '') + '" data-point="' + esc(p) + '">' + esc(p) + '</button>';

function renderSheet() {
  const s = stack[stack.length - 1]; if (!s) return;
  if (s.k === 'guide') return sheetGuide(s.v);
  if (s.k === 'rx') return sheetRx(s.v);
  if (s.k === 'case') return sheetCase(s.v);
  if (s.k === 'point') return sheetPoint(s.v);
  if (s.k === 'stats') return sheetStats(s.v);
}

function tableHTML(tb) {
  const cols = tb.cols || [], rows = tb.rows || [];
  return (tb.title ? '<div class="tbl-cap">' + esc(L(tb.title)) + '</div>' : '') + '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map((c) => '<th>' + esc(L(c)) + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map((r) => '<tr>' + r.map((c) => '<td>' + nl(L(c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div style="height:12px"></div>';
}
function sheetGuide(id) {
  const g = GUIDES.find((x) => x.id === id); if (!g) return;
  const take = (g.takeaways || []).map((k) => '<li>' + esc(L(k)) + ((k.cite || []).length ? '<span class="cite">' + k.cite.map((c) => '<button data-act="ev" data-v="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</span>' : '') + '</li>').join('');
  const secs = (g.sections || []).map((x) => '<div class="prose" style="margin-bottom:12px"><h4>' + esc(L(x.h)) + '</h4>' + nl(L(x.body)) + '</div>').join('');
  const ev = (g.evidence || []).map((e) => '<li id="ev-' + esc(e.id) + '"><b>' + esc(e.id) + '</b><q>' + esc(e.quote) + '</q><cite>' + esc(e.src) + '</cite></li>').join('');
  const body = (g.summary ? '<div class="sect"><div class="lead' + (LANG === 'zh' ? ' zhtext' : '') + '">' + esc(L(g.summary)) + '</div></div>' : '')
    + (take ? sect(t('takeaways'), '<ol class="take">' + take + '</ol>') : '')
    + (secs ? '<div class="sect">' + secs + '</div>' : '')
    + ((g.tables || []).length ? '<div class="sect">' + g.tables.map(tableHTML).join('') + '</div>' : '')
    + (g.how_to_use ? sect(t('howTo'), '<div class="prose">' + nl(L(g.how_to_use)) + '</div>') : '')
    + (g.caveats ? sect(t('caveats'), '<div class="note-box">' + nl(L(g.caveats)) + '</div>') : '')
    + (ev ? sect(t('evidence'), '<ul class="ev">' + ev + '</ul>') : '')
    + (g.see && (g.see.points || []).length ? sect(t('relatedPts'), '<div class="tagrow">' + g.see.points.map((p) => ptChip(p)).join('') + '</div>') : '')
    + (g.see && (g.see.cases || []).length ? sect(t('relatedCases'), '<div class="linklist">' + g.see.cases.map((id) => CASES.find((c) => c.id === id)).filter(Boolean).map((c) => '<button data-act="open" data-k="case" data-v="' + esc(c.id) + '">' + esc(c.title_zh || c.formula_zh || c.diseaseZh || c.ref) + '<span>' + esc(c.caseNo ? '案' + c.caseNo : c.diseaseZh) + '</span></button>').join('') + '</div>') : '')
    + (g.see && (g.see.rx || []).length ? sect(t('relatedRx'), '<div class="linklist">' + g.see.rx.map((id) => RX.find((r) => r.id === id)).filter(Boolean).map((r) => '<button data-act="open" data-k="rx" data-v="' + esc(r.id) + '">' + esc(LANG === 'zh' ? r.name.zh : r.name.en || r.name.zh) + '<span>' + esc(L(r.system)) + '</span></button>').join('') + '</div>') : '');
  shell(L(g.group) + ' · ' + docName(g.doctor), L(g.title), LO(g.title), body);
}

function obsidianLink(r) {
  const d = doc(r.doctor);
  if (!d || !d.obsidian || !r.notes_path) return '';
  const file = (d.obsidian.prefix || '') + r.notes_path.replace(/\.md$/, '');
  return ' &nbsp;<a href="obsidian://open?vault=' + encodeURIComponent(d.obsidian.vault) + '&file=' + encodeURIComponent(file) + '" style="color:var(--green-dark);font-weight:700">' + (LANG === 'zh' ? '在 Obsidian 中打开' : 'Open in Obsidian') + ' &#8599;</a>';
}
function sheetRx(id) {
  const r = RX.find((x) => x.id === id); if (!r) return;
  const flag = r.indication === 'no' ? '<div class="flag no">' + esc(t('flagNo')) + '</div>' : r.indication === 'conditional' ? '<div class="flag cond">' + esc(t('flagCond')) + '</div>' : '';
  const sets = r.groups.length > 1 ? sect(t('sets'), '<dl class="kv">' + r.groups.map((g, i) => '<dt>' + esc(g.label || '#' + (i + 1)) + '</dt><dd><span class="tagrow">' + g.points.map((p) => ptChip(p)).join('') + '</span></dd>').join('') + '</dl>') : '';
  const extra = Object.entries(r.extra_html || {}).map(([k, v]) => sect(k, '<div class="rx">' + v + '</div>')).join('');
  const meth = r.method.length || r.gauge.length ? sect(t('method'), '<div class="tagrow">' + r.method.map((m) => '<button class="tag" data-act="rtag2" data-v="' + esc(m) + '">' + esc(m) + '</button>').join('') + r.gauge.map((m) => '<span class="tag" style="cursor:default">' + esc(m) + '</span>').join('') + '</div>') : '';
  const body = flag + sect(t('rxText'), '<div class="rx">' + r.rx_html + '</div>') + sets
    + (r.care_html ? sect(t('care'), '<div class="rx">' + r.care_html + '</div>') : '') + (r.prog_html ? sect(t('prog'), '<div class="rx">' + r.prog_html + '</div>') : '') + extra + meth
    + (r.note ? sect(t('note'), '<div class="note-box">' + esc(r.note) + '</div>') : '')
    + sect(t('src'), '<div style="font-size:12px;color:var(--muted)">' + esc(docName(r.doctor)) + ' · 《' + esc(r.book) + '》 · ' + esc(L(r.system)) + (r.section ? ' › ' + esc(L(r.section)) : '') + '<br>' + esc(r.notes_path) + obsidianLink(r) + '</div>')
    + (LANG === 'en' ? '<div class="note-box" style="margin-top:8px">' + esc(t('sourceZh')) + '</div>' : '');
  shell(L(r.system) + (r.section ? ' › ' + L(r.section) : ''), LANG === 'zh' ? r.name.zh : r.name.en || r.name.zh, (LANG === 'zh' ? r.name.en : r.name.zh) + (r.alias ? ' · ' + r.alias : ''), body);
}

function sheetCase(id) {
  const c = CASES.find((x) => x.id === id); if (!c) return;
  const ptRow = (ps) => '<span class="tagrow">' + ps.map((p, i) => '<button class="tag pt" data-point="' + esc((c.ptsN || [])[i] || p) + '">' + esc(p) + '</button>').join('') + '</span>';
  const zh = [], en = [];
  if (c.disease) zh.push([esc(t('kDx')), '<span class="zh">' + esc(c.disease) + '</span>']);
  if (c.pattern_zh) zh.push([esc(t('kPat')), '<span class="zh">' + esc(c.pattern_zh) + '</span>']);
  if (c.formula_zh) zh.push([esc(t('kFor')), '<span class="zh">' + esc(c.formula_zh) + '</span>']);
  if (c.herbs_zh) zh.push(['药', '<span class="zh">' + esc(c.herbs_zh) + '</span>']);
  if ((c.points || []).length) zh.push(['腧穴', ptRow(c.points)]);
  if (c.dx_en) en.push([esc(t('kDx')), esc(c.dx_en)]);
  if (c.pattern_en) en.push([esc(t('kPat')), esc(c.pattern_en)]);
  if (c.formula_en) en.push([esc(t('kFor')), esc(c.formula_en)]);
  if (c.outcome_en) en.push([esc(t('kOutcome')), esc(c.outcome_en)]);
  if (c.followup_en) en.push([esc(t('kFollow')), esc(c.followup_en)]);
  const tagsHTML = (c.tags || []).length ? sect(t('tags'), '<div class="tagrow">' + c.tags.map((x) => '<button class="tag" data-act="ctag" data-v="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>') : '';
  const structured = (c.kv_zh || []).length
    ? sect(LANG === 'zh' ? '医案记录' : 'Case record (source language)', '<dl class="kv" style="grid-template-columns:78px 1fr">' + c.kv_zh.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd class="zhtext" style="font-size:15px;line-height:1.85">' + esc(v) + '</dd>').join('') + '</dl>')
      + ((c.points || []).length ? sect(t('kPoints'), ptRow(c.points)) : '')
    : '';
  const commentary = c.commentary_zh ? sect(LANG === 'zh' ? '医案解读 · 按语' : 'Commentary (source language)', '<div class="rx" style="white-space:pre-wrap;font-size:16px">' + esc(c.commentary_zh) + '</div>') : '';
  const passageBlock = structured
    ? '<details class="sect"><summary style="cursor:pointer;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--green-dark);margin-bottom:7px">' + esc(t('passage')) + '</summary><div class="rx" style="white-space:pre-wrap">' + esc(c.passage) + '</div></details>'
    : sect(t('passage'), '<div class="rx" style="white-space:pre-wrap">' + esc(c.passage) + '</div>');
  const body = (LANG === 'en' && c.complaint ? sect(t('complaint'), '<div>' + esc(c.complaint) + '</div>') : '')
    + structured + commentary + passageBlock
    + (!structured && LANG === 'zh' && zh.length ? sect('辨证要点', kvRows(zh)) : '') + (en.length ? sect(t('enSummary'), kvRows(en)) : '')
    + (!structured && LANG === 'en' && zh.length ? sect('辨证要点', kvRows(zh)) : '')
    + (c.summary_en ? sect(LANG === 'zh' ? '医案要点' : 'Note', '<div>' + esc(c.summary_en) + '</div>') : '') + tagsHTML
    + sect(t('ref'), '<div style="font-size:12px;color:var(--muted)">' + esc(c.ref) + '</div>');
  const who = [c.sex === 'M' ? '男' : c.sex === 'F' ? '女' : '', c.age ? c.age + '岁' : '', c.date].filter(Boolean).join(' ');
  shell([c.dept, c.category, c.diseaseZh].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' › '), c.title_zh || c.formula_zh || c.diseaseZh || 'Case',
    esc(c.src) + (c.caseNo ? ' · 案' + c.caseNo : '') + (c.doctorName ? ' · ' + c.doctorName : '') + (who ? ' · ' + who : '') + ' · ' + (LANG === 'zh' ? MOD_ZH[c.modality] || c.modLabel : c.modLabel), body);
  $('#sheet .sub').innerHTML = $('#sheet .sub').textContent;
}

function pairsOf(name, list) {
  const m = new Map();
  for (const r of list) for (const g of r.groups) if (g.points.includes(name)) for (const p of g.points) if (p !== name) m.set(p, (m.get(p) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
}
function sheetPoint(name) {
  const p = ptInfo(name), u = USE.get(name) || { rx: [], cases: [] };
  const rxs = u.rx.filter(inDoc), cs = u.cases.filter(inDoc);
  const kv = p ? kvRows([[esc(t('channel')), esc(chanName(p.channel)) + ' · ' + esc(p.code)], ['Pinyin', esc(p.pinyin)], ['English', esc(p.en)]])
    : '<div class="note-box">' + esc(t('extraPt')) + '</div>';
  const byDoc = (arr) => { const m = new Map(); for (const r of arr) { if (!m.has(r.doctor)) m.set(r.doctor, []); m.get(r.doctor).push(r); } return m; };
  const rxBlock = rxs.length ? sect(t('usedIn') + ' (' + rxs.length + ')', [...byDoc(rxs)].map(([d, rs]) => '<div style="margin:0 0 4px;font-weight:800;font-size:12px">' + esc(docName(d)) + ' · ' + rs.length + '</div><div class="linklist" style="margin-bottom:10px">'
    + rs.map((r) => '<button data-act="open" data-k="rx" data-v="' + esc(r.id) + '">' + esc(LANG === 'zh' ? r.name.zh : r.name.en || r.name.zh) + '<span>' + esc(L(r.system)) + '</span></button>').join('') + '</div>').join('')) : '';
  const csBlock = cs.length ? sect(t('usedInCases') + ' (' + cs.length + ')', '<div class="linklist">' + cs.map((c) => '<button data-act="open" data-k="case" data-v="' + esc(c.id) + '">' + esc(c.formula_zh || c.diseaseZh || c.ref) + '<span>' + esc(c.doctorName || docName(c.doctor)) + '</span></button>').join('') + '</div>') : '';
  const pr = pairsOf(name, rxs);
  const prBlock = pr.length ? sect(t('pairs'), '<div class="tagrow">' + pr.map(([q, n]) => '<button class="tag pt" data-point="' + esc(q) + '">' + esc(q) + ' <b>' + n + '</b></button>').join('') + '</div>') : '';
  const acts = '<div class="toolbar" style="margin:0 0 16px">' + (rxs.length ? chip(esc(t('filterRx')), false, 'data-act="ptfilter" data-v="rx" data-name="' + esc(name) + '"') : '')
    + (cs.length ? chip(esc(t('filterCases')), false, 'data-act="ptfilter" data-v="cases" data-name="' + esc(name) + '"') : '') + '</div>';
  shell(p ? chanName(p.channel) : t('mPtsZh'), name, p ? p.code + ' · ' + p.pinyin : '', acts + kv + '<div style="height:14px"></div>' + prBlock + rxBlock + csBlock);
}

function sheetStats(docId) {
  const list = RX.filter((r) => r.doctor === docId);
  const withPts = list.filter((r) => r.points.length);
  const freq = new Map(); for (const r of list) for (const p of r.points) freq.set(p, (freq.get(p) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const max = top.length ? top[0][1] : 1;
  const sets = list.flatMap((r) => r.groups);
  const avg = sets.length ? (sets.reduce((s, g) => s + g.points.length, 0) / sets.length).toFixed(1) : '0';
  const kpis = [[list.length, t('rxN')], [withPts.length, t('withPts')], [freq.size, t('distinct')], [avg, t('avgPts')], [list.filter((r) => r.indication === 'no').length, t('noAcu')]];
  const kp = '<div class="kpis">' + kpis.map(([v, l]) => '<div class="kpi"><b>' + v + '</b><span>' + esc(l) + '</span></div>').join('') + '</div>';
  const bars = top.map(([p, n]) => '<div class="bar-row"><button class="tag pt nm" data-point="' + esc(p) + '">' + esc(p) + '</button><div class="bar"><i style="width:' + Math.round(n / max * 100) + '%"></i></div><div class="v">' + n + '</div></div>').join('');
  const sysMap = new Map();
  for (const r of list) { const k = r.system.zh; if (!sysMap.has(k)) sysMap.set(k, { sys: r.system, rs: [] }); sysMap.get(k).rs.push(r); }
  const sysRows = [...sysMap.values()].map((s) => { const f = new Map(); for (const r of s.rs) for (const p of r.points) f.set(p, (f.get(p) || 0) + 1); const tp = [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return '<tr><td>' + esc(L(s.sys)) + '</td><td>' + s.rs.length + '</td><td>' + tp.map(([p, n]) => '<button class="tag pt" data-point="' + esc(p) + '">' + esc(p) + ' <b>' + n + '</b></button>').join(' ') + '</td></tr>'; }).join('');
  const pm = new Map();
  for (const g of sets) { const ps = [...new Set(g.points)].sort(); for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const k = ps[i] + '' + ps[j]; pm.set(k, (pm.get(k) || 0) + 1); } }
  const pairs = [...pm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  const pairHTML = '<div class="tagrow">' + pairs.map(([k, n]) => { const [a, b] = k.split(''); return '<span class="tag" style="cursor:default">' + esc(a) + ' + ' + esc(b) + ' <b>' + n + '</b></span>'; }).join('') + '</div>';
  const mc = new Map(); for (const r of list) for (const m of r.method) mc.set(m, (mc.get(m) || 0) + 1);
  const tm = [...mc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m]) => m);
  const techRows = [...sysMap.values()].map((s) => '<tr><td>' + esc(L(s.sys)) + '</td>' + tm.map((m) => '<td>' + (s.rs.filter((r) => r.method.includes(m)).length || '·') + '</td>').join('') + '</tr>').join('');
  const body = kp + '<div style="height:16px"></div>' + sect(t('kTop'), bars)
    + sect(t('kSys'), '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(t('sysCol')) + '</th><th>' + esc(t('nCol')) + '</th><th>' + esc(t('topCol')) + '</th></tr></thead><tbody>' + sysRows + '</tbody></table></div>')
    + sect(t('kPairs'), pairHTML)
    + sect(t('kTech'), '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(t('sysCol')) + '</th>' + tm.map((m) => '<th>' + m + '</th>').join('') + '</tr></thead><tbody>' + techRows + '</tbody></table></div>');
  shell(t('dataGroup'), t('statsTitle'), t('statsSub') + ' · ' + docName(docId), body);
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-point]'); if (!b) return;
  if (b.dataset.point && !b.dataset.act) { openSheet('point', b.dataset.point); return; }
  const a = b.dataset.act, v = b.dataset.v;
  const reset = () => { state.q = ''; $('#q').value = ''; };
  switch (a) {
    case 'doc': state.doc = v; state.gGroup = '__all'; state.dept = state.cat = state.dis = state.cmod = '__all'; state.sys = state.sec = state.tag = state.ind = state.book = '__all'; state.point = '__all'; state.chan = '__all'; render(); break;
    case 'mod': state.mod = v; state.q = ''; $('#q').value = ''; render(); break;
    case 'ggroup': state.gGroup = v; render(); closeNav(); break;
    case 'toggle': { e.stopPropagation(); const cur = state.open[v] || (v[0] === 'c' ? state.dept === v.slice(1) : state.sys === v.slice(1)); state.open[v] = !cur; renderSidebar(); break; }
    case 'cdept': state.dept = v; state.cat = '__all'; state.dis = '__all'; state.open['c' + v] = true; render(); break;
    case 'ccat': state.dept = b.dataset.dept; state.cat = v; state.dis = '__all'; render(); closeNav(); break;
    case 'cdis': state.dis = v; render(); break;
    case 'cmod': state.cmod = v; render(); break;
    case 'rsys': state.sys = v; state.sec = '__all'; state.open['r' + v] = true; render(); break;
    case 'rsec': state.sys = b.dataset.sys; state.sec = v; render(); closeNav(); break;
    case 'rtag': state.tag = v; render(); break;
    case 'rbook': state.book = v; render(); break;
    case 'rtag2': state.tag = v; state.mod = 'rx'; closeSheet(); render(); break;
    case 'rind': state.ind = v; render(); break;
    case 'ctag': state.tag = v; state.mod = 'cases'; closeSheet(); render(); break;
    case 'chan': state.chan = v; render(); closeNav(); break;
    case 'showall': state.showAll = !state.showAll; render(); break;
    case 'clear': state[v] = '__all'; render(); break;
    case 'rnd': { const l = state.mod === 'cases' ? casesFiltered() : state.mod === 'rx' ? rxFiltered() : ptList(); if (l.length) { const x = l[Math.floor(Math.random() * l.length)]; openSheet(state.mod === 'cases' ? 'case' : state.mod === 'rx' ? 'rx' : 'point', x.id || x.name); } break; }
    case 'open': openSheet(b.dataset.k, v); break;
    case 'back': backSheet(); break;
    case 'close': closeSheet(); break;
    case 'ev': { const el = document.getElementById('ev-' + v); if (el) { document.querySelectorAll('.ev li.hl').forEach((x) => x.classList.remove('hl')); el.classList.add('hl'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } break; }
    case 'ptfilter': { state.point = b.dataset.name; state.mod = v; state.sys = state.sec = '__all'; state.dept = state.cat = state.dis = '__all'; closeSheet(); render(); break; }
  }
});
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (stack.length > 1) backSheet(); else closeSheet(); } });
document.querySelectorAll('#langSwitch button').forEach((b) => b.addEventListener('click', () => {
  LANG = b.dataset.lang; try { localStorage.setItem('acu-bank-lang', LANG); } catch (e) {}
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hans' : 'en'; render(); if (stack.length) renderSheet();
}));
function closeNav() { document.querySelector('.app').classList.remove('nav-open'); }
$('#menuBtn').onclick = () => document.querySelector('.app').classList.toggle('nav-open');
$('#navBackdrop').onclick = closeNav;
let qt; $('#q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; render(); }, 130); });

document.documentElement.lang = LANG === 'zh' ? 'zh-Hans' : 'en';
render();
