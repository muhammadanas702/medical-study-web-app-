"""Human Reference Atlas (HuBMAP / NIH Common Fund) 3D Reference Organ Library -> per-organ GLB files + organ tables.

Source: https://humanatlas.io/3d-reference-library (CC BY 4.0). The models were segmented from the
Visible Human Male/Female datasets of the U.S. National Library of Medicine (brain: Allen Human Brain Atlas).
Each organ's graph.json gives the label and UBERON ID of every named sub-structure (mesh node) in its GLB.

Descriptions are added per structure:
  * the UBERON ontology definition (EBI OLS, CC BY 3.0),
  * the English Wikipedia lead section (CC BY-SA 4.0), found through Wikidata's UBERON ID property (P1554),
    never by fuzzy title search, so each article is the one Wikidata curators linked to that exact structure,
  * the FMA ID (P1402) and MeSH ID (P486) from Wikidata, used to cross-link to the BodyParts3D atlas and MeSH pages.

Outputs: client/public/models/organs/<id>.glb, tables organ_models + organ_structures.
Raw downloads are cached in RAW_DIR/hra.
"""
import os, re, json, time, subprocess, urllib.parse, collections
import numpy as np, trimesh, fast_simplification
from common import connect, J, meta, RAW

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "client", "public", "models", "organs")
CACHE = os.path.join(RAW, "hra")
API = "https://apps.humanatlas.io/api/v1/reference-organs"
UA = "VesaliusMedStudy/1.0 (educational ETL; https://github.com/muhammadanas702/medical-study-web-app-)"

# Organ systems for grouping in the UI (by UBERON id of the whole organ)
SYSTEM = {
    "heart": "cardiovascular", "blood vasculature": "cardiovascular",
    "lung": "respiratory", "main bronchus": "respiratory", "trachea": "respiratory", "larynx": "respiratory",
    "liver": "digestive", "pancreas": "digestive", "small intestine": "digestive", "large intestine": "digestive",
    "mouth": "digestive", "omentum": "digestive", "palatine tonsil": "lymphatic",
    "kidney": "urinary", "renal pelvis": "urinary", "ureter": "urinary", "urinary bladder": "urinary",
    "brain": "nervous", "spinal cord": "nervous", "eye": "sensory",
    "spleen": "lymphatic", "thymus": "lymphatic", "lymph node": "lymphatic",
    "uterus": "reproductive", "ovary": "reproductive", "fallopian tube": "reproductive", "prostate": "reproductive",
    "placenta full term": "reproductive", "mammary gland": "reproductive",
    "skin": "integumentary", "adipose": "integumentary",
    "pelvis": "skeletal", "sternum": "skeletal", "manubrium": "skeletal", "knee": "skeletal", "intervertebral disk": "skeletal",
}
# Face budgets (after simplification) - enough to keep small sub-structures recognisable
BUDGET = {"brain": 220000, "eye": 70000, "mouth": 90000, "blood vasculature": 120000, "skin": 60000,
          "intervertebral disk": 60000, "mammary gland": 60000, "lung": 90000, "knee": 90000}
DEFAULT_BUDGET = 70000
SKIP = {"epiploic appendage of transverse colon", "manubrium"}  # trivial / duplicated by sternum
# Keep both sexes only where the anatomy differs in a clinically important way
BOTH = {"pelvis"}


def sh(args, **kw): return subprocess.run(args, capture_output=True, text=True, **kw).stdout


def get_json(url, tries=4, data=None, headers=()):
    for i in range(tries):
        cmd = ["curl", "-sL", "--max-time", "120", "-A", UA]
        for h in headers: cmd += ["-H", h]
        if data is not None: cmd += ["--data-urlencode", data]
        out = sh(cmd + [url])
        try: return json.loads(out)
        except Exception: time.sleep(2 + 3 * i)
    raise RuntimeError("failed " + url)


def cached(name, url):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p) or os.path.getsize(p) < 100:
        sh(["curl", "-sL", "--max-time", "600", "-A", UA, "-o", p, url])
    return p


def base_label(lbl):
    return re.sub(r"^(left|right)\s+", "", lbl.lower()).strip()


