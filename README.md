# Vesalius MedStudy

A full-stack study platform for medical students (USMLE-style review), built only from authoritative public-domain and openly licensed data.

- **Question bank**: 16,619 single-best-answer questions: generated from source records (MeSH, FDA pharmacologic classes, NBME lab values), hand-written clinical vignettes, and the end-of-chapter review questions of 12 OpenStax textbooks. Tutor mode (immediate explanation, per-option rationale, source link) and timed exam mode, flagging, strike-through, lab-value sheet, block review, peer % correct, "report a problem" on every question.
- **Performance analytics**: accuracy by system, discipline and question type, daily trend, streak, time per question.
- **Flashcards** with SM-2 spaced repetition; create cards from any concept, drug or question.
- **3D anatomy atlas**: all 2,234 BodyParts3D structures across 11 systems (skeletal, muscular, cardiovascular, nervous, eye & ear, respiratory, digestive, urinary, endocrine, reproductive, integumentary). Every structure shows FMA / TA98 / MeSH / UBERON / Wikidata IDs, part-of and sub-part navigation, a structure/function/clinical-significance description (Wikipedia, CC BY-SA, matched by FMA ID), linked textbook sections and figures, and practice questions. The **Organ explorer** opens any of 3,432 organs, regions and groups (heart, kidney, eyeball, brachial plexus…) and highlights all of their parts in 3D.
- **3D drug molecules**: PubChem 3D conformers for FDA-label active ingredients, with formula, weight, IUPAC name, SMILES, Lipinski properties and descriptions; shown on each drug page.
- **Pathogen library**: 52 bacteria, viruses, fungi and parasites with fact sheets (structure, transmission, virulence, disease, diagnosis, treatment, pearls), NIH 3D models where they exist, labelled colored schematic 3D models for the rest, verified RCSB PDB protein structures in an interactive molecular viewer, MeSH and Wikipedia links.
- **3D medical devices and lab equipment**: 17 labelled schematic models (stethoscope, syringe, IV cannula, Foley, BP cuff, pulse oximeter, otoscope, tuning fork, scalpel, chest tube, ETT, laryngoscope, blood tubes, microscope, centrifuge, micropipette, Petri dish) plus open-hardware models from NIH 3D.
- **Drug images**: about 21,000 product, package-label and structure images from DailyMed on drug pages.
- **Open textbooks**: 12 complete OpenStax books (Anatomy & Physiology 2e, Biology 2e, Microbiology, Chemistry 2e, Organic Chemistry, Pharmacology for Nurses, Psychology 2e, Behavioral Neuroscience, Lifespan Development, Nutrition, Population Health, Statistics): ~2,000 sections, readable in the app with practice buttons.
- **Figure library**: ~7,000 textbook figures with captions, searchable; admins can add hotspot annotations and students get a quiz-me mode. Plus 13 hand-built high-yield clinical diagrams (nephron, brachial plexus, coagulation, auscultation, cardiac action potential, PV loop, O2-Hb curve, lung volumes, RAAS, adrenal zones, spinal cord tracts, circle of Willis, bilirubin metabolism) with hotspots and test-me mode.
- **Subjects & specialties**: 30 basic-science and clinical subjects linking MeSH vocabulary, textbook sections, figures and questions.
- **Reference library**: 31,110 MeSH concepts (diseases, anatomy, viruses, bacteria, animals, drugs, procedures, equipment, psychiatry, physiology), 2,795 FDA drug labels with 112,610 NDC products and shortage records, 7,097 FDA device types, 98,403 ICD-10-CM FY2027 codes, 1,017 MedlinePlus health topics, NBME lab reference values.
- **Live research and updates**: PubMed and ClinicalTrials.gov search; a "What's new" feed filled by the admin update jobs; reviewed articles published by admins.
- **Accounts**: register/sign in (scrypt-hashed passwords, bearer tokens). Guests can study immediately; their progress is merged into the account when they sign up.
- **Admin panel** (`#/admin`): see below.
- Notes, bookmarks, global search, light/dark theme, responsive layout.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter (hash routing), three.js |
| Backend | Node.js, Express, Zod validation |
| Databases | SQLite via better-sqlite3: `data/content.db` (read-only reference content, ~300 MB) and `data/app.db` (users, attempts, cards, notes; created automatically) |
| Data pipeline | Python 3 ETL scripts in `etl/` |

## Run locally

Requirements: Node.js 20, 22 or 24 (and Python 3.10+ only if you want to rebuild the data). Works on Windows, macOS and Linux; the SQLite driver downloads a prebuilt binary, so no C++ compiler or Visual Studio is needed.

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

### Windows troubleshooting

