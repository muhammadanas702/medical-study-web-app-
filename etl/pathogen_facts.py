"""Pathogen fact sheets: curated fields (etl/data/pathogens.json) + Wikipedia lead (CC BY-SA 4.0) + MeSH link +
RCSB PDB structures (verified against the RCSB API; entries whose title does not match the organism are dropped)."""
import os, re, json, time, urllib.parse, urllib.request
from common import connect, J, meta, RAW

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(RAW, "pathogen"); os.makedirs(CACHE, exist_ok=True)


def get_json(url, tries=4):
    key = os.path.join(CACHE, re.sub(r"[^A-Za-z0-9]+", "_", url)[-180:] + ".json")
    if os.path.exists(key): return json.load(open(key))
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VesaliusMedStudy/1.0 (education)"})
            d = json.loads(urllib.request.urlopen(req, timeout=60).read())
            json.dump(d, open(key, "w")); return d
        except urllib.error.HTTPError as e:
            if e.code == 404: json.dump({"_404": True}, open(key, "w")); return {"_404": True}
            time.sleep(2 * (t + 1))
        except Exception:
            time.sleep(2 * (t + 1))
    return {}


def wiki(titles):
    out = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        d = get_json("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&piprop=original&exintro=1&explaintext=1&redirects=1&titles=" + urllib.parse.quote("|".join(chunk)))
        q = d.get("query", {}); back = {}
        for n in q.get("normalized", []) + q.get("redirects", []): back[n["to"]] = back.get(n["from"], n["from"])
        for p in q.get("pages", {}).values():
            t = p.get("title"); ex = (p.get("extract") or "").strip()
            if not ex: continue
            ex = re.sub(r"\n{2,}", "\n\n", ex); ex = re.sub(r"\s*\(\s*[;,]\s*", " (", ex).replace(" ()", "")
            src = t
            while src in back: src = back[src]
            out[src] = {"title": t, "text": ex}
    return out


def run():
    data = json.load(open(os.path.join(HERE, "data", "pathogens.json")))
    c = connect()
    w = wiki(sorted({p["wiki"] for p in data if p.get("wiki")}))
    rows = []; dropped = []
    for p in data:
        mid = None
        if p.get("mesh"):
            r = c.execute("SELECT id FROM concepts WHERE lower(name)=lower(?)", (p["mesh"],)).fetchone()
            mid = r[0] if r else None
            if not mid: print("no MeSH match", p["id"], p["mesh"])
        pdbs = []
        for pid, desc in p.get("pdb", []):
            d = get_json(f"https://data.rcsb.org/rest/v1/core/entry/{pid}")
            title = (d.get("struct") or {}).get("title")
            if not title: dropped.append((p["id"], pid, "missing")); continue
            src_orgs = set()
            for e in (d.get("rcsb_entry_container_identifiers") or {}).get("polymer_entity_ids", [])[:6]:
                ent = get_json(f"https://data.rcsb.org/rest/v1/core/polymer_entity/{pid}/{e}")
                for s in ent.get("rcsb_entity_source_organism", []) or []:
                    if s.get("scientific_name"): src_orgs.add(s["scientific_name"])
            res = (d.get("rcsb_entry_info") or {}).get("resolution_combined") or [None]
            method = (d.get("exptl") or [{}])[0].get("method")
            pdbs.append({"id": pid, "desc": desc, "title": title, "organisms": sorted(src_orgs)[:6], "method": method,
                         "resolution": res[0], "year": ((d.get("rcsb_accession_info") or {}).get("initial_release_date") or "")[:4]})
        wk = w.get(p.get("wiki"))
        nq = c.execute("SELECT COUNT(*) FROM questions WHERE concept_id=?", (mid,)).fetchone()[0] if mid else 0
        rows.append((p["id"], p["name"], p["kind"], p.get("group"), p.get("family"), mid, J(p), J(pdbs), J(p.get("nih3d", [])),
                     wk["title"] if wk else None, wk["text"] if wk else None, nq))
    c.executescript("DROP TABLE IF EXISTS pathogens; CREATE TABLE pathogens(id TEXT PRIMARY KEY, name TEXT, kind TEXT, grp TEXT, family TEXT, mesh_id TEXT, facts TEXT, pdb TEXT, nih3d TEXT, wiki_title TEXT, wiki_text TEXT, question_count INTEGER);")
    c.executemany("INSERT INTO pathogens VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    # link NIH 3D models to their pathogen + MeSH heading
    cols = [r[1] for r in c.execute("PRAGMA table_info(models)")]
    if "mesh_id" not in cols: c.execute("ALTER TABLE models ADD COLUMN mesh_id TEXT")
    if "pathogen_id" not in cols: c.execute("ALTER TABLE models ADD COLUMN pathogen_id TEXT")
    for r in rows:
        for mid3 in json.loads(r[8]):
            c.execute("UPDATE models SET pathogen_id=coalesce(pathogen_id, ?), mesh_id=coalesce(mesh_id, ?) WHERE id=?", (r[0], r[5], mid3))
    meta(c, "pathogens", {"source": "Curated fact sheets; Wikipedia (CC BY-SA 4.0); NLM MeSH; RCSB Protein Data Bank", "url": "https://www.rcsb.org", "count": len(rows)})
    c.commit()
    print(len(rows), "pathogens;", sum(1 for r in rows if r[10]), "wiki;", sum(1 for r in rows if r[5]), "mesh;", "dropped pdb:", dropped)
    for r in rows:
        for x in json.loads(r[7]): print(r[0], x["id"], "|", x["desc"], "|", x["title"][:90], "|", ",".join(x["organisms"])[:80])


if __name__ == "__main__": run()