def node_label(node):
    """Human label from a mesh node name when graph.json has no entry (fallback only)."""
    n = re.sub(r"^(VH_[MF]_|Allen_|SBU_[MF]_|NIH_[MF]_)", "", node)
    side = ""
    m = re.search(r"_(L|R)(_[a-z0-9]+)?$", n)
    if m: side = {"L": "left ", "R": "right "}[m.group(1)]; n = n[:m.start()] + (m.group(2) or "")
    return (side + n.replace("_", " ")).strip()


def choose(organs):
    """One model per organ label; female models for female-only organs, male otherwise; left side for paired organs."""
    by = collections.defaultdict(list)
    for o in organs:
        lbl = base_label(o["label"])
        if lbl in SKIP: continue
        by[lbl].append(o)
    pick = []
    for lbl, lst in by.items():
        def rank(o):
            side = 0 if o["label"].lower().startswith("left") else (1 if o["label"].lower().startswith("right") else 0)
            return (side, 0 if o["sex"] == "Male" else 1)
        lst.sort(key=rank)
        if lbl in BOTH:
            pick += [next(o for o in lst if o["sex"] == s) for s in ("Female", "Male") if any(o["sex"] == s for o in lst)]
        else:
            pick.append(lst[0])
    return pick


def simplify_scene(sc, budget):
    total = sum(len(g.faces) for g in sc.geometry.values())
    r = min(1.0, budget / max(1, total))
    for k, g in list(sc.geometry.items()):
        if r >= 0.999 or len(g.faces) < 400: continue
        g = trimesh.Trimesh(g.vertices, g.faces, process=True)
        target = max(300, int(len(g.faces) * r))
        if target >= len(g.faces): continue
        v, f = fast_simplification.simplify(g.vertices.astype(np.float32), g.faces.astype(np.int32),
                                            target_reduction=1 - target / len(g.faces))
        sc.geometry[k] = trimesh.Trimesh(v, f, process=False)
    return sc, total


def palette(i, n):
    import colorsys
    h = (0.03 + i * 0.618034) % 1.0
    r, g, b = colorsys.hls_to_rgb(h, 0.62, 0.42)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))


def wikidata_for(uberons):
    """UBERON id -> {qid, enwiki, fma, mesh} via Wikidata P1554."""
    res = {}
    ids = sorted(uberons)
    for i in range(0, len(ids), 150):
        vals = " ".join(f'"{u.split(':')[-1]}"' for u in ids[i:i + 150])
        q = f"""SELECT ?u ?item ?fma ?mesh ?art WHERE {{ VALUES ?u {{ {vals} }} ?item wdt:P1554 ?u .
          OPTIONAL {{ ?item wdt:P1402 ?fma }} OPTIONAL {{ ?item wdt:P486 ?mesh }}
          OPTIONAL {{ ?art schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }} }}"""
        d = get_json("https://query.wikidata.org/sparql", data="query=" + q,
                     headers=("Accept: application/sparql-results+json",))
        for b in d["results"]["bindings"]:
            u = "UBERON:" + b["u"]["value"]; e = res.setdefault(u, {})
            e.setdefault("qid", b["item"]["value"].rsplit("/", 1)[-1])
            if "fma" in b: e.setdefault("fma", "FMA" + b["fma"]["value"])
            if "mesh" in b: e.setdefault("mesh", b["mesh"]["value"])
            if "art" in b: e.setdefault("enwiki", urllib.parse.unquote(b["art"]["value"].rsplit("/", 1)[-1]).replace("_", " "))
        time.sleep(1)
    return res


def uberon_defs(uberons):
    """Textual definition (IAO:0000115) and exact synonyms of each UBERON class, via the EBI OLS4 v2 API."""
    def val(x):
        if isinstance(x, list): x = x[0] if x else None
        if isinstance(x, dict): x = x.get("value")
        return x if isinstance(x, str) else None
    def vals(x):
        x = x if isinstance(x, list) else ([x] if x else [])
        return [v for v in (val(y) for y in x) if v]
    out = {}
    for u in sorted(uberons):
        iri = urllib.parse.quote(urllib.parse.quote(f"http://purl.obolibrary.org/obo/{u.replace(':', '_')}", safe=""), safe="")
        try:
            d = get_json(f"https://www.ebi.ac.uk/ols4/api/v2/ontologies/uberon/entities/{iri}", tries=3)
        except Exception:
            continue
        out[u] = {"label": val(d.get("label")), "definition": val(d.get("http://purl.obolibrary.org/obo/IAO_0000115")),
                  "synonyms": vals(d.get("http://www.geneontology.org/formats/oboInOwl#hasExactSynonym"))[:8], "v2": True}
    return out


