// Admin panel backend: roles, moderation, overlays on the read-only content DB, data-update jobs and URL import.
// All admin edits live in app.db so content.db can be rebuilt by the ETL without losing them.
import type { Express, Request, Response, NextFunction } from "express";
import { randomBytes, scryptSync } from "node:crypto";
import { z } from "zod";
import { rawAppDb as db } from "./storage";
import { all, get, parseJSON } from "./content";

const UA = "VesaliusMedStudy/1.0 (https://github.com/muhammadanas702/medical-study-web-app-; educational use)";

// ── schema ──
db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, user_id INTEGER, user_email TEXT, action TEXT NOT NULL, target TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, owner TEXT, user_email TEXT, type TEXT NOT NULL, ref_id TEXT NOT NULL, title TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', admin_note TEXT, resolved_at INTEGER);
CREATE TABLE IF NOT EXISTS question_overrides(id TEXT PRIMARY KEY, data TEXT, disabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS custom_questions(id TEXT PRIMARY KEY, data TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS figure_hotspots(figure_id INTEGER PRIMARY KEY, hotspots TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT);
CREATE TABLE IF NOT EXISTS anatomy_overrides(fj TEXT PRIMARY KEY, description TEXT NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT);
CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, items INTEGER NOT NULL DEFAULT 0, log TEXT NOT NULL DEFAULT '', params TEXT, started_by TEXT);
CREATE TABLE IF NOT EXISTS feed_items(id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT NOT NULL, key TEXT NOT NULL, title TEXT NOT NULL, url TEXT, summary TEXT, published TEXT, data TEXT, fetched_at INTEGER NOT NULL, UNIQUE(job, key));
CREATE INDEX IF NOT EXISTS feed_job ON feed_items(job, published);
CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT, subject TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, created_by TEXT, robots TEXT);
`);
for (const col of ["role TEXT NOT NULL DEFAULT 'student'", "suspended INTEGER NOT NULL DEFAULT 0", "last_seen INTEGER"]) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* exists */ }
}
// Installs created before roles existed have no administrator: promote the earliest account once.
if (!(db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get() as any).n) {
  const first = db.prepare("SELECT id, email FROM users ORDER BY id LIMIT 1").get() as any;
  if (first) { db.prepare("UPDATE users SET role='admin' WHERE id=?").run(first.id); console.log(`[admin] no administrator found; promoted the first account (${first.email})`); }
}
// mark jobs that were running when the server stopped
db.prepare("UPDATE jobs SET status='failed', log=log || '\nServer restarted while running.', finished_at=? WHERE status='running'").run(Date.now());

// ── settings ──
export const DEFAULT_SETTINGS = {
  announcement: "",
  announcementLevel: "info" as "info" | "warning",
  features: { atlas: true, organs: true, pathogens: true, equipment: true, diagrams: true, books: true, figures: true, molecules: true, qbank: true, flashcards: true, research: true, updates: true, articles: true },
  pubmedTerms: "cardiology,infectious diseases,oncology,neurology,endocrinology,nephrology,gastroenterology,pulmonology,hematology,pediatrics,obstetrics,psychiatry,pharmacology",
  registrationOpen: true,
};
export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s: any = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const r of rows) {
    const v = parseJSON<any>(r.value, null);
    if (r.key === "features") s.features = { ...s.features, ...(v || {}) };
    else if (v !== null) s[r.key] = v;
  }
  return s as typeof DEFAULT_SETTINGS;
}

// ── users / roles ──
export function userRole(id: number): { role: string; suspended: boolean } {
  const r = db.prepare("SELECT role, suspended FROM users WHERE id=?").get(id) as any;
  return { role: r?.role || "student", suspended: !!r?.suspended };
}
/** The very first account on a fresh install becomes the administrator. */
export function promoteIfFirst(id: number) {
  const n = (db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get() as any).n;
  if (n === 0) db.prepare("UPDATE users SET role='admin' WHERE id=?").run(id);
}
export function touchUser(id: number) {
  db.prepare("UPDATE users SET last_seen=? WHERE id=?").run(Date.now(), id);
}

export function audit(req: Request, action: string, target?: string, detail?: unknown) {
  db.prepare("INSERT INTO audit_log(at, user_id, user_email, action, target, detail) VALUES(?,?,?,?,?,?)").run(
    Date.now(), req.user?.id ?? null, req.user?.email ?? null, action, target ?? null, detail === undefined ? null : JSON.stringify(detail).slice(0, 4000),
  );
}

// ── question overlay (used by the quiz engine) ──
export type QRow = { id: string; kind: string; discipline: string; system: string; stem: string; ask: string; options: string; answer: number; explanation: string; rationales: string; objective: string; concept_id: string | null; source: string; source_url: string | null };
const QFIELDS = ["kind", "discipline", "system", "stem", "ask", "options", "answer", "explanation", "rationales", "objective", "concept_id", "source", "source_url"] as const;

function overlayRow(base: QRow, data: any): QRow {
  const out: any = { ...base };
  for (const k of QFIELDS) {
    if (data?.[k] === undefined) continue;
    out[k] = k === "options" || k === "rationales" ? JSON.stringify(data[k]) : data[k];
  }
  return out;
}
export function loadQ(id: string): QRow | undefined {
  if (id.startsWith("c-")) {
    const r = db.prepare("SELECT data FROM custom_questions WHERE id=?").get(id) as any;
    if (!r) return undefined;
    const d = parseJSON<any>(r.data, {});
    return overlayRow({ id, kind: "custom", discipline: "", system: "", stem: "", ask: "", options: "[]", answer: 0, explanation: "", rationales: "[]", objective: "", concept_id: null, source: "Vesalius editors", source_url: null }, d);
  }
  const q = get<QRow>("SELECT * FROM questions WHERE id=?", id);
  if (!q) return undefined;
  const o = db.prepare("SELECT data FROM question_overrides WHERE id=?").get(id) as any;
  return o?.data ? overlayRow(q, parseJSON(o.data, {})) : q;
}
export function disabledIds(): Set<string> {
  return new Set((db.prepare("SELECT id FROM question_overrides WHERE disabled=1").all() as any[]).map((r) => r.id));
}
/** Custom (editor-written) questions that match the quiz filters. */
export function customIds(filter: { systems: string[]; disciplines: string[]; kinds: string[]; conceptIds?: string[] }): string[] {
  const rows = db.prepare("SELECT id, data FROM custom_questions WHERE disabled=0").all() as any[];
  return rows.filter((r) => {
    const d = parseJSON<any>(r.data, {});
    if (filter.systems.length && !filter.systems.includes(d.system)) return false;
    if (filter.disciplines.length && !filter.disciplines.includes(d.discipline)) return false;
    if (filter.kinds.length && !filter.kinds.includes("custom")) return false;
    if (filter.conceptIds?.length && !filter.conceptIds.includes(d.concept_id)) return false;
    return true;
  }).map((r) => r.id);
}

// ── public helpers used by other routes ──
export function figureHotspots(id: number) {
  const r = db.prepare("SELECT hotspots, updated_at FROM figure_hotspots WHERE figure_id=?").get(id) as any;
  return r ? { hotspots: parseJSON<any[]>(r.hotspots, []), updatedAt: r.updated_at } : { hotspots: [], updatedAt: null };
}
export function annotatedFigureIds(): number[] {
  return (db.prepare("SELECT figure_id FROM figure_hotspots WHERE hotspots != '[]' ORDER BY updated_at DESC").all() as any[]).map((r) => r.figure_id);
}
export function anatomyOverride(fj: string) {
  return db.prepare("SELECT description, updated_at FROM anatomy_overrides WHERE fj=?").get(fj) as { description: string; updated_at: number } | undefined;
}
export function feed(job: string, limit = 50, q = "") {
  const rows = q
    ? db.prepare("SELECT * FROM feed_items WHERE job=? AND (title LIKE ? OR summary LIKE ?) ORDER BY published DESC, id DESC LIMIT ?").all(job, `%${q}%`, `%${q}%`, limit)
    : db.prepare("SELECT * FROM feed_items WHERE job=? ORDER BY published DESC, id DESC LIMIT ?").all(job, limit);
  return (rows as any[]).map((r) => ({ ...r, data: parseJSON(r.data, null) }));
}
export function feedItem(job: string, key: string) {
  const r = db.prepare("SELECT * FROM feed_items WHERE job=? AND key=?").get(job, key) as any;
  return r ? { ...r, data: parseJSON(r.data, null) } : undefined;
}

// ── jobs ──
type JobCtx = { id: number; log: (s: string) => void; put: (job: string, key: string, title: string, url: string | null, summary: string | null, published: string | null, data?: unknown) => void; params: any };
const putStmt = db.prepare(`INSERT INTO feed_items(job, key, title, url, summary, published, data, fetched_at) VALUES(?,?,?,?,?,?,?,?)
  ON CONFLICT(job, key) DO UPDATE SET title=excluded.title, url=excluded.url, summary=excluded.summary, published=excluded.published, data=excluded.data, fetched_at=excluded.fetched_at`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchJson(url: string, tries = 3): Promise<any> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.split("?")[0]}`);
      return await r.json();
    } catch (e) { last = e; await sleep(800 * (i + 1)); }
  }
  throw last;
}
async function fetchText(url: string): Promise<{ status: number; text: string; type: string }> {
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30000) });
  return { status: r.status, text: await r.text(), type: r.headers.get("content-type") || "" };
}
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export const JOBS: Record<string, { title: string; source: string; description: string; run: (c: JobCtx) => Promise<number> }> = {
  pubmed: {
    title: "PubMed: latest reviews and guidelines",
    source: "NCBI E-utilities (https://www.ncbi.nlm.nih.gov/books/NBK25501/)",
    description: "Fetches review articles, systematic reviews, meta-analyses and practice guidelines published in the last 60 days for each subject in Settings > PubMed subjects.",
    async run(c) {
      const terms = String(c.params?.terms || getSettings().pubmedTerms).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
      const E = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
      let n = 0;
      for (const t of terms) {
        const term = `(${t}[MeSH Major Topic] OR ${t}[Title]) AND (review[pt] OR systematic review[pt] OR meta-analysis[pt] OR practice guideline[pt] OR guideline[pt]) AND "last 60 days"[dp] AND english[la]`;
        const s = await fetchJson(`${E}/esearch.fcgi?db=pubmed&retmode=json&retmax=25&sort=pub_date&tool=vesalius&term=${encodeURIComponent(term)}`);
        const ids: string[] = s?.esearchresult?.idlist || [];
        await sleep(400);
        if (!ids.length) { c.log(`${t}: 0`); continue; }
        const sum = await fetchJson(`${E}/esummary.fcgi?db=pubmed&retmode=json&tool=vesalius&id=${ids.join(",")}`);
        await sleep(400);
        for (const id of ids) {
          const d = sum?.result?.[id];
          if (!d?.title) continue;
          c.put("pubmed", id, strip(d.title), `https://pubmed.ncbi.nlm.nih.gov/${id}/`, `${d.fulljournalname || d.source || ""}`, d.sortpubdate?.slice(0, 10).replace(/\//g, "-") || d.pubdate, {
            subject: t, types: d.pubtype || [], authors: (d.authors || []).slice(0, 4).map((a: any) => a.name), doi: (d.articleids || []).find((a: any) => a.idtype === "doi")?.value,
          });
          n++;
        }
        c.log(`${t}: ${ids.length}`);
      }
      return n;
    },
  },
  fda_labels: {
    title: "openFDA: recently updated drug labels",
    source: "openFDA drug label API (https://open.fda.gov/apis/drug/label/)",
    description: "Lists prescription drug labels (SPL) with an effective date in the last 120 days (openFDA publishes weekly with some lag), so you can see which monographs changed since the database was built.",
    async run(c) {
      const to = new Date(); const from = new Date(Date.now() - 120 * 86400000);
      let n = 0;
      for (let skip = 0; skip < 1000; skip += 100) {
        const d = await fetchJson(`https://api.fda.gov/drug/label.json?search=effective_time:%5B${ymd(from)}+TO+${ymd(to)}%5D+AND+openfda.product_type:%22HUMAN+PRESCRIPTION+DRUG%22&limit=100&skip=${skip}`);
        const rows = d?.results || [];
        for (const r of rows) {
          const g = r.openfda?.generic_name?.[0] || r.openfda?.brand_name?.[0];
          if (!g) continue;
          const eff = String(r.effective_time || "");
          c.put("fda_labels", r.set_id || r.id, g, r.set_id ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.set_id}` : null,
            (r.indications_and_usage?.[0] || "").slice(0, 400), `${eff.slice(0, 4)}-${eff.slice(4, 6)}-${eff.slice(6, 8)}`,
            { brand: r.openfda?.brand_name || [], manufacturer: r.openfda?.manufacturer_name?.[0], boxed: !!r.boxed_warning, version: r.version });
          n++;
        }
        if (rows.length < 100) break;
        await sleep(300);
      }
      c.log(`${n} labels effective since ${from.toISOString().slice(0, 10)}`);
      return n;
    },
  },
  fda_shortages: {
    title: "openFDA: current drug shortages",
    source: "openFDA drug shortages API (https://open.fda.gov/apis/drug/drugshortages/)",
    description: "Refreshes the list of drug shortages that FDA currently reports as ongoing.",
    async run(c) {
      let n = 0;
      db.prepare("DELETE FROM feed_items WHERE job='fda_shortages'").run();
      for (let skip = 0; skip < 3000; skip += 1000) {
        const d = await fetchJson(`https://api.fda.gov/drug/shortages.json?search=status:%22Current%22&limit=1000&skip=${skip}`);
        const rows = d?.results || [];
        for (const r of rows) {
          const key = `${r.generic_name}|${r.presentation || r.package_ndc || n}`;
          c.put("fda_shortages", key, r.generic_name || "Unknown", "https://www.accessdata.fda.gov/scripts/drugshortages/default.cfm",
            [r.presentation, r.availability, r.shortage_reason].filter(Boolean).join(" \u2014 ").slice(0, 400), r.update_date || r.initial_posting_date || null,
            { company: r.company_name, category: r.therapeutic_category || [], status: r.status });
          n++;
        }
        if (rows.length < 1000) break;
      }
      c.log(`${n} current shortage rows`);
      return n;
    },
  },
  trials: {
    title: "ClinicalTrials.gov: newly updated recruiting trials",
    source: "ClinicalTrials.gov API v2 (https://clinicaltrials.gov/data-api/api)",
    description: "Fetches the most recently updated interventional trials that are recruiting, for each PubMed subject.",
    async run(c) {
      const terms = getSettings().pubmedTerms.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
      let n = 0;
      for (const t of terms) {
        const d = await fetchJson(`https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=20&query.cond=${encodeURIComponent(t)}&filter.overallStatus=RECRUITING&sort=LastUpdatePostDate:desc`);
        for (const s of d?.studies || []) {
          const p = s.protocolSection || {};
          const id = p.identificationModule?.nctId;
          if (!id) continue;
          c.put("trials", id, p.identificationModule?.briefTitle || id, `https://clinicaltrials.gov/study/${id}`, (p.descriptionModule?.briefSummary || "").slice(0, 500),
            p.statusModule?.lastUpdatePostDateStruct?.date || null, { subject: t, phases: p.designModule?.phases || [], conditions: (p.conditionsModule?.conditions || []).slice(0, 6), sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name });
          n++;
        }
        c.log(`${t}: ${(d?.studies || []).length}`);
        await sleep(300);
      }
      return n;
    },
  },
  medlineplus: {
    title: "MedlinePlus: health topic updates",
    source: "MedlinePlus Web Service (https://medlineplus.gov/about/developers/webservices/)",
    description: "Re-checks MedlinePlus health-topic summaries for the subjects in Settings and stores the current summary text.",
    async run(c) {
      const terms = getSettings().pubmedTerms.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
      let n = 0;
      for (const t of terms) {
        const r = await fetchText(`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=10&term=${encodeURIComponent(t)}`);
        for (const m of Array.from(r.text.matchAll(/<document rank="\d+" url="([^"]+)">([\s\S]*?)<\/document>/g))) {
          const title = strip(/<content name="title">([\s\S]*?)<\/content>/.exec(m[2])?.[1] || "");
          const summary = strip(/<content name="FullSummary">([\s\S]*?)<\/content>/.exec(m[2])?.[1] || "").slice(0, 1200);
          if (!title) continue;
          c.put("medlineplus", m[1], title, m[1], summary, new Date().toISOString().slice(0, 10), { subject: t });
          n++;
        }
        c.log(`${t}: done`);
        await sleep(400);
      }
      return n;
    },
  },
  wikipedia: {
    title: "Wikipedia: refresh anatomy article summaries",
    source: "Wikipedia REST API (https://en.wikipedia.org/api/rest_v1/), CC BY-SA 4.0",
    description: "Re-downloads the current lead summary of anatomy articles linked to 3D parts, so descriptions track the latest revision.",
    async run(c) {
      const limit = Math.min(Number(c.params?.limit) || 150, 800);
      const titles = all<{ title: string }>("SELECT title FROM anatomy_wiki ORDER BY title").map((r) => r.title);
      const done = new Set((db.prepare("SELECT key FROM feed_items WHERE job='wikipedia' AND fetched_at > ?").all(Date.now() - 7 * 86400000) as any[]).map((r) => r.key));
      let n = 0;
      for (const t of titles.filter((x) => !done.has(x)).slice(0, limit)) {
        const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`).catch(() => null);
        if (d?.extract) {
          c.put("wikipedia", t, d.title || t, d.content_urls?.desktop?.page || null, d.extract, (d.timestamp || "").slice(0, 10), { revision: d.revision });
          n++;
        }
        await sleep(120);
      }
      c.log(`${n} summaries refreshed (limit ${limit}); run again to continue`);
      return n;
    },
  },
  pubchem: {
    title: "PubChem: link drugs without a structure",
    source: "PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest), public domain",
    description: "For FDA-labelled drugs that have no PubChem compound yet, looks up the ingredient name and stores CID, formula, weight, IUPAC name and SMILES.",
    async run(c) {
      const limit = Math.min(Number(c.params?.limit) || 150, 1000);
      let missing: { slug: string; generic: string }[] = [];
      try {
        missing = all("SELECT d.slug, d.generic FROM drugs d WHERE NOT EXISTS (SELECT 1 FROM drug_compounds x WHERE x.slug=d.slug) ORDER BY d.generic");
      } catch { missing = all("SELECT slug, generic FROM drugs ORDER BY generic"); }
      const done = new Set((db.prepare("SELECT key FROM feed_items WHERE job='pubchem'").all() as any[]).map((r) => r.key));
      let n = 0;
      for (const d of missing.filter((m) => !done.has(m.slug)).slice(0, limit)) {
        const name = d.generic.split(/\s+(?:and|\+)\s+|,\s*/i)[0].replace(/\b(hydrochloride|hcl|sodium|potassium|sulfate|mesylate|maleate|tartrate|citrate|phosphate|acetate)\b/gi, "").trim();
        const ids = await fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`).catch(() => null);
        const cid = ids?.IdentifierList?.CID?.[0];
        await sleep(250);
        if (!cid) { c.put("pubchem", d.slug, d.generic, null, "No PubChem match", null, { cid: null }); continue; }
        const p = await fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,SMILES,InChIKey/JSON`).catch(() => null);
        const pr = p?.PropertyTable?.Properties?.[0] || {};
        c.put("pubchem", d.slug, d.generic, `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, `${pr.MolecularFormula || ""} \u00b7 ${pr.MolecularWeight || ""} g/mol`, new Date().toISOString().slice(0, 10), { cid, ...pr });
        n++;
        await sleep(250);
      }
      c.log(`${n} drugs linked to PubChem compounds`);
      return n;
    },
  },
  openstax: {
    title: "OpenStax: check textbooks for new revisions",
    source: "GitHub API for openstax/osbooks-* repositories (CC BY-NC-SA 4.0 / CC BY 4.0 content)",
    description: "Compares each imported OpenStax book with the latest commit on GitHub and reports which books have new revisions to import with etl/openstax.py.",
    async run(c) {
      let n = 0;
      for (const b of all<any>("SELECT slug, title, repo, sha, updated FROM books ORDER BY ord")) {
        let repo = String(b.repo || "").replace(/^https:\/\/github.com\//, "");
        if (repo && !repo.includes("/")) repo = `openstax/${repo}`;
        if (!repo) continue;
        const d = await fetchJson(`https://api.github.com/repos/${repo}/commits?per_page=1`).catch(() => null);
        const head = d?.[0];
        if (!head) { c.log(`${b.title}: could not check`); continue; }
        const changed = head.sha !== b.sha;
        c.put("openstax", b.slug, b.title, `https://github.com/${repo}/commits`, changed ? `New revision available: ${head.commit?.message?.split("\n")[0] || head.sha.slice(0, 7)}` : "Up to date",
          (head.commit?.committer?.date || "").slice(0, 10), { imported: b.sha, latest: head.sha, changed });
        c.log(`${b.title}: ${changed ? "update available" : "up to date"}`);
        n++;
        await sleep(300);
      }
      return n;
    },
  },
};

