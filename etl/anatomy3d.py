"""BodyParts3D 4.0 (DBCLS, CC BY-SA 2.1 JP) -> per-system GLB files + anatomy tables.

All 2,234 element files of the is-a release are used. Every element is classified with the FMA hierarchy
(bp3d_tree.py), linked to Wikidata via its FMA ID (P1402) for MeSH (P486), TA98 (P1323) and the English
Wikipedia article, whose text (CC BY-SA 4.0) supplies the structure/function/clinical description.

Inputs in RAW_DIR: bp3d_isa_obj.zip, bp3d_*.txt, wd_fma.json (wikidata_fma.py), wiki_anat.json (wiki_fetch.py)
"""
import io, os, re, json, zipfile, collections
import numpy as np, trimesh, fast_simplification
from bp3d_tree import Tree, classify, RAW
from common import connect, J, meta

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "public", "models", "anatomy")
BUDGET = {"skeletal": 300000, "cardiovascular": 240000, "nervous": 150000, "muscular": 230000, "digestive": 120000,
          "respiratory": 70000, "urinary": 30000, "endocrine": 15000, "reproductive": 20000, "integumentary": 60000,
          "sensory": 40000}
LAT = re.compile(r"\b(left|right) ")

def run():
    os.makedirs(OUT, exist_ok=True)
    t = Tree()
    wd = json.load(open(os.path.join(RAW, "wd_fma.json")))
    wiki = json.load(open(os.path.join(RAW, "wiki_anat.json")))
    # name-matched articles (wiki_by_name.py) for concepts Wikidata does not link; only close title matches are kept,
    # broader redirects (e.g. "eleventh rib" -> "Rib cage") are dropped so the parent-context path handles them
    nm_path = os.path.join(RAW, "wd_fma_names.json")
    if os.path.exists(nm_path):
        import difflib
        tok = lambda x: {w.rstrip("s") for w in re.findall(r"[a-z]+", x.lower())} - {"muscle", "human", "the", "of", "left", "right"}
        for f, title in json.load(open(nm_path)).items():
            d = wd.setdefault(f, {})
            if d.get("enwiki") and wiki.get(d["enwiki"]): continue
            a, b = tok(title), tok(t.name.get(f, ""))
            if not a or not b: continue
            if len(a & b) / len(a | b) >= 0.5 or difflib.SequenceMatcher(None, " ".join(sorted(a)), " ".join(sorted(b))).ratio() >= 0.8:
                d["enwiki"] = title
    z = zipfile.ZipFile(os.path.join(RAW, "bp3d_isa_obj.zip"))
    paths = {os.path.basename(n)[:-4]: n for n in z.namelist() if n.endswith(".obj")}
    by_name = {}
    for f, n in t.name.items(): by_name.setdefault(n.lower(), f)

    def generic(c):
        g = LAT.sub("", t.name[c].lower())
        return by_name.get(g, c)

    def wd_for(c):
        for k in (c, generic(c)):
            d = wd.get(k)
            if d and d.get("enwiki") and wiki.get(d["enwiki"]): return k, d
        for k in (c, generic(c)):
            if k in wd: return k, wd[k]
        return None, None

    c = connect()
    names = {}
    for cid, nm, et in c.execute("SELECT id, name, entry_terms FROM concepts"):
        names.setdefault(nm.lower(), cid)
        for e in json.loads(et or "[]"): names.setdefault(e.lower(), cid)
    mesh_ok = {r[0] for r in c.execute("SELECT id FROM concepts")}

    parts = {}
    meshes = collections.defaultdict(list)
    for fj, p in sorted(paths.items()):
        r = classify(t, fj)
        if not r: continue
        leaf, sysname, _ = r
        if sysname == "other": sysname = "muscular" if "fascia" in t.name[leaf] else "other"
        m = trimesh.load(io.BytesIO(z.read(p)), file_type="obj", force="mesh", process=False)
        meshes[sysname].append((fj, m))
        parts[fj] = {"leaf": leaf, "system": sysname}

    allb = np.vstack([m.bounds for ms in meshes.values() for _, m in ms]); lo, hi = allb.min(0), allb.max(0)
    center = (lo + hi) / 2
    c.executescript("""
    DROP TABLE IF EXISTS anatomy_parts; DROP TABLE IF EXISTS anatomy_concepts; DROP TABLE IF EXISTS anatomy_wiki; DROP TABLE IF EXISTS anatomy_fts;
    CREATE TABLE anatomy_parts(fj TEXT PRIMARY KEY, fma TEXT, name TEXT, system TEXT, mesh_id TEXT, cx REAL, cy REAL, cz REAL,
      generic_fma TEXT, side TEXT, wiki TEXT, ta98 TEXT, qid TEXT, kind TEXT, partof TEXT, ctx_fma TEXT, ctx_wiki TEXT, ctx_mesh TEXT);
    CREATE TABLE anatomy_concepts(fma TEXT PRIMARY KEY, name TEXT, qid TEXT, wiki TEXT, mesh_id TEXT, ta98 TEXT, uberon TEXT,
      nfj INTEGER, fjs TEXT, part_parents TEXT, part_children TEXT, isa_parents TEXT, isa_children TEXT, systems TEXT);
    CREATE TABLE anatomy_wiki(title TEXT PRIMARY KEY, url TEXT, touched TEXT, intro TEXT, sections TEXT, image TEXT);
    """)
    info = {}
    for sysname, ms in meshes.items():
        if sysname == "other": continue
        total = sum(len(m.faces) for _, m in ms); ratio = min(1.0, BUDGET.get(sysname, 50000) / total)
        scene = trimesh.Scene(); kept = 0
        for fj, m in ms:
            v = (m.vertices - center) / 1000.0
            v = v[:, [0, 2, 1]] * np.array([1, 1, -1])
            f = m.faces
            if ratio < 0.98 and len(f) > 400:
                target = max(1 - max(ratio, 300 / len(f)), 0)
                v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=target)
            mm = trimesh.Trimesh(v, f, process=True); kept += len(mm.faces)
            scene.add_geometry(mm, node_name=fj, geom_name=fj)
            parts[fj]["ctr"] = mm.bounds.mean(0)
        fn = os.path.join(OUT, f"{sysname}.glb"); scene.export(fn)
        info[sysname] = {"parts": len(ms), "faces": kept, "bytes": os.path.getsize(fn)}
        print(sysname, len(ms), total, "->", kept, os.path.getsize(fn) // 1024, "KB", flush=True)

    used_titles = set()
    for fj, p in parts.items():
        if p["system"] == "other" or "ctr" not in p: continue
        leaf = p["leaf"]; nm = t.name[leaf]
        g = generic(leaf); k, d = wd_for(leaf)
        side = "left" if nm.lower().startswith("left ") or " left " in nm.lower() else ("right" if nm.lower().startswith("right ") or " right " in nm.lower() else None)
        mesh_id = None
        if d:
            for mm in d.get("mesh", []):
                if mm in mesh_ok: mesh_id = mm; break
        if not mesh_id:
            base = LAT.sub("", nm.lower())
            mesh_id = names.get(nm.lower()) or names.get(base)
        title = d.get("enwiki") if d and d.get("enwiki") in wiki and wiki[d["enwiki"]] else None
        if title: used_titles.add(title)
        isa = sorted(t.anc("isa", g) | t.anc("isa", leaf), key=lambda a: -len(t.elems[a]))
        kind = next((t.name[a] for a in reversed(isa) if t.name[a] not in ("anatomical entity", "physical anatomical entity", "material anatomical entity", "anatomical structure", "cardinal organ part", "organ region", "organ segment", "organ part")), None)
        par = [a for a in sorted(t.par["partof"][leaf], key=lambda a: len(t.elems[a]))][:4]
        # nearest ancestor (part-of first, then is-a) that has its own article / MeSH heading, for context
        ctx_fma = ctx_wiki = ctx_mesh = None
        if not title or not mesh_id:
            frontier = [leaf, g]; seen = set()
            for _ in range(8):
                nxt = []
                for x in frontier:
                    for a in sorted(t.par["partof"][x] | t.par["isa"][x], key=lambda a: (a not in t.par["partof"][x], len(t.elems[a]))):
                        if a in seen: continue
                        seen.add(a); nxt.append(a)
                        if t.name[a] in ("human body", "anatomical entity", "physical anatomical entity", "material anatomical entity", "anatomical structure"): continue
                        _, ad = wd_for(a)
                        if not title and not ctx_wiki and ad and ad.get("enwiki") in wiki and wiki[ad["enwiki"]]:
                            ctx_fma, ctx_wiki = a, ad["enwiki"]; used_titles.add(ctx_wiki)
                        if not mesh_id and not ctx_mesh:
                            ctx_mesh = next((m for m in (ad or {}).get("mesh", []) if m in mesh_ok), None) or names.get(t.name[a].lower())
                frontier = nxt
                if (title or ctx_wiki) and (mesh_id or ctx_mesh): break
        c.execute("INSERT INTO anatomy_parts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (fj, leaf, nm, p["system"], mesh_id, *map(float, p["ctr"]), g if g != leaf else None, side, title,
                   J(d.get("ta98")) if d and d.get("ta98") else None, d.get("qid") if d else None, kind,
                   J([{"fma": a, "name": t.name[a]} for a in par]) if par else None, ctx_fma, ctx_wiki, ctx_mesh))
    # every concept of both trees (organs, regions, groups) so any structure can be shown with its sub-parts
    fj_sys = {fj: p["system"] for fj, p in parts.items()}
    for cid, nm in t.name.items():
        fjs = sorted(f for f in t.elems.get(cid, ()) if f in fj_sys and fj_sys[f] != "other")
        k, d = wd_for(cid)
        title = d.get("enwiki") if d and d.get("enwiki") in wiki and wiki[d["enwiki"]] else None
        if title: used_titles.add(title)
        mesh_id = next((m for m in (d or {}).get("mesh", []) if m in mesh_ok), None) or names.get(nm.lower())
        syss = sorted({fj_sys[f] for f in fjs})
        rel = lambda s: J([{"fma": x, "name": t.name[x]} for x in sorted(s, key=lambda x: t.name[x])][:200])
        c.execute("INSERT INTO anatomy_concepts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (cid, nm, d.get("qid") if d else None, title, mesh_id, J(d.get("ta98")) if d and d.get("ta98") else None,
                   d.get("uberon") if d else None, len(fjs), J(fjs), rel(t.par["partof"][cid]), rel(t.ch["partof"][cid]),
                   rel(t.par["isa"][cid]), rel(t.ch["isa"][cid]), J(syss)))
    for title in used_titles:
        w = wiki[title]
        c.execute("INSERT OR REPLACE INTO anatomy_wiki VALUES(?,?,?,?,?,?)", (title, w.get("url"), w.get("touched"), w.get("intro"), J(w.get("sections")), w.get("image")))
    c.executescript("""
    CREATE INDEX ap_sys ON anatomy_parts(system); CREATE INDEX ap_mesh ON anatomy_parts(mesh_id); CREATE INDEX ac_wiki ON anatomy_concepts(wiki);
    CREATE VIRTUAL TABLE anatomy_fts USING fts5(fj UNINDEXED, name, kind, tokenize='porter unicode61');
    INSERT INTO anatomy_fts(fj,name,kind) SELECT fj,name,coalesce(kind,'') FROM anatomy_parts;
    """)
    n_desc = c.execute("SELECT COUNT(*) FROM anatomy_parts WHERE wiki IS NOT NULL").fetchone()[0]
    n_mesh = c.execute("SELECT COUNT(*) FROM anatomy_parts WHERE mesh_id IS NOT NULL").fetchone()[0]
    n = c.execute("SELECT COUNT(*) FROM anatomy_parts").fetchone()[0]
    print("parts", n, "with article", n_desc, "with MeSH", n_mesh, "articles", len(used_titles))
    meta(c, "anatomy3d", {"source": "BodyParts3D 4.0, The Database Center for Life Science (DBCLS)", "license": "CC BY-SA 2.1 JP",
                          "url": "https://lifesciencedb.jp/bp3d/", "data_url": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/",
                          "systems": info, "parts": n, "with_article": n_desc, "with_mesh": n_mesh,
                          "text_source": "English Wikipedia via Wikidata FMA IDs (CC BY-SA 4.0)",
                          "note": "Male adult model; meshes decimated for web delivery; names are FMA terms; system assignment from the FMA is-a/part-of hierarchy."})
    c.commit()

if __name__ == "__main__":
    run()
