# Acupuncture Master Bank — data model

Bank root: `E:\Documents\Obsidian\TCM Vault\Acupuncture Bank\`
Toolkit:   `E:\Documents\Claude\tools\acu-bank\`
Viewer:    `<BANK>\viewer.html` (self-contained, built by `node build-viewer.mjs`)

Three modules per doctor. A doctor is registered in `_data\doctors.json`.

```
_data/
  doctors.json                      registry (see below)
  thought/<doctor>/<guide-id>.json  academic / treatment-principle guides   (module 1)
  cases/<doctor>.jsonl              case histories, one JSON per line        (module 2)
  prescriptions/<doctor>.json       prescription bank, JSON array            (module 3)
```

All prose is bilingual `{ "zh": "...", "en": "..." }`. Chinese is the primary language
(original terminology kept); English is a faithful concise gloss, never a new claim.

## doctors.json
```json
[{ "id":"chengdanan", "name":{"zh":"承淡安","en":"Cheng Dan'an"}, "years":"1899–1957",
   "tagline":{"zh":"...","en":"..."}, "bio":{"zh":"...","en":"..."},
   "sources":[{"title":"承淡安针灸精华","kind":"thought+q&a"},{"title":"承淡安针灸处方集","kind":"prescriptions"}] }]
```

## Guide (module 1) — `thought/<doctor>/<id>.json`
Purpose: the doctor's *thinking*: how they reason, what principles they apply, why.
Must be grounded in the doctor's own text. No modern doctrine attributed to them.
```json
{
  "id": "cda-02-stimulation-theory",
  "doctor": "chengdanan",
  "group": { "zh": "针灸原理", "en": "Principles" },
  "order": 2,
  "title":   { "zh": "...", "en": "..." },
  "summary": { "zh": "<=120字 essence", "en": "<=60 words" },
  "takeaways": [ { "zh": "...", "en": "...", "cite": ["C1","C2"] } ],
  "sections":  [ { "h": {"zh":"","en":""}, "body": {"zh":"...","en":"..."} } ],
  "tables":    [ { "title":{"zh":"","en":""}, "cols":[{"zh":"","en":""}],
                   "rows":[ [ "cell string or {zh,en}", "..." ] ] } ],
  "evidence":  [ { "id":"C1", "quote":"verbatim source text, <=90 chars", "src":"针灸精华·第三篇 针科常识 p.90" } ],
  "how_to_use":{ "zh": "...", "en": "..." },
  "caveats":   { "zh": "...", "en": "..." },
  "see": { "notes": ["Obsidian note basenames"], "points": ["风池"], "rx": ["cda-rx-058"] }
}
```
`see.rx` = prescription ids (from `prescriptions/<doctor>.json`) the guide draws on; the viewer lists them
as links under the guide. `see.cases` = case ids (from `cases/<doctor>*.jsonl`, e.g. `wjy-013`, `sxm-021`) that illustrate it.
`see.points` must be canonical point names (see `points.mjs`).
- `takeaways`: 4–8 bullets, each ONE idea in the doctor's own logic; each cites >=1 evidence id.
- `evidence.quote` MUST be copied verbatim from the source text (after removing page-footer noise).
- `src` = `<book>·<chapter/section>` plus the PRINTED page if known
  (printed page = PDF page − 8 for 承淡安针灸精华/处方集 compilation; the chunk files carry PDF page markers).
- `caveats`: where the view is dated (Republican-era terminology, superseded pathology) — factual, brief.

## Case (module 2) — `cases/<doctor>.jsonl`
Same fields as the existing Case Bank (`E:\Documents\Obsidian\TCM Vault\Case Bank\_index\cases.jsonl`):
id, ref, source_slug/source_title, modality, patient{sex,age}, complaint_en, pattern_zh/en, dx_en,
formula_zh/en, herbs_zh, points[], outcome_en, followup_en, summary_en, original_passage, tags[].
`ref` format: `《书名》案N · 科·类·病 (医家)`; add `"doctor_id":"shixuemin"`.
Acupuncture cases: fill `points[]`, put technique detail in `summary_en`/`tags`.

## Prescription (module 3) — `prescriptions/<doctor>.json`
```json
{
  "id": "cda-rx-0123", "doctor": "chengdanan",
  "book": "承淡安针灸处方集", "system": "消化器病", "section": "肠疾患",
  "name": { "zh": "急性肠炎", "en": "Acute Enteritis" },
  "alias": "食泻、热泻",
  "rx_zh": "verbatim 【处方】 text (blank lines separate groups)",
  "groups": [ { "label":"(1)十二指肠炎", "points":["督俞","膈俞"], "text":"verbatim line" } ],
  "points": ["督俞","膈俞",...],          // unique, in order of first appearance
  "codes":  ["BL16","BL17",...],          // WHO codes where the name resolves to one of the 361 points
  "care_zh": "...", "prognosis_zh": "...",
  "indication": "yes | no | conditional",  // 针灸适应证: 'no' when the source says not indicated
  "method": ["强刺激","皮肤针","艾灸"],    // technique tags found in the text
  "note": "editorial/OCR note or ''", "notes_path": "vault-relative path of the .md note"
}
```
Case-bank-style "system → section → disease" tree is built from `system` + `section`.

## Adding a new doctor
1. Add to doctors.json. 2. Put guides in thought/<id>/. 3. Cases → cases/<id>.jsonl (use
`tools/case-harvest` extractors + book-bridge). 4. Prescriptions → prescriptions/<id>.json.
5. `node build-viewer.mjs`.