const running = new Set<string>();
export function startJob(type: string, params: any, by: string | null): number {
  const def = JOBS[type];
  if (!def) throw Object.assign(new Error("Unknown job"), { status: 404 });
  if (running.has(type)) throw Object.assign(new Error("This job is already running"), { status: 409 });
  const id = Number(db.prepare("INSERT INTO jobs(type, status, started_at, params, started_by) VALUES(?, 'running', ?, ?, ?)").run(type, Date.now(), JSON.stringify(params || {}), by).lastInsertRowid);
  const logLines: string[] = [];
  const flush = () => db.prepare("UPDATE jobs SET log=? WHERE id=?").run(logLines.join("\n").slice(-20000), id);
  let items = 0;
  const ctx: JobCtx = {
    id, params,
    log: (s) => { logLines.push(`[${new Date().toISOString().slice(11, 19)}] ${s}`); flush(); },
    put: (job, key, title, url, summary, published, data) => { putStmt.run(job, key, title.slice(0, 500), url, summary, published, data === undefined ? null : JSON.stringify(data), Date.now()); items++; },
  };
  running.add(type);
  ctx.log(`Started: ${def.title}`);
  def.run(ctx).then((n) => {
    ctx.log(`Finished: ${n} items`);
    db.prepare("UPDATE jobs SET status='done', finished_at=?, items=? WHERE id=?").run(Date.now(), n, id);
  }).catch((e) => {
    ctx.log(`Error: ${e?.message || e}`);
    db.prepare("UPDATE jobs SET status='failed', finished_at=?, items=? WHERE id=?").run(Date.now(), items, id);
  }).finally(() => running.delete(type));
  return id;
}

