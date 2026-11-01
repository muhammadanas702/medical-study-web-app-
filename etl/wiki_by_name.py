"""Second pass for anatomy articles: match FMA concepts that have no Wikidata->enwiki link to a Wikipedia article by name.

Safety checks (to avoid attaching the wrong article):
  * the title must resolve to a real article (redirects followed), not a disambiguation page;
  * the lead section must contain anatomical vocabulary;
  * one Wikipedia article is only accepted for a concept whose name equals the article title or one of its redirects.
Writes RAW_DIR/wd_fma_names.json ({fma: title}) and appends fetched articles to RAW_DIR/wiki_anat.json.
"""
import json, os, re, time, urllib.parse, urllib.request
from bp3d_tree import RAW
from bp3d_tree import Tree, classify
from wiki_fetch import fetch, UA

ANAT = re.compile(r"\b(anatom|muscle|bone|artery|arteries|vein|nerve|organ|ligament|gland|tissue|cartilage|tendon|vessel|joint|skull|cortex|lobe|gyrus|nucleus|duct|membrane|body|human|vertebra|cavity|chamber|valve|sinus|fascia|lymph|tract|canal|fossa)", re.I)
LAT = re.compile(r"\b(left|right) ")

def resolve(titles):
    """Batch-resolve up to 50 titles -> {asked: (final_title or None, is_disambig)}."""
    q = {"action": "query", "format": "json", "titles": "|".join(titles), "redirects": 1, "prop": "pageprops", "ppprop": "disambiguation"}
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(q)
    for i in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)); break
        except Exception:
            time.sleep(2 + 3 * i)
    else:
        return {}
    qd = d.get("query", {})
    norm = {x["from"]: x["to"] for x in qd.get("normalized", [])}
    redir = {x["from"]: x["to"] for x in qd.get("redirects", [])}
    pages = {p["title"]: p for p in qd.get("pages", {}).values()}
    out = {}
    for t in titles:
        f = norm.get(t, t); f = redir.get(f, f)
        p = pages.get(f)
        if not p or "missing" in p or "invalid" in p: out[t] = (None, False)
        else: out[t] = (p["title"], "disambiguation" in (p.get("pageprops") or {}))
    return out

def run():
    t = Tree()
    wd = json.load(open(os.path.join(RAW, "wd_fma.json")))
    wiki_path = os.path.join(RAW, "wiki_anat.json")
    wiki = json.load(open(wiki_path))
    out_path = os.path.join(RAW, "wd_fma_names.json")
    found = json.load(open(out_path)) if os.path.exists(out_path) else {}
    by_name = {}
    for f, n in t.name.items(): by_name.setdefault(n.lower(), f)
    import zipfile
    z = zipfile.ZipFile(os.path.join(RAW, "bp3d_isa_obj.zip"))
    fjs = [os.path.basename(n)[:-4] for n in z.namelist() if n.endswith(".obj")]
    want = set()
    for fj in fjs:
        r = classify(t, fj)
        if not r: continue
        leaf = r[0]
        g = by_name.get(LAT.sub("", t.name[leaf].lower()), leaf)
        want.update([leaf, g])
        for a in list(t.par["partof"][leaf]) + list(t.par["partof"][g]): want.add(a)
    def has_article(f):
        d = wd.get(f) or {}
        return d.get("enwiki") and wiki.get(d["enwiki"])
    todo = sorted(f for f in want if not has_article(f) and f not in found)
    cands = {}
    for f in todo:
        nm = LAT.sub("", t.name[f]).strip()
        if len(nm) < 3 or nm in ("human body",): continue
        cands[f] = nm[0].upper() + nm[1:]
    print("concepts without article:", len(todo), "candidates:", len(cands))
    items = list(cands.items()); ok = {}
    for i in range(0, len(items), 50):
        chunk = items[i:i + 50]
        res = resolve([c for _, c in chunk])
        for f, c in chunk:
            final, dis = res.get(c, (None, False))
            if final and not dis: ok[f] = final
        time.sleep(0.3)
    print("resolved:", len(ok))
    need = sorted({v for v in ok.values() if v not in wiki})
    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(4) as ex:
        for n, (title, art) in enumerate(ex.map(fetch, need)):
            wiki[title] = art
            if n % 100 == 0: print("fetched", n, len(need), flush=True)
    accepted = 0
    for f, title in ok.items():
        a = wiki.get(title)
        if not a or not ANAT.search(a.get("intro", "")[:1500]) or "may refer to" in a.get("intro", "")[:300]: continue
        found[f] = title; accepted += 1
    json.dump(wiki, open(wiki_path, "w"))
    json.dump(found, open(out_path, "w"), indent=0)
    print("accepted:", accepted, "total name matches:", len(found))

if __name__ == "__main__":
    run()