def wiki_extracts(titles):
    out = {}
    titles = sorted(set(t for t in titles if t))
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        url = ("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1"
               "&redirects=1&titles=" + urllib.parse.quote("|".join(chunk)))
        d = get_json(url)
        q = d.get("query", {})
        back = {}
        for n in q.get("normalized", []) + q.get("redirects", []): back[n["to"]] = back.get(n["from"], n["from"])
        for p in q.get("pages", {}).values():
            t = p.get("title"); ex = (p.get("extract") or "").strip()
            if not ex: continue
            ex = re.sub(r"\n{2,}", "\n\n", ex)
            ex = re.sub(r"\s*\(\s*[;,]\s*", " (", ex).replace(" ()", "")
            src = t
            while src in back: src = back[src]
            out[src] = {"title": t, "text": ex}
            out[t] = out[src]
        time.sleep(0.5)
    return out


ORGAN_WIKI = {"adipose": "Adipose tissue", "blood vasculature": "Blood vessel", "main bronchus": "Bronchus", "intervertebral disk": "Intervertebral disc",
              "placenta full term": "Placenta", "omentum": "Greater omentum", "mouth": "Mouth", "lymph node": "Lymph node"}


def clean_def(t):
    if not t or "Automatically generated" in t: return None
    t = re.sub(r"\s*\[[A-Za-z :_.0-9-]{2,40}\]\.?\s*$", "", t.strip()).strip()
    if t and not t.endswith("."): t += "."
    return t or None


def ols_exact(label):
    q = urllib.parse.quote(label)
    try:
        d = get_json(f"https://www.ebi.ac.uk/ols4/api/search?q={q}&ontology=uberon&exact=true&queryFields=label&fieldList=obo_id,label,description&rows=5", tries=3)
    except Exception:
        return None, None
    for doc in d.get("response", {}).get("docs", []):
        if (doc.get("label") or "").lower() == label.lower():
            return doc.get("obo_id"), None
    return None, None


