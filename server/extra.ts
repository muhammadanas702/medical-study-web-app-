// Content routes added in v2: anatomy part detail, OpenStax books & figures, PubChem compounds, subject hubs.
import type { Express, Request, Response, NextFunction } from "express";
import { all, get, ftsQuery, parseJSON, META } from "./content";
import { figureHotspots, annotatedFigureIds, anatomyOverride, feedItem, disabledIds } from "./admin";

const w = (fn: (req: Request<Record<string, string>>, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  try { const o = fn(req as Request<Record<string, string>>, res); if (o instanceof Promise) o.catch(next); } catch (e) { next(e); }
};
const bad = (res: Response, msg: string, status = 400) => res.status(status).json({ message: msg });
const int = (v: unknown, d: number, min = 0, max = 1_000_000) => { const n = parseInt(String(v ?? ""), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const has = (t: string) => !!get("SELECT name FROM sqlite_master WHERE name=?", t);

const WIKI_URL = (t: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`;

// ── subject hubs ──
type Subject = {
  id: string; title: string; group: "basic" | "clinical"; blurb: string;
  mesh: string[]; systems?: string[]; disciplines?: string[]; books?: string[]; bookQuery?: string; figureQuery?: string;
  icd?: number[]; topicGroups?: string[]; deviceSpecialties?: string[]; drugQuery?: string; atlas?: string[]; pubmed: string;
};
export const SUBJECTS: Subject[] = [
  { id: "anatomy", title: "Anatomy", group: "basic", blurb: "Gross, regional and systemic anatomy, histology and embryology.", mesh: ["A01", "A02", "A08", "A10", "A11", "A16"], disciplines: ["Anatomy"], books: ["anatomy-and-physiology-2e"], bookQuery: "anatomy structure", figureQuery: "anatomy", atlas: ["skeletal", "muscular", "nervous"], pubmed: "anatomy" },
  { id: "physiology", title: "Physiology", group: "basic", blurb: "Organ-system function, homeostasis and regulation.", mesh: ["G07", "G09", "G10", "G11", "G08"], disciplines: ["Physiology"], books: ["anatomy-and-physiology-2e"], bookQuery: "physiology homeostasis", figureQuery: "physiology", pubmed: "physiology" },
  { id: "biochemistry", title: "Biochemistry & Nutrition", group: "basic", blurb: "Metabolism, enzymes, vitamins, macromolecules and clinical nutrition.", mesh: ["G03", "D08", "D12", "D13", "D09", "D10"], disciplines: ["Biochemistry & Nutrition"], books: ["biology-2e", "organic-chemistry", "nutrition", "chemistry-2e"], bookQuery: "metabolism enzyme", figureQuery: "metabolism", topicGroups: ["Food and Nutrition", "Metabolic Problems"], pubmed: "biochemistry" },
  { id: "genetics", title: "Genetics & Molecular Biology", group: "basic", blurb: "Inheritance, molecular biology, genetic disorders.", mesh: ["G05", "C16"], disciplines: ["Biochemistry & Genetics"], books: ["biology-2e"], bookQuery: "gene DNA inheritance", figureQuery: "DNA chromosome", icd: [17], topicGroups: ["Genetics/Birth Defects"], deviceSpecialties: ["Medical Genetics"], pubmed: "genetics" },
  { id: "microbiology", title: "Microbiology", group: "basic", blurb: "Bacteria, viruses, fungi and parasites; pathogenesis and lab diagnosis.", mesh: ["B03", "B04", "B01", "G06"], disciplines: ["Microbiology"], systems: ["Microbiology & Infection"], books: ["microbiology"], bookQuery: "bacteria virus", figureQuery: "bacteria", icd: [1], topicGroups: ["Infections"], deviceSpecialties: ["Microbiology"], pubmed: "microbiology" },
  { id: "immunology", title: "Immunology", group: "basic", blurb: "Innate and adaptive immunity, hypersensitivity, immunodeficiency, transplant.", mesh: ["A15", "G12", "C20"], systems: ["Hematology & Immunology"], books: ["microbiology", "anatomy-and-physiology-2e"], bookQuery: "immune antibody lymphocyte", figureQuery: "immune", topicGroups: ["Immune System"], deviceSpecialties: ["Immunology"], pubmed: "immunology" },
  { id: "pathology", title: "Pathology", group: "basic", blurb: "Cell injury, inflammation, neoplasia and disease mechanisms.", mesh: ["C23", "C04"], disciplines: ["Pathology"], bookQuery: "disease pathology", figureQuery: "disease", icd: [18], deviceSpecialties: ["Pathology"], pubmed: "pathology" },
  { id: "pharmacology", title: "Pharmacology", group: "basic", blurb: "Pharmacokinetics, pharmacodynamics, drug classes, toxicology.", mesh: ["D27", "D26", "E02"], disciplines: ["Pharmacology"], books: ["pharmacology"], bookQuery: "drug mechanism", figureQuery: "drug", topicGroups: ["Drug Therapy"], deviceSpecialties: ["Clinical Toxicology"], pubmed: "pharmacology" },
  { id: "behavioral", title: "Behavioral Science & Psychiatry", group: "basic", blurb: "Psychology, development, behaviour, mental disorders and psychopharmacology.", mesh: ["F01", "F02", "F03", "F04"], disciplines: ["Behavioral Science"], systems: ["Psychiatry & Behavior"], books: ["psychology-2e", "lifespan-development", "introduction-behavioral-neuroscience"], bookQuery: "behavior psychology", figureQuery: "brain behavior", icd: [5], topicGroups: ["Mental Health and Behavior", "Substance Use and Disorders"], pubmed: "psychiatry" },
  { id: "biostatistics", title: "Biostatistics & Epidemiology", group: "basic", blurb: "Study design, statistics, screening, population and public health.", mesh: ["E05", "G17"], disciplines: ["Biostatistics & Epidemiology"], books: ["introductory-statistics-2e", "population-health"], bookQuery: "probability sample", figureQuery: "distribution", topicGroups: ["Health System", "Population Groups"], pubmed: "epidemiology" },
  { id: "cardiology", title: "Cardiology", group: "clinical", blurb: "Heart and vascular disease, ECG, heart failure, hypertension.", mesh: ["C14", "A07"], systems: ["Cardiovascular"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "heart cardiac", figureQuery: "heart", icd: [9], topicGroups: ["Blood, Heart and Circulation"], deviceSpecialties: ["Cardiovascular"], drugQuery: "antihypertensive OR anticoagulant OR antiarrhythmic OR statin OR beta adrenergic", atlas: ["cardiovascular"], pubmed: "cardiology" },
  { id: "pulmonology", title: "Pulmonology", group: "clinical", blurb: "Airway, lung parenchyma, ventilation and respiratory failure.", mesh: ["C08", "A04"], systems: ["Respiratory"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "lung respiratory", figureQuery: "lung", icd: [10], topicGroups: ["Lungs and Breathing"], drugQuery: "bronchodilator OR corticosteroid inhaled", atlas: ["respiratory"], pubmed: "pulmonology" },
  { id: "gastroenterology", title: "Gastroenterology & Hepatology", group: "clinical", blurb: "GI tract, liver, biliary system and pancreas.", mesh: ["C06", "A03"], systems: ["Gastrointestinal"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "digestive stomach liver", figureQuery: "digestive", icd: [11], topicGroups: ["Digestive System"], deviceSpecialties: ["Gastroenterology, Urology"], atlas: ["digestive"], pubmed: "gastroenterology" },
  { id: "nephrology", title: "Nephrology & Urology", group: "clinical", blurb: "Kidney function, electrolytes, acid-base, urinary tract.", mesh: ["C12", "A05"], systems: ["Renal & Urogenital"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "kidney renal urine", figureQuery: "kidney", icd: [14], topicGroups: ["Kidneys and Urinary System"], deviceSpecialties: ["Gastroenterology, Urology"], atlas: ["urinary"], pubmed: "nephrology" },
  { id: "endocrinology", title: "Endocrinology", group: "clinical", blurb: "Diabetes, thyroid, adrenal, pituitary and bone metabolism.", mesh: ["C19", "A06", "D06"], systems: ["Endocrine & Metabolic"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "hormone endocrine", figureQuery: "hormone", icd: [4], topicGroups: ["Endocrine System", "Diabetes Mellitus"], atlas: ["endocrine"], pubmed: "endocrinology" },
  { id: "hematology", title: "Hematology", group: "clinical", blurb: "Anemia, hemostasis, transfusion and hematologic malignancy.", mesh: ["C15", "A15"], systems: ["Hematology & Immunology"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "blood erythrocyte platelet", figureQuery: "blood cell", icd: [3], topicGroups: ["Blood, Heart and Circulation"], deviceSpecialties: ["Hematology"], pubmed: "hematology" },
  { id: "oncology", title: "Oncology", group: "clinical", blurb: "Neoplasia, cancer biology, staging and chemotherapy.", mesh: ["C04"], systems: ["Oncology"], books: ["pharmacology", "biology-2e"], bookQuery: "cancer tumor", figureQuery: "cancer", icd: [2], topicGroups: ["Cancers"], drugQuery: "antineoplastic OR kinase inhibitor", pubmed: "oncology" },
  { id: "infectious", title: "Infectious Disease", group: "clinical", blurb: "Clinical infections, antimicrobials, vaccines and infection control.", mesh: ["C01", "D27.505.954.122"], systems: ["Microbiology & Infection"], books: ["microbiology", "pharmacology"], bookQuery: "infection antibiotic", figureQuery: "infection", icd: [1], topicGroups: ["Infections"], drugQuery: "antibacterial OR antiviral OR antifungal", pubmed: "infectious diseases" },
  { id: "neurology", title: "Neurology", group: "clinical", blurb: "Brain, spinal cord, peripheral nerves, stroke, epilepsy, movement disorders.", mesh: ["C10", "A08"], systems: ["Nervous & Special Senses"], books: ["anatomy-and-physiology-2e", "introduction-behavioral-neuroscience", "pharmacology"], bookQuery: "nervous neuron brain", figureQuery: "brain", icd: [6], topicGroups: ["Brain and Nerves"], deviceSpecialties: ["Neurology"], drugQuery: "anticonvulsant OR dopamine", atlas: ["nervous"], pubmed: "neurology" },
  { id: "ophthalmology", title: "Ophthalmology", group: "clinical", blurb: "Eye anatomy, vision and eye disease.", mesh: ["C11", "A09.371"], books: ["anatomy-and-physiology-2e"], bookQuery: "eye retina vision", figureQuery: "eye", icd: [7], topicGroups: ["Eyes and Vision"], deviceSpecialties: ["Ophthalmic"], atlas: ["sensory"], pubmed: "ophthalmology" },
  { id: "ent", title: "Otolaryngology (ENT)", group: "clinical", blurb: "Ear, nose, throat, hearing and balance.", mesh: ["C09", "A09.246"], books: ["anatomy-and-physiology-2e"], bookQuery: "ear hearing larynx", figureQuery: "ear", icd: [8], topicGroups: ["Ear, Nose and Throat"], deviceSpecialties: ["Ear, Nose, Throat"], pubmed: "otolaryngology" },
  { id: "dermatology", title: "Dermatology", group: "clinical", blurb: "Skin, hair and nail disease.", mesh: ["C17", "A17"], systems: ["Musculoskeletal & Skin"], books: ["anatomy-and-physiology-2e", "pharmacology"], bookQuery: "skin epidermis", figureQuery: "skin", icd: [12], topicGroups: ["Skin, Hair and Nails"], atlas: ["integumentary"], pubmed: "dermatology" },
  { id: "msk", title: "Musculoskeletal & Rheumatology", group: "clinical", blurb: "Bone, joint, muscle and connective tissue disease; orthopaedics.", mesh: ["C05", "A02"], systems: ["Musculoskeletal & Skin"], books: ["anatomy-and-physiology-2e"], bookQuery: "bone joint muscle", figureQuery: "bone", icd: [13], topicGroups: ["Bones, Joints and Muscles"], deviceSpecialties: ["Orthopedic", "Physical Medicine"], atlas: ["skeletal", "muscular"], pubmed: "rheumatology" },
  { id: "obgyn", title: "Obstetrics & Gynecology", group: "clinical", blurb: "Reproduction, pregnancy, childbirth and women's health.", mesh: ["C13", "A05.360"], systems: ["Reproductive"], books: ["anatomy-and-physiology-2e", "pharmacology", "lifespan-development"], bookQuery: "pregnancy uterus ovary", figureQuery: "pregnancy", icd: [15], topicGroups: ["Pregnancy and Reproduction", "Female Reproductive System", "Women"], deviceSpecialties: ["Obstetrics/Gynecology"], atlas: ["reproductive"], pubmed: "obstetrics" },
  { id: "pediatrics", title: "Pediatrics & Neonatology", group: "clinical", blurb: "Growth, development, neonatal and childhood disease.", mesh: ["C16"], books: ["lifespan-development"], bookQuery: "infant child development", figureQuery: "infant", icd: [16, 17], topicGroups: ["Children and Teenagers"], pubmed: "pediatrics" },
  { id: "surgery", title: "Surgery & Anesthesiology", group: "clinical", blurb: "Operative procedures, perioperative care, anaesthesia and trauma.", mesh: ["E04", "E03", "C26"], disciplines: ["Clinical Procedures"], bookQuery: "surgery wound", figureQuery: "surgery", icd: [19], topicGroups: ["Surgery and Rehabilitation", "Injuries and Wounds"], deviceSpecialties: ["General, Plastic Surgery", "Anesthesiology", "General Hospital"], pubmed: "surgery" },
  { id: "emergency", title: "Emergency Medicine & Toxicology", group: "clinical", blurb: "Resuscitation, poisoning, environmental and acute care.", mesh: ["C25", "C21"], bookQuery: "shock emergency poisoning", figureQuery: "emergency", icd: [19, 21], topicGroups: ["Poisoning, Toxicology, Environmental Health", "Safety Issues", "Disasters"], deviceSpecialties: ["Clinical Toxicology"], pubmed: "emergency medicine" },
  { id: "radiology", title: "Radiology & Diagnostics", group: "clinical", blurb: "Imaging, laboratory medicine and diagnostic tests.", mesh: ["E01"], systems: ["Laboratory Medicine"], bookQuery: "imaging diagnosis", figureQuery: "imaging", topicGroups: ["Diagnostic Tests"], deviceSpecialties: ["Radiology", "Clinical Chemistry"], pubmed: "radiology" },
  { id: "dentistry", title: "Dentistry & Oral Health", group: "clinical", blurb: "Teeth, oral cavity and stomatognathic disease.", mesh: ["C07", "A14", "E06"], bookQuery: "teeth oral cavity", figureQuery: "teeth", topicGroups: ["Mouth and Teeth"], deviceSpecialties: ["Dental"], pubmed: "dentistry" },
  { id: "veterinary", title: "Comparative & Veterinary Medicine", group: "basic", blurb: "Animal diseases and animal structures used in comparative medicine.", mesh: ["C22", "A13", "B01.050"], bookQuery: "animal vertebrate", figureQuery: "animal", pubmed: "veterinary medicine" },
];

export function registerContentRoutes(app: Express) {
  // ── anatomy ──
  app.get("/api/anatomy/parts", w((_req, res) => {
    res.json({
      parts: all(`SELECT a.fj, a.fma, a.name, a.system, a.kind, a.side, a.generic_fma, coalesce(a.mesh_id, a.ctx_mesh) mesh_id, c.name mesh_name,
        (a.wiki IS NOT NULL) own, (coalesce(a.wiki, a.ctx_wiki) IS NOT NULL) described FROM anatomy_parts a LEFT JOIN concepts c ON c.id=coalesce(a.mesh_id, a.ctx_mesh) ORDER BY a.name`),
      source: META.anatomy3d,
    });
  }));
  app.get("/api/anatomy/organs", w((req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const rows = all<any>(`SELECT fma, name, wiki, nfj, systems FROM anatomy_concepts WHERE nfj>=2 AND wiki IS NOT NULL ${q ? "AND lower(name) LIKE ?" : ""} ORDER BY nfj DESC LIMIT 400`, ...(q ? [`%${q}%`] : []));
    res.json({ organs: rows.map((r) => ({ ...r, systems: parseJSON(r.systems, []) })) });
  }));
  const wikiArticle = (title: string | null) => {
    if (!title) return null;
    const a = get<any>("SELECT * FROM anatomy_wiki WHERE title=?", title);
    if (!a) return null;
    const fresh = feedItem("wikipedia", title);
    return { title: a.title, url: a.url || WIKI_URL(a.title), touched: a.touched, intro: a.intro || fresh?.summary || null, latestSummary: fresh ? { text: fresh.summary, date: fresh.published } : null, sections: parseJSON(a.sections, []), image: a.image };
  };
  const conceptLite = (fma: string) => get<any>("SELECT fma, name, wiki, nfj, mesh_id FROM anatomy_concepts WHERE fma=?", fma);
  app.get("/api/anatomy/part/:fj", w((req, res) => {
    const p = get<any>("SELECT * FROM anatomy_parts WHERE fj=?", req.params.fj);
    if (!p) return bad(res, "Structure not found", 404);
    const g = p.generic_fma ? get<any>("SELECT * FROM anatomy_concepts WHERE fma=?", p.generic_fma) : null;
    const own = wikiArticle(p.wiki);
    const ctx = own ? null : wikiArticle(p.ctx_wiki);
    const meshId = p.mesh_id || p.ctx_mesh;
    const mesh = meshId ? get<any>("SELECT id, name, scope_note FROM concepts WHERE id=?", meshId) : null;
    const partOf = parseJSON<any[]>(p.partof, []).map((x) => ({ ...x, ...(conceptLite(x.fma) || {}) }));
    const isa = g ? parseJSON<any[]>(g.isa_parents, []) : [];
    const children = g ? parseJSON<any[]>(g.part_children, []).map((x) => ({ ...x, ...(conceptLite(x.fma) || {}) })) : [];
    const subtypes = g ? parseJSON<any[]>(g.isa_children, []).slice(0, 40) : [];
    const ov = anatomyOverride(p.fj);
    const term = (p.kind || p.name).replace(/\b(left|right)\b/gi, "").trim();
    const f = ftsQuery(term);
    const sections = f ? all(`SELECT s.id, s.book, s.chapter, s.title, snippet(book_fts, 2, '<mark>', '</mark>', '…', 18) snip FROM book_fts JOIN book_sections s ON s.id=book_fts.rowid
      WHERE book_fts MATCH ? AND s.book IN ('anatomy-and-physiology-2e','biology-2e','introduction-behavioral-neuroscience') ORDER BY bm25(book_fts, 10, 2, 1) LIMIT 5`, f) : [];
    const figures = f ? all(`SELECT b.id, b.title, b.src, b.book FROM figure_fts JOIN book_figures b ON b.id=figure_fts.rowid WHERE figure_fts MATCH ? AND b.book='anatomy-and-physiology-2e' ORDER BY bm25(figure_fts, 10, 3, 1) LIMIT 6`, f) : [];
    const questionCount = meshId ? (get<any>("SELECT COUNT(*) n FROM questions WHERE concept_id=?", meshId)?.n ?? 0) : 0;
    res.json({
      fj: p.fj, fma: p.fma, name: p.name, system: p.system, side: p.side, kind: p.kind, ta98: parseJSON(p.ta98, []), qid: p.qid,
      generic: g ? { fma: g.fma, name: g.name, nfj: g.nfj, fjs: parseJSON(g.fjs, []), uberon: g.uberon } : null,
      article: own, contextArticle: ctx ? { ...ctx, viaFma: p.ctx_fma, viaName: conceptLite(p.ctx_fma)?.name } : null,
      mesh: mesh ? { ...mesh, exact: !!p.mesh_id } : null, partOf, isa, children, subtypes, override: ov || null, sections, figures, questionCount,
      links: {
        fma: `https://www.ebi.ac.uk/ols4/ontologies/fma/classes?obo_id=FMA:${p.fma.replace("FMA", "")}`,
        wikidata: p.qid ? `https://www.wikidata.org/wiki/${p.qid}` : null,
        bodyparts3d: "https://lifesciencedb.jp/bp3d/",
      },
    });
  }));
  app.get("/api/anatomy/concept/:fma", w((req, res) => {
    const g = get<any>("SELECT * FROM anatomy_concepts WHERE fma=?", req.params.fma);
    if (!g) return bad(res, "Concept not found", 404);
    res.json({ ...g, fjs: parseJSON(g.fjs, []), part_parents: parseJSON(g.part_parents, []), part_children: parseJSON(g.part_children, []).map((x: any) => ({ ...x, ...(conceptLite(x.fma) || {}) })), isa_parents: parseJSON(g.isa_parents, []), isa_children: parseJSON(g.isa_children, []), systems: parseJSON(g.systems, []), article: wikiArticle(g.wiki) });
  }));

  // ── OpenStax books ──
  app.get("/api/books", w((_req, res) => res.json({ books: all("SELECT * FROM books ORDER BY ord"), source: META.openstax })));
  app.get("/api/books/search", w((req, res) => {
    const f = ftsQuery(String(req.query.q || ""));
    const book = String(req.query.book || "");
    if (!f) return res.json({ rows: [] });
    res.json({ rows: all(`SELECT s.id, s.book, b.title book_title, s.chapter, s.chapter_no, s.title, snippet(book_fts, 2, '<mark>', '</mark>', '…', 24) snip FROM book_fts JOIN book_sections s ON s.id=book_fts.rowid JOIN books b ON b.slug=s.book
      WHERE book_fts MATCH ? ${book ? "AND s.book=?" : ""} ORDER BY bm25(book_fts, 10, 3, 1) LIMIT 60`, ...(book ? [f, book] : [f])) });
  }));
  app.get("/api/books/:slug", w((req, res) => {
    const b = get<any>("SELECT * FROM books WHERE slug=?", req.params.slug);
    if (!b) return bad(res, "Book not found", 404);
    const toc = all("SELECT s.id, s.unit, s.chapter, s.chapter_no, s.ord, s.title, s.words, (SELECT COUNT(*) FROM book_figures f WHERE f.section_id=s.id) nfig, (SELECT COUNT(*) FROM book_questions q WHERE q.section_id=s.id) nq FROM book_sections s WHERE s.book=? ORDER BY s.ord", b.slug);
    res.json({ book: b, toc });
  }));
  app.get("/api/books/:slug/:id", w((req, res) => {
    const s = get<any>("SELECT * FROM book_sections WHERE id=? AND book=?", int(req.params.id, 0), req.params.slug);
    if (!s) return bad(res, "Section not found", 404);
    const b = get<any>("SELECT slug, title, license, license_url, url, subject FROM books WHERE slug=?", s.book);
    const prev = get("SELECT id, title FROM book_sections WHERE book=? AND ord<? ORDER BY ord DESC LIMIT 1", s.book, s.ord);
    const next = get("SELECT id, title FROM book_sections WHERE book=? AND ord>? ORDER BY ord LIMIT 1", s.book, s.ord);
    const off = disabledIds();
    const qids = all<{ id: number }>("SELECT id FROM book_questions WHERE section_id=?", s.id).map((r) => `os-${r.id}`).filter((id) => !off.has(id) && get("SELECT 1 FROM questions WHERE id=?", id));
    const figures = all("SELECT id, fid, title, caption, src FROM book_figures WHERE section_id=?", s.id);
    res.json({ section: { id: s.id, book: s.book, unit: s.unit, chapter: s.chapter, chapter_no: s.chapter_no, title: s.title, abstract: s.abstract, html: s.html, words: s.words, module: s.module }, book: b, prev, next, questionIds: qids, figures });
  }));

  // ── figures (OpenStax) with admin hotspots ──
  app.get("/api/figures", w((req, res) => {
    const q = String(req.query.q || "");
    const book = String(req.query.book || "");
    const annotated = req.query.annotated === "1";
    const page = int(req.query.page, 0, 0, 1000);
    const size = 36;
    const f = ftsQuery(q);
    let rows: any[]; let total: number;
    if (annotated) {
      const ids = annotatedFigureIds();
      total = ids.length;
      rows = ids.slice(page * size, page * size + size).map((id) => get("SELECT b.id, b.book, b.title, b.caption, b.src, s.title section FROM book_figures b LEFT JOIN book_sections s ON s.id=b.section_id WHERE b.id=?", id)).filter(Boolean);
    } else if (f) {
      rows = all(`SELECT b.id, b.book, b.title, b.caption, b.src, s.title section FROM figure_fts JOIN book_figures b ON b.id=figure_fts.rowid LEFT JOIN book_sections s ON s.id=b.section_id WHERE figure_fts MATCH ? ${book ? "AND b.book=?" : ""} ORDER BY bm25(figure_fts, 10, 3, 1) LIMIT ? OFFSET ?`, ...(book ? [f, book] : [f]), size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM figure_fts JOIN book_figures b ON b.id=figure_fts.rowid WHERE figure_fts MATCH ? ${book ? "AND b.book=?" : ""}`, ...(book ? [f, book] : [f])).n;
    } else {
      rows = all(`SELECT b.id, b.book, b.title, b.caption, b.src, s.title section FROM book_figures b LEFT JOIN book_sections s ON s.id=b.section_id ${book ? "WHERE b.book=?" : ""} ORDER BY b.id LIMIT ? OFFSET ?`, ...(book ? [book] : []), size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM book_figures ${book ? "WHERE book=?" : ""}`, ...(book ? [book] : [])).n;
    }
    const ann = new Set(annotatedFigureIds());
    res.json({ total, page, size, rows: rows.map((r) => ({ ...r, annotated: ann.has(r.id) })), books: all("SELECT slug, title, figures FROM books ORDER BY ord") });
  }));
  app.get("/api/figures/:id", w((req, res) => {
    const id = int(req.params.id, 0);
    const f = get<any>("SELECT b.*, s.title section, s.chapter, s.chapter_no FROM book_figures b LEFT JOIN book_sections s ON s.id=b.section_id WHERE b.id=?", id);
    if (!f) return bad(res, "Figure not found", 404);
    const book = get<any>("SELECT title, license, license_url, url FROM books WHERE slug=?", f.book);
    res.json({ ...f, bookInfo: book, ...figureHotspots(id) });
  }));

  // ── PubChem compounds ──
  app.get("/api/compounds", w((req, res) => {
    if (!has("compounds")) return res.json({ total: 0, rows: [], available: false });
    const q = String(req.query.q || "").trim();
    const page = int(req.query.page, 0, 0, 1000);
    const size = 40;
    const like = `%${q}%`;
    const where = q ? "WHERE c.title LIKE ? OR c.formula LIKE ? OR c.iupac LIKE ? OR EXISTS (SELECT 1 FROM drug_compounds x WHERE x.cid=c.cid AND x.ingredient LIKE ?)" : "";
    const params = q ? [like, `${q}%`, like, like] : [];
    // list by the drug-label ingredient name students know (e.g. "salbutamol"), with PubChem's title underneath
    const rows = all(`SELECT c.cid, c.title, c.formula, c.mw, c.xlogp, c.svg IS NOT NULL AS hasSvg, (SELECT COUNT(DISTINCT slug) FROM drug_compounds x WHERE x.cid=c.cid) ndrugs,
      (SELECT lower(x.ingredient) FROM drug_compounds x WHERE x.cid=c.cid ORDER BY length(x.ingredient) LIMIT 1) name
      FROM compounds c ${where} ORDER BY name IS NULL, coalesce(name, c.title) COLLATE NOCASE LIMIT ? OFFSET ?`, ...params, size, page * size);
    const total = get<any>(`SELECT COUNT(*) n FROM compounds c ${where}`, ...params).n;
    res.json({ total, page, size, rows, available: true, source: META.pubchem });
  }));
  app.get("/api/compounds/:cid/svg", w((req, res) => {
    const r = has("compounds") ? get<any>("SELECT svg FROM compounds WHERE cid=?", int(req.params.cid, 0, 0, 2_000_000_000)) : null;
    if (!r?.svg) return res.status(404).end();
    res.set("Content-Type", "image/svg+xml").set("Cache-Control", "public, max-age=604800").send(r.svg);
  }));
  app.get("/api/compounds/:cid", w((req, res) => {
    if (!has("compounds")) return bad(res, "Compound data not built yet", 404);
    const c = get<any>("SELECT * FROM compounds WHERE cid=?", int(req.params.cid, 0, 0, 2_000_000_000));
    if (!c) return bad(res, "Compound not found", 404);
    const drugs = all("SELECT DISTINCT d.slug, d.generic, d.brands FROM drug_compounds x JOIN drugs d ON d.slug=x.slug WHERE x.cid=? ORDER BY d.generic LIMIT 100", c.cid).map((d: any) => ({ ...d, brands: parseJSON(d.brands, []) }));
    const { svg, ...rest } = c;
    res.json({ ...rest, hasSvg: !!svg, descriptions: parseJSON(c.descriptions, []), drugs, url: `https://pubchem.ncbi.nlm.nih.gov/compound/${c.cid}`, source: META.pubchem });
  }));
  app.get("/api/drugs/:slug/compounds", w((req, res) => {
    let rows: any[] = [];
    if (has("drug_compounds")) rows = all("SELECT x.ingredient, x.cid, c.title, c.formula, c.mw, c.iupac, c.smiles, c.inchikey, c.xlogp, c.tpsa, c.hbd, c.hba, c.rotb, c.charge, c.exact_mass, c.heavy_atoms, c.descriptions, c.svg IS NOT NULL AS hasSvg FROM drug_compounds x LEFT JOIN compounds c ON c.cid=x.cid WHERE x.slug=? ORDER BY x.ord", req.params.slug)
      .map((r) => ({ ...r, descriptions: parseJSON(r.descriptions, []) }));
    if (!rows.some((r) => r.cid)) {
      const fb = feedItem("pubchem", req.params.slug);
      if (fb?.data?.cid) rows = [{ ingredient: fb.title, cid: fb.data.cid, title: fb.title, formula: fb.data.MolecularFormula, mw: Number(fb.data.MolecularWeight) || null, iupac: fb.data.IUPACName, smiles: fb.data.SMILES, inchikey: fb.data.InChIKey, descriptions: [] }];
    }
    res.json({ compounds: rows });
  }));

  // ── subjects ──
  app.get("/api/subjects", w((_req, res) => {
    res.json({ subjects: SUBJECTS.map((s) => ({ id: s.id, title: s.title, group: s.group, blurb: s.blurb, questions: countQ(s), concepts: s.mesh.reduce((n, tn) => n + (get<any>("SELECT COUNT(*) n FROM tree WHERE tn=? OR tn LIKE ?", tn, `${tn}.%`)?.n ?? 0), 0) })) });
  }));
  app.get("/api/subjects/:id", w((req, res) => {
    const s = SUBJECTS.find((x) => x.id === req.params.id);
    if (!s) return bad(res, "Subject not found", 404);
    const mesh = s.mesh.map((tn) => {
      const node = get<any>("SELECT t.tn, t.id, t.name, t.nchild, substr(c.scope_note,1,240) note FROM tree t LEFT JOIN concepts c ON c.id=t.id WHERE t.tn=?", tn);
      if (!node) return null;
      const children = all("SELECT tn, id, name, nchild FROM tree WHERE parent=? ORDER BY name LIMIT 60", tn);
      const total = get<any>("SELECT COUNT(*) n FROM tree WHERE tn LIKE ?", `${tn}.%`)?.n ?? 0;
      return { ...node, children, total };
    }).filter(Boolean);
    const bf = ftsQuery(s.bookQuery || s.title);
    const bookList = s.books || [];
    const sections = bf ? all(`SELECT s.id, s.book, b.title book_title, s.chapter, s.title FROM book_fts JOIN book_sections s ON s.id=book_fts.rowid JOIN books b ON b.slug=s.book
      WHERE book_fts MATCH ? ${bookList.length ? `AND s.book IN (${bookList.map(() => "?").join(",")})` : ""} ORDER BY bm25(book_fts, 10, 3, 1) LIMIT 12`, bf.split(" ").join(" OR "), ...bookList) : [];
    const books = bookList.map((b) => get("SELECT slug, title, subject, sections FROM books WHERE slug=?", b)).filter(Boolean);
    const ff = ftsQuery(s.figureQuery || s.title);
    const figures = ff ? all("SELECT b.id, b.title, b.src FROM figure_fts JOIN book_figures b ON b.id=figure_fts.rowid WHERE figure_fts MATCH ? ORDER BY bm25(figure_fts, 10, 3, 1) LIMIT 12", ff) : [];
    const icd = (s.icd || []).map((n) => get("SELECT n, start, end, title FROM icd10_chapters WHERE n=?", n)).filter(Boolean);
    const topics = (s.topicGroups || []).length ? all(`SELECT DISTINCT t.id, t.title FROM topics t, json_each(t.groups) g WHERE g.value IN (${s.topicGroups!.map(() => "?").join(",")}) ORDER BY t.title LIMIT 80`, ...s.topicGroups!) : [];
    const devices = (s.deviceSpecialties || []).map((sp) => ({ specialty: sp, n: get<any>("SELECT COUNT(*) n FROM devices WHERE specialty=?", sp)?.n ?? 0 }));
    let drugs: any[] = [];
    if (s.drugQuery) {
      const terms = s.drugQuery.split(/\s+OR\s+/).map((t) => `%${t.trim()}%`);
      drugs = all(`SELECT slug, generic, epc FROM drugs WHERE ${terms.map(() => "epc LIKE ?").join(" OR ")} ORDER BY generic COLLATE NOCASE LIMIT 60`, ...terms).map((d: any) => ({ ...d, epc: parseJSON(d.epc, []) }));
    }
    res.json({ ...s, mesh, sections, books, figures, icd, topics, devices, drugs, questions: countQ(s) });
  }));
}

function countQ(s: Subject) {
  const conds: string[] = []; const params: string[] = [];
  if (s.systems?.length) { conds.push(`system IN (${s.systems.map(() => "?").join(",")})`); params.push(...s.systems); }
  if (s.disciplines?.length) { conds.push(`discipline IN (${s.disciplines.map(() => "?").join(",")})`); params.push(...s.disciplines); }
  if (!conds.length) return 0;
  return get<any>(`SELECT COUNT(*) n FROM questions WHERE ${conds.join(" OR ")}`, ...params)?.n ?? 0;
}