- If `npm ci` reports `EBUSY` or `EPERM` while removing `node_modules`, close any editor, terminal or dev server using the folder, delete `node_modules` (`Remove-Item -Recurse -Force node_modules` in PowerShell) and run `npm ci` again.
- If it still tries to run `node-gyp` for `better-sqlite3`, you are on a Node.js version without a prebuilt binary (for example Node 25+). Install Node 22 or 24 LTS.

The app has no external service dependencies except PubMed and ClinicalTrials.gov for the live research pages.

## Admin panel

The first account registered on a fresh install becomes the administrator automatically. To promote another account later: `npm run admin -- someone@example.com` (list accounts with `npm run admin`, demote with `--demote`). Sign in and open **Admin panel** in the sidebar (`#/admin`).

| Tab | What it does |
|---|---|
| Overview | Users, activity, attempts, open reports, drafts, content counts, hardest questions, recent jobs |
| Users | Search, change role (student/editor/admin), suspend, reset password, delete |
| Questions | Search all questions, edit stem/options/explanation, disable, delete, write new questions |
| Reports | Problems students flagged on questions, drugs, concepts and anatomy; resolve or dismiss |
| Data updates | Run jobs that collect new data from official APIs: PubMed reviews and guidelines, openFDA updated labels and shortages, ClinicalTrials.gov, MedlinePlus, Wikipedia anatomy refresh, PubChem, OpenStax. Each job has a live log and feeds "What's new" |
| Import & articles | Fetch an article from a URL (robots.txt is respected; licence must be recorded), review and edit the draft, then publish it to "Reviewed articles" |
| Anatomy notes | Editor's notes that override the description of any 3D structure (also editable from the atlas) |
| Settings | Site announcement, turn features on/off, open/close registration, PubMed subjects |
| Audit log | Every admin action with who, when and what |

Imported material is never published automatically: an admin must review it first, because a study platform must not show unverified content.

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

`/api/search`, `/api/concepts/:id`, `/api/tree`, `/api/drugs[/:slug]`, `/api/devices[/:code]`, `/api/icd10[/:code]`, `/api/topics[/:id]`, `/api/labs`, `/api/anatomy/parts`, `/api/models`, `/api/questions/facets`, `/api/questions/count`, `/api/quiz/build`, `/api/quiz/answer`, `/api/quiz/sessions[/:id][/finish]`, `/api/analytics`, `/api/cards[/due|/:id/review]`, `/api/bookmarks`, `/api/notes`, `/api/pubmed[/:pmid]`, `/api/trials`, `/api/auth/{register,login,logout,me}`, `/api/anatomy/{part/:fj,concept/:fma,organs}`, `/api/books[/:slug[/:section]]`, `/api/figures[/:id]`, `/api/compounds[/:cid]`, `/api/subjects[/:slug]`, `/api/updates`, `/api/articles[/:id]`, `/api/reports`, `/api/admin/*` (admin only).

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
| 3D pathogens, devices, lab equipment | [NIH 3D](https://3d.nih.gov) | Public Domain / CC0 / CC BY 4.0 per model (NC/ND excluded) |
| Pathogen protein structures | [RCSB PDB](https://www.rcsb.org) | Public (CC0) |
| Drug images | [DailyMed](https://dailymed.nlm.nih.gov) | Public domain (U.S. government) |
| 3D organs | [Human Reference Atlas](https://humanatlas.io/3d-reference-library) | CC BY 4.0 |
| Anatomy IDs | [Wikidata](https://www.wikidata.org) (FMA P1402, TA98 P1323, MeSH P486, UBERON P1554) | CC0 |
| Anatomy descriptions | [English Wikipedia](https://en.wikipedia.org) | CC BY-SA 4.0 |
| Textbooks, figures, review questions | [OpenStax](https://openstax.org) | CC BY-NC-SA 4.0 / CC BY 4.0 per book |
| Molecules | [PubChem](https://pubchem.ncbi.nlm.nih.gov) | Public domain (descriptions keep their attribution) |
| Literature, trials (live) | [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/), [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/api) | Per publisher / public |

## Scope and honesty notes

- Copyrighted textbooks and commercial question banks (First Aid, Robbins, Guyton, UWorld, etc.) are not included and cannot be legally redistributed; openly licensed OpenStax books are used instead.
- BodyParts3D is a single adult male reference body, so female reproductive organs are not in the 3D atlas. Open, licence-clean scanned 3D models do not exist for most medical equipment or for every pathogen, so those are labelled schematic models (marked as such in the viewer).
- Figure hotspots are added by admins; imported figures come with their captions.
- Some websites block automated requests (for example CDC returns 403); the update jobs use official APIs instead.
- Generated questions are derived mechanically from the source record shown in each explanation; distractors are filtered so none is also correct. Hand-written vignettes cite a reference but have not been reviewed by a physician panel.
- Diagrams are simplified teaching schematics.
- This is a study aid, not medical advice. Confirm prescribing details against the current label.
