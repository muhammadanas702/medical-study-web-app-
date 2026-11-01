"""Wikidata: every item with an FMA ID (P1402) -> label, MeSH (P486), TA98 (P1323), UBERON (P1554), English Wikipedia title.

Source: https://query.wikidata.org/sparql (Wikidata content is CC0).
Writes RAW_DIR/wd_fma.json as {"FMA7088": {"qid", "label", "mesh": [], "ta98": [], "uberon"?, "enwiki"?}}.
"""
import os, json, time, urllib.request, urllib.parse
from bp3d_tree import RAW

Q = """
SELECT ?item ?itemLabel ?fma ?mesh ?ta98 ?uberon ?article WHERE {
  ?item wdt:P1402 ?fma .
  OPTIONAL { ?item wdt:P486 ?mesh }
  OPTIONAL { ?item wdt:P1323 ?ta98 }
  OPTIONAL { ?item wdt:P1554 ?uberon }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""


def run():
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": Q, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": "VesaliusMedStudy-ETL/1.0 (educational; contact via GitHub)", "Accept": "application/sparql-results+json"})
    for attempt in range(4):
        try:
            rows = json.load(urllib.request.urlopen(req, timeout=300))["results"]["bindings"]
            break
        except Exception as e:  # WDQS throttles; back off and retry
            print("retry", attempt, e); time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit("Wikidata query failed")
    out = {}
    for r in rows:
        fma = "FMA" + r["fma"]["value"].lstrip("FMA")
        e = out.setdefault(fma, {"qid": r["item"]["value"].rsplit("/", 1)[1], "label": r["itemLabel"]["value"], "mesh": [], "ta98": []})
        for k in ("mesh", "ta98"):
            v = r.get(k, {}).get("value")
            if v and v not in e[k]: e[k].append(v)
        if "uberon" in r: e["uberon"] = r["uberon"]["value"]
        if "article" in r: e["enwiki"] = urllib.parse.unquote(r["article"]["value"].rsplit("/wiki/", 1)[1]).replace("_", " ")
    json.dump(out, open(os.path.join(RAW, "wd_fma.json"), "w"))
    print("FMA items", len(out), "with enwiki", sum("enwiki" in v for v in out.values()))


if __name__ == "__main__":
    run()
