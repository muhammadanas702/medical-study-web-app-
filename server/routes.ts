import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { all, get, ftsQuery, parseJSON, META } from "./content";
import {
  registerSchema, loginSchema, insertFlashcardSchema, insertBookmarkSchema, insertNoteSchema,
  quizBuildSchema, answerSchema, type User,
} from "@shared/schema";
import { z } from "zod";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      owner: string;
      user?: User;
      token?: string;
    }
  }
}

const MESH_URL = "https://meshb.nlm.nih.gov/record/ui?ui=";
const DAILYMED = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=";
const SECTION_LABELS: [string, string][] = [
  ["boxed_warning", "Boxed warning"], ["indications_and_usage", "Indications and usage"], ["dosage_and_administration", "Dosage and administration"],
  ["dosage_forms_and_strengths", "Dosage forms and strengths"], ["contraindications", "Contraindications"], ["warnings_and_cautions", "Warnings and precautions"],
  ["warnings", "Warnings"], ["precautions", "Precautions"], ["adverse_reactions", "Adverse reactions"], ["drug_interactions", "Drug interactions"],
  ["use_in_specific_populations", "Use in specific populations"], ["pregnancy", "Pregnancy"], ["lactation", "Lactation"], ["pediatric_use", "Pediatric use"],
  ["geriatric_use", "Geriatric use"], ["overdosage", "Overdosage"], ["description", "Description"], ["clinical_pharmacology", "Clinical pharmacology"],
  ["mechanism_of_action", "Mechanism of action"], ["pharmacodynamics", "Pharmacodynamics"], ["pharmacokinetics", "Pharmacokinetics"],
  ["drug_abuse_and_dependence", "Drug abuse and dependence"], ["controlled_substance", "Controlled substance"], ["how_supplied", "How supplied"],
  ["storage_and_handling", "Storage and handling"], ["information_for_patients", "Patient counseling information"],
];

function wrap(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = fn(req, res);
      if (out instanceof Promise) out.catch(next);
    } catch (e) {
      next(e);
    }
  };
}
function bad(res: Response, err: z.ZodError | string, status = 400) {
  const message = typeof err === "string" ? err : err.issues.map((i) => i.message).join("; ");
  return res.status(status).json({ message });
}
function int(v: unknown, d: number, min = 0, max = 1_000_000) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
}
function list(v: unknown): string[] {
  if (!v) return [];
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

// ── tiny TTL cache for upstream APIs ──
const cache = new Map<string, { at: number; data: unknown }>();
async function cachedJson(url: string, ttlMs = 10 * 60 * 1000, asText = false): Promise<any> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const r = await fetch(url, { headers: { "User-Agent": "Vesalius-MedStudy/1.0 (educational)" } });
  if (!r.ok) throw Object.assign(new Error(`Upstream ${r.status}`), { status: 502 });
  const data = asText ? await r.text() : await r.json();
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return data;
}

