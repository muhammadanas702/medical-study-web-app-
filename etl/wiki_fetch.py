"""Fetch plain-text Wikipedia articles (CC BY-SA 4.0) for a list of titles, split into sections.
Usage: python3 wiki_fetch.py titles.json out.json"""
import json, sys, time, urllib.request, urllib.parse, re, concurrent.futures as cf
UA = {"User-Agent": "VesaliusMedStudy-ETL/1.0 (educational project; https://github.com/muhammadanas702/medical-study-web-app-)"}
KEEP = re.compile(r"^(structure|anatomy|function|functions|physiology|clinical significance|clinical relevance|development|blood supply|nerve supply|innervation|variation|variations|microanatomy|histology|relations|location|course|branches|clinical|disease|diseases|pathology|attachments|action|actions|origin|insertion|embryology|imaging|examination|tributaries|drainage|composition|classification|mechanism|transmission|signs and symptoms|diagnosis|treatment|prevention|epidemiology|prognosis|virology|genome|replication|pathophysiology|cause|causes|medical uses|adverse effects|side effects|contraindications|pharmacology|pharmacodynamics|pharmacokinetics|interactions|overdose|uses|design|operation|types|history)", re.I)
def fetch(title):
    q = {"action": "query", "format": "json", "prop": "extracts|info|pageimages", "explaintext": 1, "exsectionformat": "wiki",
         "titles": title, "redirects": 1, "inprop": "url", "piprop": "original"}
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(q)
    for i in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)); break
        except Exception as e:
            time.sleep(2 + i * 3)
    else:
        return title, None
    pages = list(d.get("query", {}).get("pages", {}).values())
    if not pages or "missing" in pages[0]: return title, None
    p = pages[0]; txt = p.get("extract") or ""
    parts = re.split(r"\n(={2,3}) ([^=\n]+?) \1\n", "\n" + txt)
    intro = parts[0].strip(); secs = []
    for j in range(1, len(parts) - 2, 3):
        lvl, head, body = parts[j], parts[j + 1].strip(), parts[j + 2].strip()
        if not body: continue
        if lvl == "==" and not KEEP.match(head): continue
        if lvl == "===" and secs: secs[-1]["text"] += f"\n\n### {head}\n" + body; continue
        if lvl == "===": continue
        secs.append({"title": head, "text": body})
    for s in secs: s["text"] = s["text"][:6000]
    return title, {"title": p["title"], "url": p.get("fullurl"), "touched": p.get("touched"), "intro": intro[:4000],
                   "sections": secs[:10], "image": (p.get("original") or {}).get("source")}
if __name__ == "__main__":
    titles = json.load(open(sys.argv[1])); out = {}
    try: out = json.load(open(sys.argv[2]))
    except Exception: pass
    todo = [t for t in titles if t not in out]
    with cf.ThreadPoolExecutor(4) as ex:
        for n, (t, r) in enumerate(ex.map(fetch, todo)):
            out[t] = r
            if n % 100 == 0: print(n, len(todo), flush=True); json.dump(out, open(sys.argv[2], "w"))
    json.dump(out, open(sys.argv[2], "w")); print("done", len(out), sum(1 for v in out.values() if v))
