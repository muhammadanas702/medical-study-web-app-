# Vesalius MedStudy

A full-stack study platform for medical students (USMLE-style review), built only from authoritative public-domain and openly licensed data.

- **Question bank**: 13,006 single-best-answer questions generated from source records (MeSH, FDA pharmacologic classes, NBME lab values) plus hand-written clinical vignettes. Tutor mode (immediate explanation, per-option rationale, source link) and timed exam mode (about 90 s per question), flagging, strike-through, lab-value sheet, block review, peer % correct.
- **Performance analytics**: accuracy by system, discipline and question type, daily trend, streak, time per question.
- **Flashcards** with SM-2 spaced repetition; create cards from any concept, drug or question.
- **3D anatomy atlas**: 1,258 real segmented structures from BodyParts3D across 10 organ systems (click to identify, isolate, hide, layer opacity, deep links from concepts).
- **3D pathogen models** from NIH 3D (SARS-CoV-2, HIV, Ebola, HPV, HSV, polio, Zika, M. tuberculosis).
- **High-yield clinical diagrams** with hotspot annotations and a test-me mode.
- **Reference library**: 31,110 MeSH concepts (diseases, anatomy, viruses, bacteria, animals, drugs, procedures, equipment, psychiatry, physiology), 2,795 FDA drug labels with 112,610 NDC products and shortage records, 7,097 FDA device types, 98,403 ICD-10-CM FY2027 codes, 1,017 MedlinePlus health topics, NBME lab reference values.
- **Live research**: PubMed search with abstracts and ClinicalTrials.gov search.
- **Accounts**: register/sign in (scrypt-hashed passwords, bearer tokens). Guests can study immediately; their progress is merged into the account when they sign up.
- Notes, bookmarks, global search, light/dark theme, responsive layout.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter (hash routing), three.js |
| Backend | Node.js, Express, Zod validation |
| Databases | SQLite via better-sqlite3: `data/content.db` (read-only reference content, ~300 MB) and `data/app.db` (users, attempts, cards, notes; created automatically) |
| Data pipeline | Python 3 ETL scripts in `etl/` |

## Run locally

Requirements: Node.js 20+ (and Python 3.10+ only if you want to rebuild the data).

```bash
npm ci
npm run db:restore      # joins data/content.db.gz.part* into data/content.db (also done automatically on first start)
npm run dev             # http://localhost:5000  (API + frontend with hot reload)
```

Production build:

```bash
npm run build
npm start               # serves dist/ on PORT (default 5000)
```

The app has no external service dependencies except PubMed and ClinicalTrials.gov for the live research pages.

## Project layout

```
client/              React app (pages in client/src/pages, 3D models in client/public/models)
server/              Express API (routes.ts), content DB access (content.ts), user data (storage.ts)
shared/schema.ts     Shared Zod schemas and types
data/                content.db.gz.part* (reference database), curated_vignettes.json
etl/                 Scripts that build content.db from raw public downloads (see etl/README.md)
script/              Build and DB-restore scripts
```

## API overview

`/api/search`, `/api/concepts/:id`, `/api/tree`, `/api/drugs[/:slug]`, `/api/devices[/:code]`, `/api/icd10[/:code]`, `/api/topics[/:id]`, `/api/labs`, `/api/anatomy/parts`, `/api/models`, `/api/questions/facets`, `/api/questions/count`, `/api/quiz/build`, `/api/quiz/answer`, `/api/quiz/sessions[/:id][/finish]`, `/api/analytics`, `/api/cards[/due|/:id/review]`, `/api/bookmarks`, `/api/notes`, `/api/pubmed[/:pmid]`, `/api/trials`, `/api/auth/{register,login,logout,me}`.

## Data sources and licenses

| Data | Source | License |
|---|---|---|
| Concepts, definitions, hierarchy, pharmacologic actions | [MeSH 2026, NLM](https://www.nlm.nih.gov/mesh/meshhome.html) | Public domain, NLM terms |
| Health topics | [MedlinePlus XML](https://medlineplus.gov/xml.html) | Public domain |
| Drug labels | [openFDA drug label](https://open.fda.gov/apis/drug/label/), [DailyMed](https://dailymed.nlm.nih.gov/) | Public domain |
| Products and classes | [openFDA NDC](https://open.fda.gov/apis/drug/ndc/) | Public domain |
| Drug shortages | [openFDA drug shortages](https://open.fda.gov/apis/drug/drugshortages/) | Public domain |
| Medical devices | [openFDA device classification](https://open.fda.gov/apis/device/classification/) | Public domain |
| Diagnosis codes | [ICD-10-CM FY2027, CMS](https://www.cms.gov/medicare/coding-billing/icd-10-codes) | Public domain |
| Lab reference ranges | [NBME laboratory values](https://www.nbme.org/laboratory-values/) | © NBME, reproduced for study reference |
| 3D anatomy | [BodyParts3D, DBCLS](https://lifesciencedb.jp/bp3d/) | CC BY-SA 2.1 JP |
| 3D pathogens | [NIH 3D](https://3d.nih.gov) | Public Domain / CC BY 4.0 per model |
| Literature, trials (live) | [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/), [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/api) | Per publisher / public |

## Scope and honesty notes

- Copyrighted textbooks and commercial question banks (First Aid, Robbins, Guyton, UWorld, etc.) are not included and cannot be legally redistributed.
- Generated questions are derived mechanically from the source record shown in each explanation; distractors are filtered so none is also correct. Hand-written vignettes cite a reference but have not been reviewed by a physician panel.
- Diagrams are simplified teaching schematics.
- This is a study aid, not medical advice. Confirm prescribing details against the current label.
