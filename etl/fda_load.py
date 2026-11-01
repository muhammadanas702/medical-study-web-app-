"""Load the selected labels (from fda_labels.py) into content.db and link to MeSH."""
import pickle
from common import *
from fda_labels import SECTIONS

def run():
    best = pickle.load(open(os.path.join(RAW, "labels.pkl"), "rb"))
    c = connect()
    names = {}
    for cid, name, et in c.execute("SELECT id, name, entry_terms FROM concepts WHERE cats LIKE '%D%'"):
        names.setdefault(name.upper(), cid)
        for t in json.loads(et or "[]"): names.setdefault(t.upper(), cid)
    cols = ", ".join(f"{s} TEXT" for s in SECTIONS)
    c.executescript(f"DROP TABLE IF EXISTS drugs; CREATE TABLE drugs(slug TEXT PRIMARY KEY, generic TEXT, generic_key TEXT, brands TEXT, routes TEXT, epc TEXT, moa TEXT, pe TEXT, cs TEXT, manufacturer TEXT, set_id TEXT, spl_id TEXT, effective TEXT, rxcui TEXT, mesh_id TEXT, {cols}); DROP TABLE IF EXISTS drugs_fts;")
    used = set(); linked = 0
    for g, r in sorted(best.items()):
        slug = re.sub(r"[^a-z0-9]+", "-", g.lower()).strip("-")[:80]
        base = slug; k = 2
        while slug in used: slug = f"{base}-{k}"; k += 1
        used.add(slug)
        key = g
        mesh = names.get(key)
        if not mesh:
            for s in r["substance"][:1]:
                mesh = names.get(s.upper())
        if not mesh:
            # strip salt words
            stripped = re.sub(r"\b(HYDROCHLORIDE|HCL|SODIUM|POTASSIUM|CALCIUM|MESYLATE|MALEATE|SULFATE|ACETATE|TARTRATE|CITRATE|SUCCINATE|BESYLATE|FUMARATE|PHOSPHATE|BROMIDE|DIHYDRATE|MONOHYDRATE|TRIHYDRATE|HYCLATE|DISODIUM|MAGNESIUM)\b", "", g)
            mesh = names.get(re.sub(r"\s+"," ",stripped).strip())
        if mesh: linked += 1
        vals = [slug, r["generic_display"].title() if r["generic_display"].isupper() else r["generic_display"], g, J(r["brand"]), J(r["route"]), J(r["epc"]), J(r["moa"]), J(r["pe"]), J(r["cs"]),
                r["manufacturer"], r["set_id"], r["id"], r["effective_time"], J(r["rxcui"]), mesh] + [r.get(s) for s in SECTIONS]
        c.execute(f"INSERT INTO drugs VALUES({','.join('?'*len(vals))})", vals)
    c.execute("CREATE INDEX drugs_key ON drugs(generic_key)"); c.execute("CREATE INDEX drugs_mesh ON drugs(mesh_id)")
    c.execute("CREATE VIRTUAL TABLE drugs_fts USING fts5(slug UNINDEXED, generic, brands, classes, indications, tokenize='porter unicode61')")
    c.execute("INSERT INTO drugs_fts SELECT slug, generic, brands, epc||' '||moa, substr(coalesce(indications_and_usage,''),1,1500) FROM drugs")
    meta(c, "drugs", {"source":"openFDA drug labeling (Structured Product Labeling), U.S. FDA; full labels on DailyMed (NLM)","url":"https://open.fda.gov/apis/drug/label/","selection":"One current human prescription label per generic name (most complete, most recent)","drugs":len(best),"mesh_linked":linked})
    c.commit(); print("drugs", len(best), "linked", linked)

if __name__ == "__main__" and not os.environ.get("ENRICH"): run(); enrich()

def enrich():
    """Fill pharmacologic classes from NDC openfda annotations when the chosen label lacks them; tidy brand list."""
    import zipfile, glob
    z = zipfile.ZipFile(glob.glob(os.path.join(RAW, "fda", "drug-ndc-*.zip"))[0]); d = json.load(z.open(z.namelist()[0]))
    agg = {}
    for r in d["results"]:
        k = re.sub(r"\s+"," ",(r.get("generic_name") or "").upper().strip()); of = r.get("openfda", {})
        a = agg.setdefault(k, {"epc":set(),"moa":set(),"pe":set(),"cs":set()})
        for f in a: a[f].update(of.get("pharm_class_"+f, []))
    c = connect(); n = 0
    for slug, key, epc, moa, pe, cs, brands, generic in list(c.execute("SELECT slug, generic_key, epc, moa, pe, cs, brands, generic FROM drugs")):
        a = agg.get(key); upd = {}
        if a:
            for f, cur in (("epc",epc),("moa",moa),("pe",pe),("cs",cs)):
                if cur == "[]" and a[f]: upd[f] = J(sorted(a[f]))
        seen = {}; 
        for b in json.loads(brands):
            if b.upper() == key or b.upper().startswith(key + " "): continue
            seen.setdefault(b.upper(), b if not b.isupper() else b.title())
        upd["brands"] = J(sorted(seen.values()))
        c.execute(f"UPDATE drugs SET {', '.join(f'{k}=?' for k in upd)} WHERE slug=?", list(upd.values()) + [slug]); n += 1
    c.execute("DELETE FROM drugs_fts"); c.execute("INSERT INTO drugs_fts SELECT slug, generic, brands, epc||' '||moa, substr(coalesce(indications_and_usage,''),1,1500) FROM drugs")
    c.commit(); print("enriched", n, c.execute("select count(*) from drugs where epc!='[]'").fetchone())

if __name__ == "__main__" and os.environ.get("ENRICH"): enrich()