def run():
    os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    organs = get_json(API)
    picks = choose(organs)
    print(len(picks), "organ models selected", flush=True)
    models, structures = [], []
    for o in picks:
        url = o["object"]["file"]
        fn = url.rsplit("/", 1)[-1]
        base = url.rsplit("/assets/", 1)[0]
        ver = base.rsplit("/", 1)[-1]
        slug = base.split("/ref-organ/", 1)[1].split("/")[0]  # e.g. heart-male
        g = json.load(open(cached(slug + ".graph.json", base + "/graph.json")))
        glb = cached(fn, url)
        lbl = base_label(o["label"])
        sc = trimesh.load(glb, force="scene")
        sc, total = simplify_scene(sc, BUDGET.get(lbl, DEFAULT_BUDGET))
        # node -> geometry names; names in graph.json are the node names
        info = {}
        for e in g["data"]:
            sub = (e.get("object_reference") or {}).get("file_subpath")
            if sub: info[sub] = {"label": e.get("pref_label") or e.get("label"), "uberon": e.get("representation_of")}
        # recentre and scale (mm -> m), rotate z-up -> y-up using the HRA local placement
        rot = (o.get("object") or {}).get("placement") or {}
        pl = (g["data"][0].get("object_reference") or {}).get("placement") or {}
        rx = pl.get("x_rotation", 0) or 0
        lo, hi = sc.bounds; ctr = (lo + hi) / 2
        T = trimesh.transformations.translation_matrix(-ctr)
        R = trimesh.transformations.rotation_matrix(np.radians(rx), [1, 0, 0]) if rx else np.eye(4)
        S = np.diag([0.001, 0.001, 0.001, 1])
        sc.apply_transform(S @ R @ T)
        dims = [round(float(x), 1) for x in (hi - lo)]
        # one mesh per structure, named by the node
        nodes = sorted(n for n in sc.graph.nodes_geometry)
        out = trimesh.Scene()
        ns = 0
        for i, n in enumerate(nodes):
            tf, gname = sc.graph[n]
            m = sc.geometry[gname].copy(); m.apply_transform(tf)
            if len(m.faces) == 0: continue
            out.add_geometry(m, node_name=n, geom_name=n)
            meta_ = info.get(n) or {}
            structures.append({"organ": slug, "node": n, "label": (meta_.get("label") or node_label(n)).strip(),
                               "uberon": meta_.get("uberon"), "faces": int(len(m.faces)), "color": palette(ns, len(nodes)),
                               "cx": float(m.centroid[0]), "cy": float(m.centroid[1]), "cz": float(m.centroid[2])})
            ns += 1
        dst = os.path.join(OUT, slug + ".glb")
        out.export(dst)
        whole = next((e for e in g["data"] if (e.get("object_reference") or {}).get("file_name") == fn), g["data"][0])
        models.append({"id": slug, "label": o["label"][0].upper() + o["label"][1:], "base": lbl, "sex": o["sex"],
                       "system": SYSTEM.get(lbl, "other"), "uberon": (o.get("representation_of") or "").rsplit("/", 1)[-1].replace("_", ":"),
                       "file": slug + ".glb", "bytes": os.path.getsize(dst), "faces_src": int(total), "nstruct": ns,
                       "dims_mm": dims, "version": ver, "source_url": f"https://lod.humanatlas.io/ref-organ/{slug}/{ver}",
                       "glb_url": url, "creators": [c.get("fullName") or c.get("label") for c in (whole.get("creators") or [])],
                       "creation_date": whole.get("create_date")})
        print(f"{slug:32s} {ns:4d} structures {total:8d} -> {os.path.getsize(dst) // 1024:6d} KB", flush=True)

    uber = {s["uberon"] for s in structures if s["uberon"]} | {m["uberon"] for m in models if m["uberon"]}
    uber = {u for u in uber if u.startswith("UBERON:")}
    print(len(uber), "UBERON ids", flush=True)
    wd_path = os.path.join(CACHE, "wd_uberon.json")
    wd = json.load(open(wd_path)) if os.path.exists(wd_path) else {}
    miss = uber - {k for k, v in wd.items() if v}
    if miss: wd.update({u: {} for u in miss}); wd.update(wikidata_for(miss)); json.dump(wd, open(wd_path, "w"))
    ob_path = os.path.join(CACHE, "uberon_defs.json")
    ob = json.load(open(ob_path)) if os.path.exists(ob_path) else {}
    miss = uber - {k for k, v in ob.items() if v.get("v2")}
    if miss: ob.update(uberon_defs(miss)); json.dump(ob, open(ob_path, "w"))
    wk_path = os.path.join(CACHE, "wiki_hra.json")
    wk = json.load(open(wk_path)) if os.path.exists(wk_path) else {}
    miss = {d.get("enwiki") for d in wd.values() if d.get("enwiki")} - set(wk)
    if miss: wk.update(wiki_extracts(miss)); json.dump(wk, open(wk_path, "w"))

    c = connect()
    mesh_ok = {r[0] for r in c.execute("SELECT id FROM concepts")}
    fma_ok = {r[0] for r in c.execute("SELECT fma FROM anatomy_concepts")}
    c.executescript("""
    DROP TABLE IF EXISTS organ_models; DROP TABLE IF EXISTS organ_structures;
    CREATE TABLE organ_models(id TEXT PRIMARY KEY, label TEXT, base TEXT, sex TEXT, system TEXT, uberon TEXT, file TEXT, bytes INTEGER,
      faces_src INTEGER, nstruct INTEGER, dims_mm TEXT, version TEXT, source_url TEXT, glb_url TEXT, creators TEXT, creation_date TEXT,
      definition TEXT, wiki_title TEXT, wiki TEXT, mesh_id TEXT, fma TEXT, qid TEXT);
    CREATE TABLE organ_structures(organ TEXT, node TEXT, label TEXT, uberon TEXT, faces INTEGER, color TEXT, cx REAL, cy REAL, cz REAL,
      definition TEXT, synonyms TEXT, wiki_title TEXT, wiki TEXT, mesh_id TEXT, fma TEXT, qid TEXT, PRIMARY KEY(organ, node));
    """)

    def enrich(u):
        d = wd.get(u or "", {}); o = ob.get(u or "", {}); w = wk.get(d.get("enwiki") or "", {})
        return {"definition": clean_def(o.get("definition")), "synonyms": o.get("synonyms") or [], "wiki_title": w.get("title") if w else None,
                "wiki": w.get("text") if w else None, "mesh_id": d.get("mesh") if d.get("mesh") in mesh_ok else None,
                "fma": d.get("fma") if d.get("fma") in fma_ok else None, "qid": d.get("qid")}

    base_path = os.path.join(CACHE, "base_uberon.json")
    base_ids = json.load(open(base_path)) if os.path.exists(base_path) else {}
    for m in models:
        if m["base"] not in base_ids: base_ids[m["base"]] = ols_exact(m["base"])[0]
    json.dump(base_ids, open(base_path, "w"))
    extra = {u for u in base_ids.values() if u and not (ob.get(u) or {}).get("v2")}
    if extra: ob.update(uberon_defs(extra)); json.dump(ob, open(ob_path, "w"))
    titles = {ORGAN_WIKI.get(m["base"], m["base"][0].upper() + m["base"][1:]) for m in models}
    miss = {t for t in titles if t not in wk}
    if miss: wk.update(wiki_extracts(miss)); json.dump(wk, open(wk_path, "w"))
    for m in models:
        e = enrich(m["uberon"])
        bu = base_ids.get(m["base"])
        if bu and (not e["definition"] or m["label"].lower().startswith(("left", "right"))):
            e["definition"] = clean_def((ob.get(bu) or {}).get("definition")) or e["definition"]
        w = wk.get(ORGAN_WIKI.get(m["base"], m["base"][0].upper() + m["base"][1:]))
        if w: e["wiki"], e["wiki_title"] = w["text"], w["title"]
        c.execute("INSERT INTO organ_models VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (m["id"], m["label"], m["base"], m["sex"], m["system"], m["uberon"], m["file"], m["bytes"], m["faces_src"], m["nstruct"],
                   J(m["dims_mm"]), m["version"], m["source_url"], m["glb_url"], J(m["creators"]), m["creation_date"],
                   e["definition"], e["wiki_title"], e["wiki"], e["mesh_id"], e["fma"], e["qid"]))
    nd = nw = 0
    for s in structures:
        e = enrich(s["uberon"]); nd += bool(e["definition"]); nw += bool(e["wiki"])
        c.execute("INSERT OR REPLACE INTO organ_structures VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (s["organ"], s["node"], s["label"], s["uberon"], s["faces"], s["color"], s["cx"], s["cy"], s["cz"],
                   e["definition"], J(e["synonyms"]), e["wiki_title"], e["wiki"], e["mesh_id"], e["fma"], e["qid"]))
    meta(c, "organ_models", {"source": "Human Reference Atlas 3D Reference Organ Library (HuBMAP, NIH Common Fund)",
                             "url": "https://humanatlas.io/3d-reference-library", "license": "CC BY 4.0",
                             "data": "Visible Human Male/Female (U.S. National Library of Medicine); Allen Human Brain Atlas",
                             "definitions": "UBERON (CC BY 3.0) via EBI OLS; Wikipedia (CC BY-SA 4.0) via Wikidata P1554",
                             "models": len(models), "structures": len(structures)})
    ov = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "organ_definitions.json")
    if os.path.exists(ov):  # reviewed organ-level definitions override automated ones
        for label, d in json.load(open(ov)).items():
            if not label.startswith("_"):
                c.execute("UPDATE organ_models SET definition=? WHERE label=?", (d, label))
    c.commit()
    print(len(models), "models", len(structures), "structures;", nd, "with UBERON definition,", nw, "with Wikipedia text")


if __name__ == "__main__":
    run()