type QRow = { id: string; kind: string; discipline: string; system: string; stem: string; ask: string; options: string; answer: number; explanation: string; rationales: string; objective: string; concept_id: string | null; source: string; source_url: string | null };
function publicQ(q: QRow) {
  return { id: q.id, kind: q.kind, discipline: q.discipline, system: q.system, stem: q.stem, ask: q.ask, options: parseJSON<string[]>(q.options, []), source: q.source, sourceUrl: q.source_url, conceptId: q.concept_id };
}
function fullQ(q: QRow) {
  return { ...publicQ(q), answer: q.answer, explanation: q.explanation, rationales: parseJSON<string[]>(q.rationales, []), objective: q.objective };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const { rawAppDb } = await import("./storage");
  const peerStmt = rawAppDb.prepare(
    "SELECT COUNT(*) n, SUM(correct) c FROM (SELECT owner, correct, MIN(created_at) FROM attempts WHERE question_id=? GROUP BY owner)",
  );

  // identity: bearer token (account) or X-Visitor-Id (guest, kept in memory by the client)
  app.use("/api", (req, _res, next) => {
    const auth = req.header("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      const u = storage.userByToken(token);
      if (u) {
        req.user = u;
        req.token = token;
        req.owner = `u:${u.id}`;
        return next();
      }
    }
    const v = req.header("x-visitor-id") || "";
    req.owner = /^[a-zA-Z0-9-]{8,64}$/.test(v) ? `g:${v}` : "g:anonymous";
    next();
  });

  // ── auth ──
  app.post("/api/auth/register", wrap((req, res) => {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const u = storage.register(p.data.name, p.data.email, p.data.password);
    if ("error" in u) return bad(res, u.error, 409);
    if (req.owner.startsWith("g:") && req.owner !== "g:anonymous") storage.mergeGuest(req.owner, `u:${u.id}`);
    res.json({ token: storage.createToken(u.id), user: { id: u.id, name: u.name, email: u.email } });
  }));
  app.post("/api/auth/login", wrap((req, res) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const u = storage.login(p.data.email, p.data.password);
    if (!u) return bad(res, "Email or password is incorrect", 401);
    if (req.owner.startsWith("g:") && req.owner !== "g:anonymous") storage.mergeGuest(req.owner, `u:${u.id}`);
    res.json({ token: storage.createToken(u.id), user: { id: u.id, name: u.name, email: u.email } });
  }));
  app.post("/api/auth/logout", wrap((req, res) => {
    if (req.token) storage.deleteToken(req.token);
    res.json({ ok: true });
  }));
  app.get("/api/auth/me", wrap((req, res) => {
    res.json({ user: req.user ? { id: req.user.id, name: req.user.name, email: req.user.email } : null });
  }));

  // ── overview ──
  const counts = {
    concepts: get<{ n: number }>("SELECT COUNT(*) n FROM concepts")!.n,
    byCategory: Object.fromEntries(all<{ k: string; n: number }>("SELECT substr(cats,1,1) k, COUNT(*) n FROM concepts GROUP BY 1").map((r) => [r.k, r.n])),
    drugs: get<{ n: number }>("SELECT COUNT(*) n FROM drugs")!.n,
    ndc: get<{ n: number }>("SELECT COUNT(*) n FROM ndc")!.n,
    devices: get<{ n: number }>("SELECT COUNT(*) n FROM devices")!.n,
    icd10: get<{ n: number }>("SELECT COUNT(*) n FROM icd10")!.n,
    topics: get<{ n: number }>("SELECT COUNT(*) n FROM topics")!.n,
    labs: get<{ n: number }>("SELECT COUNT(*) n FROM labs")!.n,
    questions: get<{ n: number }>("SELECT COUNT(*) n FROM questions")!.n,
    anatomyParts: get<{ n: number }>("SELECT COUNT(*) n FROM anatomy_parts")!.n,
    models: get<{ n: number }>("SELECT COUNT(*) n FROM models")!.n,
    shortages: get<{ n: number }>("SELECT COUNT(*) n FROM shortages WHERE status='Current'")!.n,
  };
  const qFacets = {
    systems: all<{ v: string; n: number }>("SELECT system v, COUNT(*) n FROM questions GROUP BY 1 ORDER BY 1"),
    disciplines: all<{ v: string; n: number }>("SELECT discipline v, COUNT(*) n FROM questions GROUP BY 1 ORDER BY 1"),
    kinds: all<{ v: string; n: number }>("SELECT kind v, COUNT(*) n FROM questions GROUP BY 1 ORDER BY 2 DESC"),
  };
  app.get("/api/stats", (_req, res) => res.json({ counts, sources: META, qFacets }));

  // ── global search ──
  app.get("/api/search", wrap((req, res) => {
    const q = String(req.query.q || "").slice(0, 200);
    const f = ftsQuery(q);
    if (!f) return res.json({ q, concepts: [], drugs: [], icd10: [], devices: [], topics: [] });
    const lim = int(req.query.limit, 8, 1, 50);
    const cat = String(req.query.cat || "");
    const concepts = all(
      `SELECT c.id, c.name, c.cats, substr(c.scope_note,1,220) snippet FROM concepts_fts f JOIN concepts c ON c.id=f.id
       WHERE concepts_fts MATCH ? ${cat ? "AND c.cats LIKE ?" : ""} ORDER BY (lower(c.name)=lower(?)) DESC, bm25(concepts_fts, 0, 12, 5, 1) LIMIT ?`,
      ...(cat ? [f, `%${cat}%`, q.trim(), lim] : [f, q.trim(), lim]),
    );
    const drugs = all(
      `SELECT d.slug, d.generic, d.brands, d.epc FROM drugs_fts f JOIN drugs d ON d.slug=f.slug WHERE drugs_fts MATCH ? ORDER BY (lower(d.generic)=lower(?)) DESC, bm25(drugs_fts, 0, 12, 8, 3, 1) LIMIT ?`, f, q.trim(), lim,
    ).map((d: any) => ({ ...d, brands: parseJSON(d.brands, []), epc: parseJSON(d.epc, []) }));
    const codeLike = /^[A-Za-z]\d[0-9A-Za-z](\.?[0-9A-Za-z]{0,4})$/.test(q.trim());
    const icd10 = codeLike
      ? all(`SELECT code, display, title, billable FROM icd10 WHERE code LIKE ? ORDER BY length(code), code LIMIT ?`, q.trim().replace(".", "").toUpperCase() + "%", lim)
      : all(`SELECT i.code, i.display, i.title, i.billable FROM icd10_fts f JOIN icd10 i ON i.code=f.code WHERE icd10_fts MATCH ? ORDER BY bm25(icd10_fts, 0, 20, 1), length(i.code) LIMIT ?`, f, lim);
    const devices = all(`SELECT d.code, d.name, d.class, d.specialty FROM devices_fts f JOIN devices d ON d.code=f.code WHERE devices_fts MATCH ? ORDER BY bm25(devices_fts, 0, 10, 1, 1) LIMIT ?`, f, lim);
    const topics = all(`SELECT id, title, meta_desc FROM topics WHERE title LIKE ? OR also_called LIKE ? ORDER BY length(title) LIMIT ?`, `%${q}%`, `%${q}%`, lim);
    res.json({ q, concepts, drugs, icd10, devices, topics });
  }));

  // ── MeSH browser ──
  app.get("/api/tree", wrap((req, res) => {
    const parent = String(req.query.parent || "");
    if (!parent) return res.json({ node: null, path: [], children: all("SELECT tn, id, name, nchild FROM tree WHERE depth=0 ORDER BY tn") });
    const node = get("SELECT tn, id, name, nchild, depth FROM tree WHERE tn=?", parent);
    if (!node) return bad(res, "Tree node not found", 404);
    const parts = parent.split(".");
    const pathRows = [parent[0], ...parts.map((_, i) => parts.slice(0, i + 1).join("."))].filter((v, i, a) => a.indexOf(v) === i);
    const path = pathRows.map((tn) => get("SELECT tn, id, name FROM tree WHERE tn=?", tn)).filter(Boolean);
    const children = all("SELECT t.tn, t.id, t.name, t.nchild, substr(c.scope_note,1,160) snippet FROM tree t LEFT JOIN concepts c ON c.id=t.id WHERE t.parent=? ORDER BY t.name", parent);
    res.json({ node, path, children });
  }));

  app.get("/api/concepts/:id", wrap((req, res) => {
    const c = get<any>("SELECT * FROM concepts WHERE id=?", req.params.id);
    if (!c) return bad(res, "Concept not found", 404);
    const tns = parseJSON<string[]>(c.tree_numbers, []);
    const trees = tns.map((tn) => {
      const parts = tn.split(".");
      const path = [tn[0], ...parts.map((_, i) => parts.slice(0, i + 1).join("."))]
        .map((t) => get<any>("SELECT tn, id, name FROM tree WHERE tn=?", t)).filter(Boolean);
      const children = all("SELECT tn, id, name, nchild FROM tree WHERE parent=? ORDER BY name LIMIT 300", tn);
      return { tn, path, children };
    });
    const pa = parseJSON<string[]>(c.pharm_actions, []).map((id) => get("SELECT id, name FROM concepts WHERE id=?", id)).filter(Boolean);
    const seeAlso = parseJSON<string[]>(c.see_also, []).map((id) => get("SELECT id, name FROM concepts WHERE id=?", id)).filter(Boolean);
    const paMembers = c.pa_members > 0 ? all("SELECT id, name FROM concepts WHERE pharm_actions LIKE ? ORDER BY name LIMIT 400", `%"${c.id}"%`) : [];
    const topics = all("SELECT t.id, t.title, t.url, t.meta_desc FROM topic_mesh m JOIN topics t ON t.id=m.topic_id WHERE m.mesh_id=?", c.id);
    const drugs = all("SELECT slug, generic, brands FROM drugs WHERE mesh_id=?", c.id).map((d: any) => ({ ...d, brands: parseJSON(d.brands, []) }));
    const parts3d = all("SELECT fj, name, system FROM anatomy_parts WHERE mesh_id=?", c.id);
    const models = all("SELECT id, title FROM models WHERE mesh_id=?", c.id);
    const questionCount = get<{ n: number }>("SELECT COUNT(*) n FROM questions WHERE concept_id=?", c.id)!.n;
    let icd: unknown[] = [];
    if (c.cats.includes("C")) {
      const f = ftsQuery(c.name);
      if (f) icd = all("SELECT i.code, i.display, i.title FROM icd10_fts f JOIN icd10 i ON i.code=f.code WHERE icd10_fts MATCH ? ORDER BY bm25(icd10_fts,0,20,1), length(i.code) LIMIT 6", f);
    }
    res.json({
      id: c.id, name: c.name, scopeNote: c.scope_note, cats: c.cats.split(","), entryTerms: parseJSON(c.entry_terms, []),
      introduced: c.introduced, updated: c.updated, trees, pharmActions: pa, seeAlso, paMembers, topics, drugs, parts3d, models, questionCount, icd10: icd,
      source: { name: "MeSH 2026, U.S. National Library of Medicine", url: MESH_URL + c.id },
    });
  }));

  app.get("/api/topics", wrap((req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const group = String(req.query.group || "");
    let rows = all<any>("SELECT id, title, url, meta_desc, groups, also_called FROM topics ORDER BY title");
    if (group) rows = rows.filter((r) => parseJSON<string[]>(r.groups, []).includes(group));
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.also_called || "").toLowerCase().includes(q) || (r.meta_desc || "").toLowerCase().includes(q));
    const groups = new Map<string, number>();
    for (const r of all<any>("SELECT groups FROM topics")) for (const g of parseJSON<string[]>(r.groups, [])) groups.set(g, (groups.get(g) || 0) + 1);
    res.json({
      total: rows.length,
      rows: rows.slice(0, 400).map((r) => ({ id: r.id, title: r.title, url: r.url, meta_desc: r.meta_desc, groups: parseJSON(r.groups, []) })),
      groups: Array.from(groups, ([v, n]) => ({ v, n })).sort((a, b) => a.v.localeCompare(b.v)),
      source: META.medlineplus,
    });
  }));

  app.get("/api/topics/:id", wrap((req, res) => {
    const t = get<any>("SELECT * FROM topics WHERE id=?", req.params.id);
    if (!t) return bad(res, "Topic not found", 404);
    const mesh = parseJSON<string[]>(t.mesh_ids, []).map((id) => get("SELECT id, name FROM concepts WHERE id=?", id)).filter(Boolean);
    res.json({ ...t, also_called: parseJSON(t.also_called, []), groups: parseJSON(t.groups, []), mesh, source: META.medlineplus });
  }));

  // ── drugs ──
  app.get("/api/drugs", wrap((req, res) => {
    const q = String(req.query.q || "");
    const letter = String(req.query.letter || "").slice(0, 1).toUpperCase();
    const boxed = req.query.boxed === "1";
    const page = int(req.query.page, 0, 0, 1000);
    const size = 40;
    const f = ftsQuery(q);
    let rows: any[];
    let total: number;
    const cols = "d.slug, d.generic, d.brands, d.epc, d.routes, d.boxed_warning IS NOT NULL boxed, d.mesh_id";
    if (f) {
      rows = all(`SELECT ${cols} FROM drugs_fts x JOIN drugs d ON d.slug=x.slug WHERE drugs_fts MATCH ? ${boxed ? "AND d.boxed_warning IS NOT NULL" : ""} ORDER BY bm25(drugs_fts,0,12,8,3,1) LIMIT ? OFFSET ?`, f, size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM drugs_fts x JOIN drugs d ON d.slug=x.slug WHERE drugs_fts MATCH ? ${boxed ? "AND d.boxed_warning IS NOT NULL" : ""}`, f).n;
    } else {
      const where = [letter ? "upper(d.generic) LIKE ?" : "1", boxed ? "d.boxed_warning IS NOT NULL" : "1"].join(" AND ");
      const params = letter ? [`${letter}%`] : [];
      rows = all(`SELECT ${cols} FROM drugs d WHERE ${where} ORDER BY d.generic COLLATE NOCASE LIMIT ? OFFSET ?`, ...params, size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM drugs d WHERE ${where}`, ...params).n;
    }
    res.json({ total, page, size, rows: rows.map((d) => ({ ...d, brands: parseJSON(d.brands, []), epc: parseJSON(d.epc, []), routes: parseJSON(d.routes, []), boxed: !!d.boxed })) });
  }));

  app.get("/api/drugs/:slug", wrap((req, res) => {
    let d = get<any>("SELECT * FROM drugs WHERE slug=?", req.params.slug);
    if (!d) {
      const alias = get<any>("SELECT canonical FROM drug_alias WHERE slug=?", req.params.slug);
      if (alias) d = get<any>("SELECT * FROM drugs WHERE slug=?", alias.canonical);
    }
    if (!d) return bad(res, "Drug not found", 404);
    const sections = SECTION_LABELS.filter(([k]) => d[k]).map(([k, label]) => ({ key: k, label, text: d[k] as string }));
    // same active ingredient(s): exact normalised key, plus the bare/hydrochloride spelling
    const k: string = d.ikey || "";
    const keys = [k, k.endsWith(" hydrochloride") ? k.slice(0, -14) : `${k} hydrochloride`];
    const productTotal = get<{ n: number }>("SELECT COUNT(*) n FROM ndc WHERE ikey IN (?,?)", ...keys)!.n;
    const products = all("SELECT product_ndc, brand, generic, labeler, dosage_form, route, strength, dea, marketing, product_type FROM ndc WHERE ikey IN (?,?) ORDER BY brand, strength LIMIT 200", ...keys);
    const shortages = all("SELECT generic, presentation, company, status, availability, category, posted, updated, reason FROM shortages WHERE ikey IN (?,?) ORDER BY status, updated DESC LIMIT 60", ...keys);
    let mesh: any = null;
    if (d.mesh_id) {
      const c = get<any>("SELECT id, name, scope_note, pharm_actions FROM concepts WHERE id=?", d.mesh_id);
      if (c) mesh = { id: c.id, name: c.name, scopeNote: c.scope_note, pharmActions: parseJSON<string[]>(c.pharm_actions, []).map((id) => get("SELECT id, name FROM concepts WHERE id=?", id)).filter(Boolean) };
    }
    const questionCount = get<{ n: number }>("SELECT COUNT(*) n FROM questions WHERE concept_id=? OR concept_id=?", d.slug, d.mesh_id || "-")!.n;
    res.json({
      slug: d.slug, generic: d.generic, brands: parseJSON(d.brands, []), routes: parseJSON(d.routes, []), epc: parseJSON(d.epc, []), moa: parseJSON(d.moa, []),
      pe: parseJSON(d.pe, []), cs: parseJSON(d.cs, []), manufacturer: d.manufacturer, effective: d.effective, setId: d.set_id, sections, products, productTotal, shortages, mesh, questionCount,
      source: { name: "FDA Structured Product Labeling via openFDA", url: d.set_id ? DAILYMED + d.set_id : "https://open.fda.gov/apis/drug/label/", effective: d.effective },
    });
  }));

  // ── devices ──
  app.get("/api/devices", wrap((req, res) => {
    const q = String(req.query.q || "");
    const cls = String(req.query.cls || "");
    const specialty = String(req.query.specialty || "");
    const page = int(req.query.page, 0, 0, 1000);
    const size = 40;
    const f = ftsQuery(q);
    const conds: string[] = [];
    const params: unknown[] = [];
    if (cls) { conds.push("d.class=?"); params.push(cls); }
    if (specialty) { conds.push("d.specialty=?"); params.push(specialty); }
    const where = conds.length ? "AND " + conds.join(" AND ") : "";
    let rows: any[];
    let total: number;
    if (f) {
      rows = all(`SELECT d.* FROM devices_fts x JOIN devices d ON d.code=x.code WHERE devices_fts MATCH ? ${where} ORDER BY bm25(devices_fts,0,10,1,1) LIMIT ? OFFSET ?`, f, ...params, size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM devices_fts x JOIN devices d ON d.code=x.code WHERE devices_fts MATCH ? ${where}`, f, ...params).n;
    } else {
      rows = all(`SELECT d.* FROM devices d WHERE 1 ${where} ORDER BY d.name LIMIT ? OFFSET ?`, ...params, size, page * size);
      total = get<any>(`SELECT COUNT(*) n FROM devices d WHERE 1 ${where}`, ...params).n;
    }
    const specialties = all("SELECT specialty v, COUNT(*) n FROM devices WHERE specialty IS NOT NULL AND specialty!='' AND specialty!='Unknown' GROUP BY 1 ORDER BY 1");
    res.json({ total, page, size, rows, specialties, source: META.devices });
  }));
  app.get("/api/devices/:code", wrap((req, res) => {
    const d = get("SELECT * FROM devices WHERE code=?", req.params.code);
    if (!d) return bad(res, "Device not found", 404);
    res.json({ ...d, source: { ...META.devices, url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPCD/classification.cfm?id=${encodeURIComponent(String(req.params.code))}` } });
  }));

  // ── ICD-10-CM ──
  app.get("/api/icd10", wrap((req, res) => {
    const q = String(req.query.q || "");
    const parent = String(req.query.parent || "");
    const chapter = int(req.query.chapter, 0, 0, 30);
    const chapters = all("SELECT c.n, c.start, c.end, c.title, (SELECT COUNT(*) FROM icd10 i WHERE i.chapter=c.n AND i.billable=1) billable FROM icd10_chapters c ORDER BY n");
    if (/^[A-Za-z]\d[0-9A-Za-z](\.?[0-9A-Za-z]{0,4})$/.test(q.trim())) {
      const rows = all("SELECT code, display, title, billable, chapter FROM icd10 WHERE code LIKE ? ORDER BY length(code), code LIMIT 100", q.trim().replace(".", "").toUpperCase() + "%");
      return res.json({ chapters, rows, source: META.icd10 });
    }
    const f = ftsQuery(q);
    if (f) {
      const rows = all("SELECT i.code, i.display, i.title, i.billable, i.chapter FROM icd10_fts x JOIN icd10 i ON i.code=x.code WHERE icd10_fts MATCH ? ORDER BY bm25(icd10_fts,0,20,1), length(i.code) LIMIT 100", f);
      return res.json({ chapters, rows, source: META.icd10 });
    }
    if (parent) return res.json({ chapters, rows: all("SELECT code, display, title, billable, chapter, (SELECT COUNT(*) FROM icd10 c WHERE c.parent=i.code) nchild FROM icd10 i WHERE parent=? ORDER BY code", parent), source: META.icd10 });
    if (chapter) return res.json({ chapters, rows: all("SELECT code, display, title, billable, chapter, (SELECT COUNT(*) FROM icd10 c WHERE c.parent=i.code) nchild FROM icd10 i WHERE chapter=? AND length(code)=3 ORDER BY code", chapter), source: META.icd10 });
    res.json({ chapters, rows: [], source: META.icd10 });
  }));
  app.get("/api/icd10/:code", wrap((req, res) => {
    const code = String(req.params.code).replace(".", "").toUpperCase();
    const r = get<any>("SELECT * FROM icd10 WHERE code=?", code);
    if (!r) return bad(res, "Code not found", 404);
    const ancestors: any[] = [];
    let p = r.parent;
    while (p) {
      const a = get<any>("SELECT code, display, title, parent FROM icd10 WHERE code=?", p);
      if (!a) break;
      ancestors.unshift(a);
      p = a.parent;
    }
    const children = all("SELECT code, display, title, billable FROM icd10 WHERE parent=? ORDER BY code", code);
    const chapter = get("SELECT * FROM icd10_chapters WHERE n=?", r.chapter);
    res.json({ ...r, ancestors, children, chapterInfo: chapter, source: META.icd10 });
  }));

  // ── labs, 3D ──
  app.get("/api/labs", (_req, res) => res.json({ rows: all("SELECT * FROM labs ORDER BY id"), source: META.labs }));
  app.get("/api/anatomy/parts", (_req, res) => res.json({ parts: all("SELECT a.fj, a.fma, a.name, a.system, a.mesh_id, c.name mesh_name FROM anatomy_parts a LEFT JOIN concepts c ON c.id=a.mesh_id ORDER BY a.name"), source: META.anatomy3d }));
  app.get("/api/models", (_req, res) => res.json({ models: all("SELECT m.*, c.name mesh_name, substr(c.scope_note,1,400) mesh_note FROM models m LEFT JOIN concepts c ON c.id=m.mesh_id ORDER BY m.title"), source: META.models }));

  // ── question bank ──
  app.get("/api/questions/facets", (_req, res) => res.json(qFacets));
  app.get("/api/questions/:id", wrap((req, res) => {
    const q = get<QRow>("SELECT * FROM questions WHERE id=?", req.params.id);
    if (!q) return bad(res, "Question not found", 404);
    const answered = rawAppDb.prepare("SELECT 1 FROM attempts WHERE owner=? AND question_id=? LIMIT 1").get(req.owner, q.id);
    res.json(answered ? fullQ(q) : publicQ(q));
  }));

  app.post("/api/questions/count", wrap((req, res) => {
    const p = quizBuildSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const cfg = p.data;
    const conds: string[] = [];
    const params: unknown[] = [];
    for (const [col, vals] of [["system", cfg.systems], ["discipline", cfg.disciplines], ["kind", cfg.kinds]] as const) {
      if (vals.length) { conds.push(`${col} IN (${vals.map(() => "?").join(",")})`); params.push(...vals); }
    }
    if (cfg.conceptId) {
      const cs = cfg.conceptId.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10);
      conds.push(`concept_id IN (${cs.map(() => "?").join(",")})`); params.push(...cs);
    }
    let ids = all<{ id: string }>(`SELECT id FROM questions ${conds.length ? "WHERE " + conds.join(" AND ") : ""}`, ...params).map((r) => r.id);
    if (cfg.pool !== "all") {
      const last = new Map<string, { correct: boolean; flagged: boolean }>();
      for (const a of storage.attemptsFor(req.owner)) last.set(a.questionId, { correct: a.correct, flagged: a.flagged || (last.get(a.questionId)?.flagged ?? false) });
      if (cfg.pool === "unseen") ids = ids.filter((id) => !last.has(id));
      if (cfg.pool === "incorrect") ids = ids.filter((id) => last.get(id)?.correct === false);
      if (cfg.pool === "flagged") ids = ids.filter((id) => last.get(id)?.flagged);
    }
    res.json({ n: ids.length });
  }));

  app.post("/api/quiz/build", wrap((req, res) => {
    const p = quizBuildSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const cfg = p.data;
    const conds: string[] = [];
    const params: unknown[] = [];
    const inList = (col: string, vals: string[]) => {
      if (vals.length) { conds.push(`${col} IN (${vals.map(() => "?").join(",")})`); params.push(...vals); }
    };
    inList("system", cfg.systems);
    inList("discipline", cfg.disciplines);
    inList("kind", cfg.kinds);
    if (cfg.conceptId) inList("concept_id", cfg.conceptId.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10));
    let ids = all<{ id: string }>(`SELECT id FROM questions ${conds.length ? "WHERE " + conds.join(" AND ") : ""}`, ...params).map((r) => r.id);
    const mine = storage.attemptsFor(req.owner);
    if (cfg.pool !== "all") {
      const last = new Map<string, { correct: boolean; flagged: boolean }>();
      for (const a of mine) last.set(a.questionId, { correct: a.correct, flagged: a.flagged || (last.get(a.questionId)?.flagged ?? false) });
      if (cfg.pool === "unseen") ids = ids.filter((id) => !last.has(id));
      if (cfg.pool === "incorrect") ids = ids.filter((id) => last.get(id)?.correct === false);
      if (cfg.pool === "flagged") ids = ids.filter((id) => last.get(id)?.flagged);
    }
    if (!ids.length) return bad(res, "No questions match these filters. Widen the selection or change the pool.", 404);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // Vignettes first get a fair share: interleave so short sets still include clinical cases when selected.
    const chosen = ids.slice(0, cfg.count);
    const session = storage.createSession(req.owner, cfg.mode, cfg, chosen, cfg.mode === "timed" ? chosen.length * 90 : null);
    const questions = chosen.map((id) => publicQ(get<QRow>("SELECT * FROM questions WHERE id=?", id)!));
    res.json({ session: { id: session.id, mode: session.mode, startedAt: session.startedAt, timeLimitSec: session.timeLimitSec }, questions, available: ids.length });
  }));

  app.post("/api/quiz/answer", wrap((req, res) => {
    const p = answerSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const q = get<QRow>("SELECT * FROM questions WHERE id=?", p.data.questionId);
    if (!q) return bad(res, "Question not found", 404);
    const opts = parseJSON<string[]>(q.options, []);
    if (p.data.choice >= opts.length) return bad(res, "Invalid choice");
    if (p.data.sessionId != null && !storage.getSession(req.owner, p.data.sessionId)) return bad(res, "Session not found", 404);
    const stats = peerStmt.get(q.id) as { n: number; c: number | null };
    const correct = p.data.choice === q.answer;
    storage.addAttempt({
      owner: req.owner, sessionId: p.data.sessionId ?? null, questionId: q.id, choice: p.data.choice, correct, timeMs: p.data.timeMs,
      system: q.system, discipline: q.discipline, kind: q.kind, flagged: !!p.data.flagged, createdAt: Date.now(),
    });
    res.json({ ...fullQ(q), correct, choice: p.data.choice, peer: { answered: stats.n, pctCorrect: stats.n ? Math.round(((stats.c || 0) / stats.n) * 100) : null } });
  }));

  app.post("/api/quiz/sessions/:id/finish", wrap((req, res) => {
    const id = int(req.params.id, 0);
    const s = storage.getSession(req.owner, id);
    if (!s) return bad(res, "Session not found", 404);
    storage.finishSession(req.owner, id);
    res.json({ ok: true });
  }));

  app.get("/api/quiz/sessions", wrap((req, res) => {
    const sessions = storage.listSessions(req.owner).map((s) => {
      const at = storage.sessionAttempts(req.owner, s.id);
      const ids = parseJSON<string[]>(s.questionIds, []);
      return { id: s.id, mode: s.mode, startedAt: s.startedAt, finishedAt: s.finishedAt, total: ids.length, answered: at.length, correct: at.filter((a) => a.correct).length, config: parseJSON(s.config, {}) };
    });
    res.json({ sessions });
  }));

  app.get("/api/quiz/sessions/:id", wrap((req, res) => {
    const s = storage.getSession(req.owner, int(req.params.id, 0));
    if (!s) return bad(res, "Session not found", 404);
    const at = new Map(storage.sessionAttempts(req.owner, s.id).map((a) => [a.questionId, a]));
    const items = parseJSON<string[]>(s.questionIds, []).map((id) => {
      const q = get<QRow>("SELECT * FROM questions WHERE id=?", id)!;
      const a = at.get(id);
      const st = peerStmt.get(id) as { n: number; c: number | null };
      return { question: a || s.finishedAt ? fullQ(q) : publicQ(q), attempt: a ? { choice: a.choice, correct: a.correct, timeMs: a.timeMs, flagged: a.flagged } : null, peer: { answered: st.n, pctCorrect: st.n ? Math.round(((st.c || 0) / st.n) * 100) : null } };
    });
    res.json({ session: { id: s.id, mode: s.mode, startedAt: s.startedAt, finishedAt: s.finishedAt, timeLimitSec: s.timeLimitSec, config: parseJSON(s.config, {}) }, items });
  }));

  app.get("/api/analytics", wrap((req, res) => {
    const at = storage.attemptsFor(req.owner);
    const firstTry = new Map<string, (typeof at)[number]>();
    for (const a of at) if (!firstTry.has(a.questionId)) firstTry.set(a.questionId, a);
    const group = (key: "system" | "discipline" | "kind") => {
      const m = new Map<string, { n: number; c: number; t: number }>();
      for (const a of at) {
        const g = m.get(a[key]) || { n: 0, c: 0, t: 0 };
        g.n++; g.c += a.correct ? 1 : 0; g.t += a.timeMs;
        m.set(a[key], g);
      }
      return Array.from(m, ([k, g]) => ({ key: k, answered: g.n, correct: g.c, pct: Math.round((g.c / g.n) * 100), avgSec: Math.round(g.t / g.n / 100) / 10 })).sort((a, b) => b.answered - a.answered);
    };
    const days = new Map<string, { n: number; c: number }>();
    for (const a of at) {
      const d = new Date(a.createdAt).toISOString().slice(0, 10);
      const g = days.get(d) || { n: 0, c: 0 };
      g.n++; g.c += a.correct ? 1 : 0;
      days.set(d, g);
    }
    const daily = Array.from(days, ([date, g]) => ({ date, answered: g.n, pct: Math.round((g.c / g.n) * 100) })).sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (days.has(d)) streak++;
      else if (i > 0) break;
      else continue;
    }
    const total = at.length;
    const correct = at.filter((a) => a.correct).length;
    const ftCorrect = Array.from(firstTry.values()).filter((a) => a.correct).length;
    const bank = counts.questions;
    res.json({
      total, correct, pct: total ? Math.round((correct / total) * 100) : null,
      firstTryPct: firstTry.size ? Math.round((ftCorrect / firstTry.size) * 100) : null,
      unique: firstTry.size, bank, avgSec: total ? Math.round(at.reduce((s, a) => s + a.timeMs, 0) / total / 100) / 10 : null,
      streak, bySystem: group("system"), byDiscipline: group("discipline"), byKind: group("kind"), daily,
      recent: at.slice(-12).reverse().map((a) => ({ questionId: a.questionId, correct: a.correct, system: a.system, at: a.createdAt })),
    });
  }));
  app.post("/api/analytics/reset", wrap((req, res) => {
    storage.resetProgress(req.owner);
    res.json({ ok: true });
  }));

  // ── flashcards (SM-2) ──
  app.get("/api/cards", wrap((req, res) => {
    const cards = storage.cards(req.owner);
    const now = Date.now();
    res.json({ cards, due: cards.filter((c) => c.due <= now).length, decks: Array.from(new Set(cards.map((c) => c.deck))) });
  }));
  app.get("/api/cards/due", wrap((req, res) => res.json({ cards: storage.dueCards(req.owner, Date.now()) })));
  app.post("/api/cards", wrap((req, res) => {
    const p = insertFlashcardSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    res.json(storage.addCard(req.owner, p.data));
  }));
  app.post("/api/cards/:id/review", wrap((req, res) => {
    const g = z.object({ grade: z.number().int().min(0).max(5) }).safeParse(req.body);
    if (!g.success) return bad(res, g.error);
    const c = storage.reviewCard(req.owner, int(req.params.id, 0), g.data.grade);
    if (!c) return bad(res, "Card not found", 404);
    res.json(c);
  }));
  app.delete("/api/cards/:id", wrap((req, res) => {
    storage.deleteCard(req.owner, int(req.params.id, 0));
    res.json({ ok: true });
  }));

  // ── bookmarks & notes ──
  app.get("/api/bookmarks", wrap((req, res) => res.json({ bookmarks: storage.bookmarks(req.owner) })));
  app.post("/api/bookmarks", wrap((req, res) => {
    const p = insertBookmarkSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    res.json(storage.addBookmark(req.owner, p.data));
  }));
  app.delete("/api/bookmarks/:id", wrap((req, res) => {
    storage.deleteBookmark(req.owner, int(req.params.id, 0));
    res.json({ ok: true });
  }));
  app.get("/api/notes", wrap((req, res) => res.json({ notes: storage.notes(req.owner) })));
  app.post("/api/notes", wrap((req, res) => {
    const p = insertNoteSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    res.json(storage.addNote(req.owner, p.data));
  }));
  app.patch("/api/notes/:id", wrap((req, res) => {
    const p = insertNoteSchema.partial().safeParse(req.body);
    if (!p.success) return bad(res, p.error);
    const n = storage.updateNote(req.owner, int(req.params.id, 0), p.data);
    if (!n) return bad(res, "Note not found", 404);
    res.json(n);
  }));
  app.delete("/api/notes/:id", wrap((req, res) => {
    storage.deleteNote(req.owner, int(req.params.id, 0));
    res.json({ ok: true });
  }));

  // ── research: PubMed (NCBI E-utilities) and ClinicalTrials.gov v2 ──
  const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  app.get("/api/pubmed", wrap(async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 300);
    if (!q) return res.json({ total: 0, items: [] });
    const page = int(req.query.page, 0, 0, 50);
    const types = list(req.query.types);
    const years = int(req.query.years, 0, 0, 50);
    let term = q;
    if (types.length) term += " AND (" + types.map((t) => `"${t.replace(/"/g, "")}"[pt]`).join(" OR ") + ")";
    if (years) term += ` AND ("${new Date().getFullYear() - years}"[dp] : "3000"[dp])`;
    const s = await cachedJson(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=20&retstart=${page * 20}&sort=relevance&tool=vesalius&term=${encodeURIComponent(term)}`);
    const ids: string[] = s.esearchresult?.idlist || [];
    if (!ids.length) return res.json({ total: Number(s.esearchresult?.count || 0), items: [] });
    const sum = await cachedJson(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&tool=vesalius&id=${ids.join(",")}`);
    const items = ids.map((id) => {
      const d = sum.result?.[id] || {};
      return {
        pmid: id, title: d.title, journal: d.fulljournalname || d.source, pubdate: d.pubdate, authors: (d.authors || []).slice(0, 6).map((a: any) => a.name),
        types: d.pubtype || [], doi: (d.articleids || []).find((a: any) => a.idtype === "doi")?.value, pmc: (d.articleids || []).find((a: any) => a.idtype === "pmc")?.value,
      };
    });
    res.json({ total: Number(s.esearchresult?.count || 0), items, term });
  }));
  app.get("/api/pubmed/:pmid", wrap(async (req, res) => {
    const pmid = String(req.params.pmid).replace(/\D/g, "");
    if (!pmid) return bad(res, "Invalid PMID");
    const xml: string = await cachedJson(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&tool=vesalius&id=${pmid}`, 60 * 60 * 1000, true);
    const decode = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const abstract = Array.from(xml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)).map((m) => {
      const label = /Label="([^"]+)"/.exec(m[1])?.[1];
      return { label: label || null, text: decode(m[2]) };
    });
    const mesh = Array.from(xml.matchAll(/<DescriptorName UI="(D\d+)"[^>]*>([^<]+)<\/DescriptorName>/g)).map((m) => ({ id: m[1], name: m[2] }));
    const title = decode(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/.exec(xml)?.[1] || "");
    if (!title) return bad(res, "Article not found", 404);
    const journal = decode(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/.exec(xml)?.[1] || "");
    const year = /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/.exec(xml)?.[1] || /<MedlineDate>(\d{4})/.exec(xml)?.[1] || "";
    const authors = Array.from(xml.matchAll(/<Author[^>]*>\s*<LastName>([^<]+)<\/LastName>[\s\S]*?(?:<Initials>([^<]+)<\/Initials>)?[\s\S]*?<\/Author>/g)).map((m) => `${m[1]} ${m[2] || ""}`.trim());
    const doi = /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/.exec(xml)?.[1] || null;
    const pmc = /<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/.exec(xml)?.[1] || null;
    const types = Array.from(xml.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)).map((m) => m[1]);
    res.json({ pmid, title, abstract, mesh, journal, year, authors, doi, pmc, types, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
  }));
  app.get("/api/trials", wrap(async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 200);
    if (!q) return res.json({ items: [] });
    const status = String(req.query.status || "");
    const token = String(req.query.token || "");
    let url = `https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=20&countTotal=true&query.term=${encodeURIComponent(q)}`;
    if (status) url += `&filter.overallStatus=${encodeURIComponent(status)}`;
    if (token) url += `&pageToken=${encodeURIComponent(token)}`;
    const d = await cachedJson(url);
    const items = (d.studies || []).map((s: any) => {
      const p = s.protocolSection || {};
      return {
        nctId: p.identificationModule?.nctId, title: p.identificationModule?.briefTitle, status: p.statusModule?.overallStatus,
        phases: p.designModule?.phases || [], type: p.designModule?.studyType, conditions: p.conditionsModule?.conditions || [],
        interventions: (p.armsInterventionsModule?.interventions || []).map((i: any) => `${i.type}: ${i.name}`).slice(0, 5),
        sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name, start: p.statusModule?.startDateStruct?.date, enrollment: p.designModule?.enrollmentInfo?.count,
        summary: p.descriptionModule?.briefSummary?.slice(0, 600),
      };
    });
    res.json({ total: d.totalCount, items, nextToken: d.nextPageToken || null });
  }));

  return httpServer;
}
