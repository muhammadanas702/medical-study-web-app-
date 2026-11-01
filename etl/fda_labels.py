"""openFDA drug labeling (SPL) bulk export -> one best current label per generic name. Public domain (FDA)."""
import zipfile, ijson, glob, sys, pickle
from multiprocessing import Pool
from common import *

SECTIONS = ["boxed_warning","indications_and_usage","dosage_and_administration","dosage_forms_and_strengths",
  "contraindications","warnings_and_cautions","warnings","precautions","adverse_reactions","drug_interactions",
  "use_in_specific_populations","pregnancy","lactation","pediatric_use","geriatric_use","overdosage","description",
  "mechanism_of_action","pharmacodynamics","pharmacokinetics","clinical_pharmacology","how_supplied","storage_and_handling",
  "drug_abuse_and_dependence","controlled_substance","information_for_patients"]

def score(r):
    s = 0
    for k in ("mechanism_of_action","indications_and_usage","dosage_and_administration","adverse_reactions","contraindications"):
        if r.get(k): s += 10
    return (s, r.get("effective_time",""))

def scan(path):
    best = {}
    z = zipfile.ZipFile(path); name = z.namelist()[0]
    with z.open(name) as f:
        for r in ijson.items(f, "results.item"):
            of = r.get("openfda") or {}
            gens = of.get("generic_name") or []
            pt = (of.get("product_type") or [""])[0]
            if not gens or pt != "HUMAN PRESCRIPTION DRUG": continue
            g = re.sub(r"\s+"," ",gens[0].strip().upper())
            if len(g) > 120: continue
            rec = {k: "\n\n".join(r[k]) for k in SECTIONS if r.get(k)}
            rec["effective_time"] = r.get("effective_time","")
            rec["set_id"] = r.get("set_id"); rec["id"] = r.get("id")
            rec["brand"] = of.get("brand_name") or []; rec["route"] = of.get("route") or []
            rec["epc"] = of.get("pharm_class_epc") or []; rec["moa"] = of.get("pharm_class_moa") or []
            rec["pe"] = of.get("pharm_class_pe") or []; rec["cs"] = of.get("pharm_class_cs") or []
            rec["manufacturer"] = (of.get("manufacturer_name") or [""])[0]
            rec["rxcui"] = of.get("rxcui") or []; rec["unii"] = of.get("unii") or []
            rec["substance"] = of.get("substance_name") or []
            rec["generic_display"] = gens[0].strip()
            cur = best.get(g)
            if cur is None or score(rec) > score(cur):
                if cur: rec["brand"] = sorted(set(rec["brand"]) | set(cur["brand"]))
                best[g] = rec
            else:
                cur["brand"] = sorted(set(cur["brand"]) | set(rec["brand"]))
    print("scanned", path, len(best), flush=True)
    return best

def run():
    files = sorted(glob.glob(os.path.join(RAW, "fda", "drug-label-*.zip")))
    with Pool(2) as p: parts = p.map(scan, files)
    best = {}
    for part in parts:
        for g, rec in part.items():
            cur = best.get(g)
            if cur is None or score(rec) > score(cur):
                if cur: rec["brand"] = sorted(set(rec["brand"]) | set(cur["brand"]))
                best[g] = rec
            else: cur["brand"] = sorted(set(cur["brand"]) | set(rec["brand"]))
    pickle.dump(best, open(os.path.join(RAW, "labels.pkl"), "wb"))
    print("generics", len(best))

if __name__ == "__main__": run()
