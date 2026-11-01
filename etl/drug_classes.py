"""Fill FDA pharmacologic classes (EPC/MoA/PE/CS) for drug records whose chosen label lacks an
openFDA block, using the FDA NDC directory, which carries the same FDA class vocabulary per
product.  Matching uses the same normalised ingredient key as dedupe_drugs.py.
Run after dedupe_drugs.py:  python etl/drug_classes.py data/content.db
"""
import json, os, sqlite3, sys, zipfile
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dedupe_drugs import key_of

DB = sys.argv[1] if len(sys.argv) > 1 else "data/content.db"
RAW = os.environ.get("RAW_DIR", "/tmp/data")
z = zipfile.ZipFile(os.path.join(RAW, "fda", "drug-ndc-0001-of-0001.json.zip"))
d = json.load(z.open(z.namelist()[0]))
classes = defaultdict(lambda: defaultdict(set))
for r in d["results"]:
    if r.get("product_type") != "HUMAN PRESCRIPTION DRUG":
        continue
    k = key_of(r.get("generic_name") or "")
    for pc in r.get("pharm_class") or []:
        for tag, fld in (("[EPC]", "epc"), ("[MoA]", "moa"), ("[PE]", "pe"), ("[CS]", "cs")):
            if pc.endswith(tag):
                classes[k][fld].add(pc)
c = sqlite3.connect(DB)
filled = 0
for slug, generic, epc, moa, pe, cs in list(c.execute("SELECT slug, generic, epc, moa, pe, cs FROM drugs")):
    k = key_of(generic)
    alt = classes.get(k) or classes.get(k + " hydrochloride")
    if not alt:
        continue
    cur = {"epc": json.loads(epc or "[]"), "moa": json.loads(moa or "[]"), "pe": json.loads(pe or "[]"), "cs": json.loads(cs or "[]")}
    changed = False
    for fld in cur:
        extra = [v for v in sorted(alt.get(fld, ())) if v not in cur[fld]]
        if extra:
            cur[fld] = cur[fld] + extra; changed = True
    if changed:
        filled += 1
        c.execute("UPDATE drugs SET epc=?, moa=?, pe=?, cs=? WHERE slug=?", (json.dumps(cur["epc"]), json.dumps(cur["moa"]), json.dumps(cur["pe"]), json.dumps(cur["cs"]), slug))
        c.execute("UPDATE drugs_fts SET classes=? WHERE slug=?", (" ".join(cur["epc"] + cur["moa"]), slug))
c.commit()
print("filled classes for", filled, "drugs;", c.execute("SELECT count(*) FROM drugs WHERE epc!='[]'").fetchone()[0], "now have an EPC")

# Normalised ingredient key on drugs / NDC products / shortages so the API can join them
# precisely (instead of prefix matching, which would link "Sodium Chloride" to every sodium salt).
for t in ("drugs", "ndc", "shortages"):
    cols = [r[1] for r in c.execute(f"PRAGMA table_info({t})")]
    if "ikey" not in cols:
        c.execute(f"ALTER TABLE {t} ADD COLUMN ikey TEXT")
    rows = list(c.execute(f"SELECT rowid, generic FROM {t}"))
    c.executemany(f"UPDATE {t} SET ikey=? WHERE rowid=?", [(key_of(g or ""), rid) for rid, g in rows])
    c.execute(f"CREATE INDEX IF NOT EXISTS {t}_ikey ON {t}(ikey)")
c.commit()
print("ikey:", {t: c.execute(f"SELECT count(DISTINCT ikey) FROM {t}").fetchone()[0] for t in ("drugs", "ndc", "shortages")})

# keep the provenance record in sync with the de-duplicated table
m = json.loads(c.execute("SELECT value FROM meta WHERE key='drugs'").fetchone()[0])
m["drugs"] = c.execute("SELECT count(*) FROM drugs").fetchone()[0]
m["mesh_linked"] = c.execute("SELECT count(*) FROM drugs WHERE mesh_id IS NOT NULL").fetchone()[0]
m["with_epc"] = c.execute("SELECT count(*) FROM drugs WHERE epc!='[]'").fetchone()[0]
m["selection"] = ("Most complete current human prescription label per active ingredient (duplicate labels for the same "
                  "ingredient merged; FDA pharmacologic classes supplemented from the FDA NDC directory)")
c.execute("UPDATE meta SET value=? WHERE key='drugs'", (json.dumps(m),))
c.commit()
print("meta drugs:", m["drugs"], m["mesh_linked"], m["with_epc"])
