# 针灸医家库 · Acupuncture Master Bank

A per-doctor bank of acupuncture knowledge with a self-contained web viewer. For each doctor it holds three things:

1. **学术思想 / Thought** – guides that summarise how the doctor reasons (principles, technique, point selection), each grounded in the doctor's own text with verbatim, cited evidence.
2. **医案 / Cases** – case records, verbatim source passage plus the book's own labelled fields.
3. **处方 / Prescriptions** – the doctor's point prescriptions, with clickable points (WHO code, pinyin, English) and a point index across doctors.

| Doctor | Sources | Content |
|---|---|---|
| 承淡安 Cheng Dan'an | 《承淡安针灸精华》, 《承淡安针灸处方集》 (1951 texts, 2016 ed.) | guides, 219 prescriptions (no cases in these books) |
| 石学敏 Shi Xuemin | 《石学敏针灸全集》(2015), 《石学敏实用针灸学》 | guides, 175 prescriptions incl. his 配方理论, ~620 cases |
| 王居易 Wang Juyi | 《王居易针灸医案讲习录》(2014) | guides, 125 cases with his 医案解读, prescriptions compiled from his recorded 选穴 |

**Live site:** https://sevenelevenshao.github.io/acupuncture-master-bank/

> **Public repository, published by request of the compiler.** The data includes verbatim passages from books still under copyright (石学敏, 王居易) alongside 承淡安's work, which entered the public domain in China in 2007 (copyright runs to death + 50 years; he died in 1957). Content is reproduced for study/scholarship. If you are a rights holder and want something removed, open an issue.

## Layout

```
bank/viewer.html      built viewer (open it directly in a browser, no server needed)
bank/_data/           doctors.json · thought/<doctor>/*.json · cases/<doctor>*.jsonl · prescriptions/<doctor>.json
tools/                extractors, parsers, checkers and the viewer source (see tools/SCHEMA.md for the data model)
data/points.csv       the 361 WHO-standard points (code, channel, Chinese/pinyin/English names)
```

## Rebuild

Requires Node 20+. The scripts default to the author's Windows paths; point them at this checkout with two environment variables:

```powershell
$env:ACU_BANK       = "D:\acupuncture-bank\bank"
$env:ACU_POINTS_CSV = "D:\acupuncture-bank\data\points.csv"
node tools\build-viewer.mjs          # -> bank\viewer.html
node tools\check-links.mjs           # every guide's point / prescription / case link resolves
node tools\check-guides.mjs <doctor> <raw-book.txt> ...   # every evidence quote is verbatim in the source text
```

The parsers (`parse-chengdanan.mjs`, `parse-shi-cases.mjs`, `parse-shi-books.mjs`, `parse-wang.mjs`) rebuild the data from the books' extracted text (PyMuPDF text layer of the OCR'd PDFs; not included).

## Adding a doctor

Register them in `bank/_data/doctors.json`, add guides / cases / prescriptions in the shapes described in `tools/SCHEMA.md`, then rebuild.

## Known limits

- Text comes from OCR; systematic errors are corrected where certain (e.g. 醪→髎, 隔俞→膈俞) and quotes in guides are checked against the raw text, but some OCR noise remains in the verbatim passages.
- Chinese is the working language. English names/summaries exist for the guides and for 承淡安's prescription titles; the newer doctors' cases and prescriptions fall back to Chinese in the English view.
- A few 《石学敏实用针灸学》 disease entries (眩晕, 腰腿痛, 肘劳, 近视, 伤风鼻塞) start slightly off because their headings were lost in OCR.
