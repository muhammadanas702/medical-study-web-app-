"""PubChem (NCBI, public domain data) enrichment for every FDA-labelled drug ingredient.

drug ingredient name -> PubChem CID -> formula, weight, IUPAC name, SMILES, InChIKey, physicochemical
properties and a short description. 3D conformers are fetched by the browser from PubChem at view time.
Rate limit: <= 5 requests/second (https://pubchem.ncbi.nlm.nih.gov/docs/programmatic-access).
"""
import json, os, re, time, urllib.request, urllib.parse
from common import connect, J, meta

RAW = os.environ.get("RAW_DIR", "/tmp/data")
CACHE = os.path.join(RAW, "pubchem_cache.json")
UA = {"User-Agent": "VesaliusMedStudy-ETL/1.0 (educational)"}
BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
PROPS = "MolecularFormula,MolecularWeight,IUPACName,SMILES,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Charge,ExactMass,HeavyAtomCount"
SALTS = r"\b(hydrochloride|hcl|sodium|potassium|calcium|magnesium|sulfate|sulphate|mesylate|maleate|tartrate|bitartrate|citrate|phosphate|acetate|besylate|fumarate|succinate|bromide|chloride|hydrobromide|monohydrate|dihydrate|trihydrate|hyclate|dipropionate|propionate|valerate|furoate|lactate|gluconate|tromethamine|disodium|dimesylate|hemifumarate|anhydrous|extended-release|liposome|liposomal|kit|injection|topical)\b"
_last = [0.0]

def get(url):
    wait = 0.22 - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    for i in range(4):
        _last[0] = time.time()
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40))
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(1 + 2 * i)
        except Exception:
            time.sleep(1 + 2 * i)
    return None

def ingredients(generic_key):
    out = []
    for x in re.split(r"\s\+\s|,\s*|\s+and\s+", generic_key or "", flags=re.I):
        x = x.strip(" .;")
        if len(x) > 2 and x.lower() not in ("and", "with"): out.append(x)
    return out

def cid_for(name, cache):
    if name in cache["name"]: return cache["name"][name]
    cid = None
    for q in (name, re.sub(r"\s+", " ", re.sub(SALTS, "", name)).strip()):
        if not q: continue
        d = get(f"{BASE}/compound/name/{urllib.parse.quote(q)}/cids/JSON")
        ids = (d or {}).get("IdentifierList", {}).get("CID") or []
        if ids: cid = ids[0]; break
    cache["name"][name] = cid
    return cid

def run():
    cache = {"name": {}, "props": {}, "desc": {}}
    if os.path.exists(CACHE): cache.update(json.load(open(CACHE)))
    c = connect()
    rows = c.execute("SELECT slug, generic_key FROM drugs").fetchall()
    names = sorted({i for _, g in rows for i in ingredients(g)})
    print("ingredients", len(names), flush=True)
    for n, nm in enumerate(names):
        cid_for(nm, cache)
        if n % 200 == 0:
            json.dump(cache, open(CACHE, "w")); print(n, sum(1 for v in cache["name"].values() if v), flush=True)
    cids = sorted({v for v in cache["name"].values() if v and str(v) not in cache["props"]})
    for i in range(0, len(cids), 100):
        d = get(f"{BASE}/compound/cid/{','.join(map(str, cids[i:i+100]))}/property/{PROPS}/JSON")
        for p in (d or {}).get("PropertyTable", {}).get("Properties", []):
            cache["props"][str(p["CID"])] = p
    for cid in sorted({str(v) for v in cache["name"].values() if v}):
        if cid in cache["desc"]: continue
        d = get(f"{BASE}/compound/cid/{cid}/description/JSON")
        infos = (d or {}).get("InformationList", {}).get("Information", [])
        title = next((x.get("Title") for x in infos if x.get("Title")), None)
        descs = [{"text": x["Description"], "source": x.get("DescriptionSourceName"), "url": x.get("DescriptionURL")} for x in infos if x.get("Description")]
        cache["desc"][cid] = {"title": title, "descs": descs[:3]}
    json.dump(cache, open(CACHE, "w"))
    c.executescript("""
    DROP TABLE IF EXISTS compounds; DROP TABLE IF EXISTS drug_compounds;
    CREATE TABLE compounds(cid INTEGER PRIMARY KEY, title TEXT, formula TEXT, mw REAL, iupac TEXT, smiles TEXT, inchikey TEXT, xlogp REAL,
      tpsa REAL, hbd INTEGER, hba INTEGER, rotb INTEGER, charge INTEGER, exact_mass REAL, heavy_atoms INTEGER, descriptions TEXT);
    CREATE TABLE drug_compounds(slug TEXT, ingredient TEXT, cid INTEGER, ord INTEGER, PRIMARY KEY(slug, ord));
    """)
    for cid, p in cache["props"].items():
        de = cache["desc"].get(cid, {})
        c.execute("INSERT OR REPLACE INTO compounds VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (int(cid), de.get("title"), p.get("MolecularFormula"), float(p["MolecularWeight"]) if p.get("MolecularWeight") else None,
                   p.get("IUPACName"), p.get("SMILES") or p.get("CanonicalSMILES"), p.get("InChIKey"), p.get("XLogP"), p.get("TPSA"),
                   p.get("HBondDonorCount"), p.get("HBondAcceptorCount"), p.get("RotatableBondCount"), p.get("Charge"),
                   float(p["ExactMass"]) if p.get("ExactMass") else None, p.get("HeavyAtomCount"), J(de.get("descs") or [])))
    for slug, g in rows:
        for k, nm in enumerate(ingredients(g)):
            c.execute("INSERT OR REPLACE INTO drug_compounds VALUES(?,?,?,?)", (slug, nm, cache["name"].get(nm), k))
    c.execute("CREATE INDEX dc_cid ON drug_compounds(cid)")
    n1 = c.execute("SELECT COUNT(*) FROM compounds").fetchone()[0]
    n2 = c.execute("SELECT COUNT(DISTINCT slug) FROM drug_compounds WHERE cid IS NOT NULL").fetchone()[0]
    print("compounds", n1, "drugs with structure", n2)
    meta(c, "pubchem", {"source": "PubChem, National Center for Biotechnology Information", "url": "https://pubchem.ncbi.nlm.nih.gov",
                        "license": "Public domain (NCBI); individual descriptions keep their source attribution", "compounds": n1, "drugs_linked": n2,
                        "note": "Biologics (antibodies, enzymes, vaccines, cell therapies) usually have no small-molecule structure."})
    c.commit()

if __name__ == "__main__":
    run()