// ── URL import (robots.txt aware) ──
async function robotsAllows(url: URL): Promise<{ allowed: boolean; note: string }> {
  try {
    const r = await fetchText(`${url.protocol}//${url.host}/robots.txt`);
    if (r.status >= 400) return { allowed: true, note: `robots.txt not found (HTTP ${r.status})` };
    // collect rules for "*" and our agent
    let applies = false; const rules: { allow: boolean; path: string }[] = [];
    for (const raw of r.text.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const k = m[1].toLowerCase(); const v = m[2].trim();
      if (k === "user-agent") applies = v === "*" || /vesalius/i.test(v);
      else if (applies && (k === "disallow" || k === "allow") && v) rules.push({ allow: k === "allow", path: v });
    }
    const p = url.pathname + url.search;
    const match = rules.filter((x) => p.startsWith(x.path.replace(/\*.*$/, ""))).sort((a, b) => b.path.length - a.path.length)[0];
    if (match && !match.allow) return { allowed: false, note: `Blocked by robots.txt rule "Disallow: ${match.path}"` };
    return { allowed: true, note: match ? `Allowed by "Allow: ${match.path}"` : "No robots.txt rule blocks this path" };
  } catch (e: any) {
    return { allowed: true, note: `robots.txt unreachable (${e?.message || e})` };
  }
}
function readable(html: string): { title: string; text: string; license: string | null } {
  const title = strip(/<meta property="og:title" content="([^"]+)"/i.exec(html)?.[1] || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "Untitled");
  const lic = /rel="license"[^>]*href="([^"]+)"/i.exec(html)?.[1] || /creativecommons\.org\/licenses\/[a-z-]+\/[\d.]+/i.exec(html)?.[0] || null;
  let body = html.replace(/<(script|style|nav|header|footer|aside|form|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  const main = /<(article|main)[^>]*>([\s\S]*?)<\/\1>/i.exec(body)?.[2];
  if (main) body = main;
  const blocks = Array.from(body.matchAll(/<(h[1-4]|p|li|td|th|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi)).map((m) => {
    const t = strip(m[2]);
    if (!t) return "";
    return m[1].toLowerCase().startsWith("h") ? `\n## ${t}\n` : m[1].toLowerCase() === "li" ? `- ${t}` : t;
  }).filter(Boolean);
  return { title, text: blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 200000), license: lic };
}

// ── routes ──
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Sign in with an administrator account" });
  if (userRole(req.user.id).role !== "admin") return res.status(403).json({ message: "Administrator access required" });
  next();
}
const w = (fn: (req: Request<Record<string, string>>, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  try { const o = fn(req as Request<Record<string, string>>, res); if (o instanceof Promise) o.catch(next); } catch (e) { next(e); }
};
const bad = (res: Response, msg: string, status = 400) => res.status(status).json({ message: msg });

const questionSchema = z.object({
  stem: z.string().trim().min(5, "Write the question stem").max(8000),
  ask: z.string().max(1000).default(""),
  options: z.array(z.string().trim().min(1, "Options cannot be empty").max(1000)).min(2, "Add at least two options").max(8),
  answer: z.number().int().min(0),
  explanation: z.string().trim().min(5, "Write an explanation").max(20000),
  rationales: z.array(z.string().max(4000)).default([]),
  objective: z.string().max(1000).default(""),
  system: z.string().trim().min(1, "Choose a system").max(80),
  discipline: z.string().trim().min(1, "Choose a discipline").max(80),
  kind: z.string().max(40).optional(),
  concept_id: z.string().max(40).nullable().optional(),
  source: z.string().max(300).optional(),
  source_url: z.string().max(1000).nullable().optional(),
}).refine((q) => q.answer < q.options.length, { message: "The correct answer must be one of the options" });

const hotspotSchema = z.array(z.object({
  x: z.number().min(0).max(100), y: z.number().min(0).max(100),
  label: z.string().trim().min(1).max(200), detail: z.string().max(4000).default(""),
})).max(80);

export function registerAdminRoutes(app: Express, counts: Record<string, unknown>) {
  // public
  app.get("/api/settings", (_req, res) => { const s = getSettings(); res.json({ announcement: s.announcement, announcementLevel: s.announcementLevel, features: s.features, registrationOpen: s.registrationOpen }); });
  app.post("/api/reports", w((req, res) => {
    const p = z.object({ type: z.string().min(1).max(40), refId: z.string().min(1).max(200), title: z.string().max(400).optional(), message: z.string().trim().min(5, "Describe the problem (at least 5 characters)").max(4000) }).safeParse(req.body);
    if (!p.success) return bad(res, p.error.issues.map((i) => i.message).join("; "));
    const recent = (db.prepare("SELECT COUNT(*) n FROM reports WHERE owner=? AND created_at>?").get(req.owner, Date.now() - 3600000) as any).n;
    if (recent >= 30) return bad(res, "Too many reports in the last hour. Please try again later.", 429);
    db.prepare("INSERT INTO reports(created_at, owner, user_email, type, ref_id, title, message) VALUES(?,?,?,?,?,?,?)").run(Date.now(), req.owner, req.user?.email ?? null, p.data.type, p.data.refId, p.data.title ?? null, p.data.message);
    res.json({ ok: true });
  }));
  app.get("/api/updates", w((req, res) => {
    const job = String(req.query.job || "pubmed");
    if (!JOBS[job]) return bad(res, "Unknown feed", 404);
    const last = db.prepare("SELECT finished_at FROM jobs WHERE type=? AND status='done' ORDER BY id DESC LIMIT 1").get(job) as any;
    res.json({ job, title: JOBS[job].title, source: JOBS[job].source, lastRun: last?.finished_at ?? null, items: feed(job, 200, String(req.query.q || "").slice(0, 100)), feeds: Object.entries(JOBS).filter(([k]) => k !== "openstax" && k !== "wikipedia" && k !== "pubchem").map(([k, v]) => ({ key: k, title: v.title, n: (db.prepare("SELECT COUNT(*) n FROM feed_items WHERE job=?").get(k) as any).n })) });
  }));
  app.get("/api/articles", w((_req, res) => res.json({ articles: db.prepare("SELECT id, url, title, license, attribution, subject, updated_at, substr(body,1,300) excerpt FROM drafts WHERE status='published' ORDER BY updated_at DESC").all() })));
  app.get("/api/articles/:id", w((req, res) => {
    const a = db.prepare("SELECT id, url, title, body, license, attribution, subject, updated_at FROM drafts WHERE id=? AND status='published'").get(Number(req.params.id));
    if (!a) return bad(res, "Article not found", 404);
    res.json(a);
  }));

  // admin
  app.use("/api/admin", requireAdmin);
  app.get("/api/admin/overview", w((_req, res) => {
    const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as any).n as number;
    const day = Date.now() - 86400000;
    res.json({
      users: one("SELECT COUNT(*) n FROM users"), admins: one("SELECT COUNT(*) n FROM users WHERE role='admin'"), suspended: one("SELECT COUNT(*) n FROM users WHERE suspended=1"),
      activeToday: one("SELECT COUNT(DISTINCT owner) n FROM attempts WHERE created_at>?", day), attempts: one("SELECT COUNT(*) n FROM attempts"), attemptsToday: one("SELECT COUNT(*) n FROM attempts WHERE created_at>?", day),
      sessions: one("SELECT COUNT(*) n FROM quiz_sessions"), cards: one("SELECT COUNT(*) n FROM flashcards"), notes: one("SELECT COUNT(*) n FROM notes"),
      openReports: one("SELECT COUNT(*) n FROM reports WHERE status='open'"), drafts: one("SELECT COUNT(*) n FROM drafts WHERE status='draft'"), published: one("SELECT COUNT(*) n FROM drafts WHERE status='published'"),
      customQuestions: one("SELECT COUNT(*) n FROM custom_questions"), disabledQuestions: one("SELECT COUNT(*) n FROM question_overrides WHERE disabled=1"), editedQuestions: one("SELECT COUNT(*) n FROM question_overrides WHERE data IS NOT NULL"),
      annotatedFigures: one("SELECT COUNT(*) n FROM figure_hotspots WHERE hotspots!='[]'"), anatomyOverrides: one("SELECT COUNT(*) n FROM anatomy_overrides"), feedItems: one("SELECT COUNT(*) n FROM feed_items"),
      content: counts,
      hardest: db.prepare("SELECT question_id id, COUNT(*) n, ROUND(100.0*SUM(correct)/COUNT(*)) pct FROM attempts GROUP BY 1 HAVING n>=3 ORDER BY pct ASC, n DESC LIMIT 10").all(),
      recentJobs: db.prepare("SELECT id, type, status, started_at, finished_at, items FROM jobs ORDER BY id DESC LIMIT 8").all(),
    });
  }));

  // users
  app.get("/api/admin/users", w((req, res) => {
    const q = `%${String(req.query.q || "").trim()}%`;
    res.json({ users: db.prepare(`SELECT u.id, u.name, u.email, u.role, u.suspended, u.created_at, u.last_seen,
      (SELECT COUNT(*) FROM attempts a WHERE a.owner='u:'||u.id) attempts, (SELECT ROUND(100.0*SUM(correct)/COUNT(*)) FROM attempts a WHERE a.owner='u:'||u.id) pct
      FROM users u WHERE u.name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC LIMIT 500`).all(q, q) });
  }));
  app.patch("/api/admin/users/:id", w((req, res) => {
    const id = Number(req.params.id);
    const p = z.object({ role: z.enum(["student", "editor", "admin"]).optional(), suspended: z.boolean().optional(), name: z.string().trim().min(1).max(80).optional() }).safeParse(req.body);
    if (!p.success) return bad(res, "Invalid update");
    if (id === req.user!.id && (p.data.role && p.data.role !== "admin" || p.data.suspended)) return bad(res, "You cannot demote or suspend your own account");
    if (p.data.role) db.prepare("UPDATE users SET role=? WHERE id=?").run(p.data.role, id);
    if (p.data.suspended !== undefined) { db.prepare("UPDATE users SET suspended=? WHERE id=?").run(p.data.suspended ? 1 : 0, id); if (p.data.suspended) db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(id); }
    if (p.data.name) db.prepare("UPDATE users SET name=? WHERE id=?").run(p.data.name, id);
    audit(req, "user.update", `user:${id}`, p.data);
    res.json({ ok: true });
  }));
  app.post("/api/admin/users/:id/password", w((req, res) => {
    const id = Number(req.params.id);
    const p = z.object({ password: z.string().min(8, "Use at least 8 characters").max(200) }).safeParse(req.body);
    if (!p.success) return bad(res, p.error.issues[0].message);
    const salt = randomBytes(16);
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(`scrypt$${salt.toString("hex")}$${scryptSync(p.data.password, salt, 64).toString("hex")}`, id);
    db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(id);
    audit(req, "user.password_reset", `user:${id}`);
    res.json({ ok: true });
  }));
  app.post("/api/admin/users/:id/reset-progress", w((req, res) => {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM attempts WHERE owner=?").run(`u:${id}`);
    db.prepare("DELETE FROM quiz_sessions WHERE owner=?").run(`u:${id}`);
    audit(req, "user.reset_progress", `user:${id}`);
    res.json({ ok: true });
  }));
  app.delete("/api/admin/users/:id", w((req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) return bad(res, "You cannot delete your own account");
    for (const t of ["quiz_sessions", "attempts", "flashcards", "bookmarks", "notes"]) db.prepare(`DELETE FROM ${t} WHERE owner=?`).run(`u:${id}`);
    db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(id);
    db.prepare("DELETE FROM users WHERE id=?").run(id);
    audit(req, "user.delete", `user:${id}`);
    res.json({ ok: true });
  }));

  // questions
  app.get("/api/admin/questions", w((req, res) => {
    const q = String(req.query.q || "").trim();
    const src = String(req.query.source || "");
    const state = String(req.query.state || "");
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = 30;
    const overrides = new Map((db.prepare("SELECT id, data IS NOT NULL edited, disabled FROM question_overrides").all() as any[]).map((r) => [r.id, r]));
    let rows: any[] = [];
    let total = 0;
    if (src === "custom") {
      const all_ = db.prepare("SELECT id, data, disabled, updated_at FROM custom_questions ORDER BY updated_at DESC").all() as any[];
      const f = all_.map((r) => ({ id: r.id, ...parseJSON<any>(r.data, {}), disabled: !!r.disabled, edited: false, custom: true })).filter((r) => !q || (r.stem || "").toLowerCase().includes(q.toLowerCase()));
      total = f.length; rows = f.slice(page * size, page * size + size);
    } else {
      const conds: string[] = []; const params: unknown[] = [];
      if (q) { if (/^[\w-]+$/.test(q) && get("SELECT 1 FROM questions WHERE id=?", q)) { conds.push("id=?"); params.push(q); } else { conds.push("stem LIKE ?"); params.push(`%${q}%`); } }
      if (src) { conds.push("kind=?"); params.push(src); }
      if (state === "disabled" || state === "edited") {
        const ids = Array.from(overrides.values()).filter((o: any) => state === "disabled" ? o.disabled : o.edited).map((o: any) => o.id);
        conds.push(`id IN (${ids.map(() => "?").join(",") || "''"})`); params.push(...ids);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      total = (get<any>(`SELECT COUNT(*) n FROM questions ${where}`, ...params)).n;
      rows = all(`SELECT id, kind, discipline, system, substr(stem,1,260) stem, source FROM questions ${where} ORDER BY id LIMIT ? OFFSET ?`, ...params, size, page * size)
        .map((r: any) => ({ ...r, disabled: !!(overrides.get(r.id) as any)?.disabled, edited: !!(overrides.get(r.id) as any)?.edited }));
    }
    const kinds = all("SELECT kind v, COUNT(*) n FROM questions GROUP BY 1 ORDER BY 2 DESC");
    res.json({ total, page, size, rows, kinds, systems: all("SELECT DISTINCT system v FROM questions ORDER BY 1").map((r: any) => r.v), disciplines: all("SELECT DISTINCT discipline v FROM questions ORDER BY 1").map((r: any) => r.v) });
  }));
  app.get("/api/admin/questions/:id", w((req, res) => {
    const q = loadQ(req.params.id);
    if (!q) return bad(res, "Question not found", 404);
    const o = db.prepare("SELECT disabled FROM question_overrides WHERE id=?").get(q.id) as any;
    const c = q.id.startsWith("c-") ? db.prepare("SELECT disabled FROM custom_questions WHERE id=?").get(q.id) as any : null;
    const stats = db.prepare("SELECT COUNT(*) n, SUM(correct) c FROM attempts WHERE question_id=?").get(q.id) as any;
    const reports = db.prepare("SELECT id, created_at, message, status FROM reports WHERE type='question' AND ref_id=? ORDER BY id DESC").all(q.id);
    res.json({ ...q, options: parseJSON(q.options, []), rationales: parseJSON(q.rationales, []), disabled: !!(o?.disabled || c?.disabled), custom: q.id.startsWith("c-"), stats, reports });
  }));
  app.post("/api/admin/questions", w((req, res) => {
    const p = questionSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error.issues.map((i) => i.message).join("; "));
    const id = `c-${randomBytes(5).toString("hex")}`;
    db.prepare("INSERT INTO custom_questions(id, data, created_at, updated_at) VALUES(?,?,?,?)").run(id, JSON.stringify({ ...p.data, kind: "custom", source: p.data.source || "Vesalius editors" }), Date.now(), Date.now());
    audit(req, "question.create", id);
    res.json({ id });
  }));
  app.put("/api/admin/questions/:id", w((req, res) => {
    const id = req.params.id;
    const p = questionSchema.safeParse(req.body);
    if (!p.success) return bad(res, p.error.issues.map((i) => i.message).join("; "));
    if (id.startsWith("c-")) {
      if (!db.prepare("UPDATE custom_questions SET data=?, updated_at=? WHERE id=?").run(JSON.stringify({ ...p.data, kind: "custom" }), Date.now(), id).changes) return bad(res, "Question not found", 404);
    } else {
      if (!get("SELECT 1 FROM questions WHERE id=?", id)) return bad(res, "Question not found", 404);
      db.prepare("INSERT INTO question_overrides(id, data, disabled, updated_at) VALUES(?,?,0,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").run(id, JSON.stringify(p.data), Date.now());
    }
    audit(req, "question.edit", id);
    res.json({ ok: true });
  }));
  app.post("/api/admin/questions/:id/disable", w((req, res) => {
    const id = req.params.id; const disabled = !!req.body?.disabled;
    if (id.startsWith("c-")) db.prepare("UPDATE custom_questions SET disabled=? WHERE id=?").run(disabled ? 1 : 0, id);
    else db.prepare("INSERT INTO question_overrides(id, data, disabled, updated_at) VALUES(?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET disabled=excluded.disabled, updated_at=excluded.updated_at").run(id, disabled ? 1 : 0, Date.now());
    audit(req, disabled ? "question.disable" : "question.enable", id);
    res.json({ ok: true });
  }));
  app.post("/api/admin/questions/:id/revert", w((req, res) => {
    db.prepare("UPDATE question_overrides SET data=NULL, updated_at=? WHERE id=?").run(Date.now(), req.params.id);
    audit(req, "question.revert", req.params.id);
    res.json({ ok: true });
  }));
  app.delete("/api/admin/questions/:id", w((req, res) => {
    if (!req.params.id.startsWith("c-")) return bad(res, "Only editor-written questions can be deleted; disable source questions instead");
    db.prepare("DELETE FROM custom_questions WHERE id=?").run(req.params.id);
    audit(req, "question.delete", req.params.id);
    res.json({ ok: true });
  }));

  // reports
  app.get("/api/admin/reports", w((req, res) => {
    const status = String(req.query.status || "open");
    res.json({ reports: db.prepare(`SELECT * FROM reports ${status === "all" ? "" : "WHERE status=?"} ORDER BY id DESC LIMIT 500`).all(...(status === "all" ? [] : [status])) });
  }));
  app.patch("/api/admin/reports/:id", w((req, res) => {
    const p = z.object({ status: z.enum(["open", "resolved", "dismissed"]), note: z.string().max(4000).optional() }).safeParse(req.body);
    if (!p.success) return bad(res, "Invalid update");
    db.prepare("UPDATE reports SET status=?, admin_note=coalesce(?, admin_note), resolved_at=? WHERE id=?").run(p.data.status, p.data.note ?? null, p.data.status === "open" ? null : Date.now(), Number(req.params.id));
    audit(req, `report.${p.data.status}`, `report:${req.params.id}`);
    res.json({ ok: true });
  }));

  // figure hotspots + anatomy overrides
  app.put("/api/admin/figures/:id/hotspots", w((req, res) => {
    const id = Number(req.params.id);
    if (!get("SELECT 1 FROM book_figures WHERE id=?", id)) return bad(res, "Figure not found", 404);
    const p = hotspotSchema.safeParse(req.body?.hotspots);
    if (!p.success) return bad(res, "Each label needs a position and text");
    db.prepare("INSERT INTO figure_hotspots(figure_id, hotspots, updated_at, updated_by) VALUES(?,?,?,?) ON CONFLICT(figure_id) DO UPDATE SET hotspots=excluded.hotspots, updated_at=excluded.updated_at, updated_by=excluded.updated_by").run(id, JSON.stringify(p.data), Date.now(), req.user!.email);
    audit(req, "figure.hotspots", `figure:${id}`, { n: p.data.length });
    res.json({ ok: true });
  }));
  app.put("/api/admin/anatomy/:fj", w((req, res) => {
    const fj = req.params.fj;
    if (!get("SELECT 1 FROM anatomy_parts WHERE fj=?", fj)) return bad(res, "Part not found", 404);
    const d = String(req.body?.description ?? "").trim();
    if (!d) db.prepare("DELETE FROM anatomy_overrides WHERE fj=?").run(fj);
    else db.prepare("INSERT INTO anatomy_overrides(fj, description, updated_at, updated_by) VALUES(?,?,?,?) ON CONFLICT(fj) DO UPDATE SET description=excluded.description, updated_at=excluded.updated_at, updated_by=excluded.updated_by").run(fj, d.slice(0, 20000), Date.now(), req.user!.email);
    audit(req, d ? "anatomy.override" : "anatomy.revert", fj);
    res.json({ ok: true });
  }));
  app.get("/api/admin/anatomy", w((_req, res) => res.json({ overrides: db.prepare("SELECT * FROM anatomy_overrides ORDER BY updated_at DESC").all() })));

  // settings + audit
  app.get("/api/admin/settings", w((_req, res) => res.json(getSettings())));
  app.put("/api/admin/settings", w((req, res) => {
    const p = z.object({
      announcement: z.string().max(1000).optional(), announcementLevel: z.enum(["info", "warning"]).optional(),
      features: z.record(z.string(), z.boolean()).optional(), pubmedTerms: z.string().max(3000).optional(), registrationOpen: z.boolean().optional(),
    }).safeParse(req.body);
    if (!p.success) return bad(res, "Invalid settings");
    const up = db.prepare("INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    for (const [k, v] of Object.entries(p.data)) if (v !== undefined) up.run(k, JSON.stringify(v));
    audit(req, "settings.update", undefined, p.data);
    res.json(getSettings());
  }));
  app.get("/api/admin/audit", w((_req, res) => res.json({ rows: db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 500").all() })));

  // jobs
  app.get("/api/admin/jobs", w((_req, res) => {
    const last = new Map((db.prepare("SELECT type, MAX(id) id FROM jobs GROUP BY type").all() as any[]).map((r) => [r.type, r.id]));
    res.json({
      defs: Object.entries(JOBS).map(([k, v]) => ({ key: k, title: v.title, source: v.source, description: v.description, running: running.has(k), last: last.has(k) ? db.prepare("SELECT id, status, started_at, finished_at, items FROM jobs WHERE id=?").get(last.get(k)) : null, stored: (db.prepare("SELECT COUNT(*) n FROM feed_items WHERE job=?").get(k) as any).n })),
      history: db.prepare("SELECT id, type, status, started_at, finished_at, items, started_by FROM jobs ORDER BY id DESC LIMIT 50").all(),
    });
  }));
  app.post("/api/admin/jobs/:type/run", w((req, res) => {
    const id = startJob(req.params.type, req.body || {}, req.user!.email);
    audit(req, "job.run", req.params.type, req.body);
    res.json({ id });
  }));
  app.get("/api/admin/jobs/:id", w((req, res) => {
    const j = db.prepare("SELECT * FROM jobs WHERE id=?").get(Number(req.params.id));
    if (!j) return bad(res, "Job not found", 404);
    res.json(j);
  }));
  app.get("/api/admin/feed/:job", w((req, res) => res.json({ items: feed(req.params.job, 300, String(req.query.q || "")) })));

  // URL import -> drafts
  app.post("/api/admin/import", w(async (req, res) => {
    const p = z.object({ url: z.string().url("Enter a full URL starting with https://"), license: z.string().trim().max(200).optional(), subject: z.string().max(120).optional() }).safeParse(req.body);
    if (!p.success) return bad(res, p.error.issues[0].message);
    const url = new URL(p.data.url);
    if (!/^https?:$/.test(url.protocol)) return bad(res, "Only http and https URLs are supported");
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return bad(res, "Private network addresses are not allowed");
    const robots = await robotsAllows(url);
    if (!robots.allowed) { audit(req, "import.blocked", url.href, robots.note); return bad(res, `${robots.note}. This page cannot be imported.`, 403); }
    const page = await fetchText(url.href);
    if (page.status >= 400) return bad(res, `The page returned HTTP ${page.status}`, 502);
    if (!/html|text\/plain/.test(page.type)) return bad(res, `Unsupported content type ${page.type}; import HTML pages only`);
    const r = /html/.test(page.type) ? readable(page.text) : { title: url.pathname.split("/").pop() || url.host, text: page.text.slice(0, 200000), license: null };
    if (r.text.length < 200) return bad(res, "Could not find readable article text on this page");
    const license = p.data.license || r.license || (/\.(gov|mil)$/.test(url.hostname) ? "Public domain (U.S. Government work) \u2014 verify" : "Unknown \u2014 verify before publishing");
    const id = Number(db.prepare("INSERT INTO drafts(url, title, body, license, attribution, subject, status, created_at, updated_at, created_by, robots) VALUES(?,?,?,?,?,?,'draft',?,?,?,?)").run(
      url.href, r.title.slice(0, 400), r.text, license, `${r.title} \u2014 ${url.host}`, p.data.subject || null, Date.now(), Date.now(), req.user!.email, robots.note).lastInsertRowid);
    audit(req, "import.draft", url.href, { id, chars: r.text.length });
    res.json({ id, title: r.title, chars: r.text.length, license, robots: robots.note });
  }));
  app.get("/api/admin/drafts", w((req, res) => {
    const status = String(req.query.status || "all");
    res.json({ drafts: db.prepare(`SELECT id, url, title, license, subject, status, created_at, updated_at, created_by, robots, length(body) chars FROM drafts ${status === "all" ? "" : "WHERE status=?"} ORDER BY id DESC`).all(...(status === "all" ? [] : [status])) });
  }));
  app.get("/api/admin/drafts/:id", w((req, res) => {
    const d = db.prepare("SELECT * FROM drafts WHERE id=?").get(Number(req.params.id));
    if (!d) return bad(res, "Draft not found", 404);
    res.json(d);
  }));
  app.patch("/api/admin/drafts/:id", w((req, res) => {
    const p = z.object({ title: z.string().trim().min(1).max(400).optional(), body: z.string().min(1).max(200000).optional(), license: z.string().trim().min(1).max(200).optional(), attribution: z.string().max(400).optional(), subject: z.string().max(120).optional(), status: z.enum(["draft", "published", "rejected"]).optional() }).safeParse(req.body);
    if (!p.success) return bad(res, "Invalid update");
    const id = Number(req.params.id);
    const cur = db.prepare("SELECT license FROM drafts WHERE id=?").get(id) as any;
    if (!cur) return bad(res, "Draft not found", 404);
    if (p.data.status === "published" && /^unknown/i.test(p.data.license || cur.license)) return bad(res, "Set the content licence before publishing (for example CC BY 4.0 or Public domain)");
    const sets = Object.keys(p.data).map((k) => `${k}=@${k}`).join(", ");
    if (sets) db.prepare(`UPDATE drafts SET ${sets}, updated_at=@now WHERE id=@id`).run({ ...p.data, now: Date.now(), id });
    audit(req, p.data.status ? `draft.${p.data.status}` : "draft.edit", `draft:${id}`);
    res.json({ ok: true });
  }));
  app.delete("/api/admin/drafts/:id", w((req, res) => {
    db.prepare("DELETE FROM drafts WHERE id=?").run(Number(req.params.id));
    audit(req, "draft.delete", `draft:${req.params.id}`);
    res.json({ ok: true });
  }));
}
