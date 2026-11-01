"""DailyMed (U.S. National Library of Medicine) SPL media -> drug_images table.

For each drug label already in the `drugs` table (by SPL set id) this collects the list of images the
manufacturer submitted with the label: package / carton labels (principal display panel), tablet and capsule
photos, chemical structure drawings and figures. Images stay hosted by DailyMed (public domain U.S. government
service); only the URLs and file names are stored. API: https://dailymed.nlm.nih.gov/dailymed/webservices-help/v2/spls_setid_media_api.cfm
"""
import json, subprocess, concurrent.futures as cf, os, time, re
from common import connect, meta, RAW

CACHE = os.path.join(RAW, "dailymed_media")
UA = "VesaliusMedStudy/1.0 (educational ETL)"


def fetch(setid):
    p = os.path.join(CACHE, setid + ".json")
    if os.path.exists(p) and os.path.getsize(p) > 20:
        try: return setid, json.load(open(p))
        except Exception: pass
    for i in range(3):
        out = subprocess.run(["curl", "-sL", "--max-time", "60", "-A", UA,
                              f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}/media.json"],
                             capture_output=True, text=True).stdout
        try:
            d = json.loads(out); json.dump(d, open(p, "w")); return setid, d
        except Exception:
            time.sleep(2 + 2 * i)
    return setid, None


def kind(name):
    n = name.lower()
    if re.search(r"(carton|label|pdp|principal|package|pack|container|vial|bottle|box|blister|panel)", n): return "package"
    if re.search(r"(tablet|tab|capsule|cap|pill)", n): return "product"
    if re.search(r"(struct|formula|chem)", n): return "structure"
    return "image"


def run():
    os.makedirs(CACHE, exist_ok=True)
    c = connect()
    rows = c.execute("SELECT slug, set_id FROM drugs WHERE set_id IS NOT NULL AND set_id<>''").fetchall()
    print(len(rows), "labels", flush=True)
    res = {}
    with cf.ThreadPoolExecutor(8) as ex:
        for i, (sid, d) in enumerate(ex.map(fetch, [r[1] for r in rows])):
            res[sid] = d
            if i % 200 == 0: print(i, flush=True)
    c.executescript("DROP TABLE IF EXISTS drug_images; CREATE TABLE drug_images(slug TEXT, seq INTEGER, name TEXT, url TEXT, kind TEXT, spl_version INTEGER, published TEXT); CREATE INDEX drug_images_slug ON drug_images(slug);")
    n = withimg = 0
    for slug, sid in rows:
        d = res.get(sid)
        if not d or "data" not in d: continue
        media = [m for m in d["data"].get("media", []) if (m.get("mime_type") or "").startswith("image/")]
        if media: withimg += 1
        for i, m in enumerate(media):
            c.execute("INSERT INTO drug_images VALUES(?,?,?,?,?,?,?)", (slug, i, m["name"], m["url"], kind(m["name"]), d["data"].get("spl_version"), d["data"].get("published_date")))
            n += 1
    meta(c, "drug_images", {"source": "DailyMed SPL media, U.S. National Library of Medicine", "url": "https://dailymed.nlm.nih.gov/dailymed/",
                            "license": "Public domain U.S. government service; images are part of the manufacturer's FDA-submitted label",
                            "images": n, "drugs_with_images": withimg})
    c.commit()
    print(n, "images for", withimg, "drugs")


if __name__ == "__main__":
    run()
