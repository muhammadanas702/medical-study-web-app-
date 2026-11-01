"""NIH 3D (https://3d.nih.gov) pathogen models -> client/public/models/pathogens + models table."""
import re, os, subprocess, html, json
from common import connect, J, meta
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "public", "models", "pathogens")
IDS_PATHOGEN = ["3DPX-013323","3DPX-015438","3DPX-015448","3DPX-013373","3DPX-012849","3DPX-016170","3DPX-007978","3DPX-000004","3DPX-001519","3DPX-009584","3DPX-008414","3DPX-003150"]
LIC = {"cc-by.png":"CC BY 4.0","cc-by-sa.png":"CC BY-SA 4.0","cc-by-nc.png":"CC BY-NC 4.0","cc-by-nc-sa.png":"CC BY-NC-SA 4.0","publicdomain.png":"Public Domain","cc0.png":"CC0","public-domain.png":"Public Domain"}
IDS_PATHOGEN += ["3DPX-014632","3DPX-003873","3DPX-003515","3DPX-001386","3DPX-001515","3DPX-016305","3DPX-000030","3DPX-000006","3DPX-011089","3DPX-010783","3DPX-003184"]
# open-hardware medical devices, prosthetics and lab equipment (real CAD designs shared for 3D printing)
IDS_DEVICE = ["3DPX-013814","3DPX-020260","3DPX-022002","3DPX-000996","3DPX-000524","3DPX-020277","3DPX-012299","3DPX-023682"]
IDS_LAB = ["3DPX-022834","3DPX-003287","3DPX-003288","3DPX-012802","3DPX-013579","3DPX-022833","3DPX-018235"]
IDS_ANATOMY = ["3DPX-002432","3DPX-011385"]
IDS = [(i, "pathogen") for i in IDS_PATHOGEN] + [(i, "device") for i in IDS_DEVICE] + [(i, "lab") for i in IDS_LAB] + [(i, "anatomy") for i in IDS_ANATOMY]
def get(u): return subprocess.run(["curl","-sL","--max-time","60",u],capture_output=True,text=True).stdout
def size(u):
    h = subprocess.run(["curl","-sI",u],capture_output=True,text=True).stdout
    m = re.search(r"content-length: (\d+)", h, re.I); return int(m.group(1)) if m else 10**12
def shrink(path, faces=90000):
    import trimesh, fast_simplification, numpy as np
    sc = trimesh.load(path); total = sum(len(g.faces) for g in sc.geometry.values()); r = min(1, faces / total)
    for k, g in list(sc.geometry.items()):
        if len(g.faces) < 500: continue
        g.merge_vertices()
        v, f = fast_simplification.simplify(g.vertices.astype(np.float32), g.faces.astype(np.int32), target_reduction=1 - r)
        ng = trimesh.Trimesh(v, f, process=False)
        try: ng.visual = trimesh.visual.TextureVisuals(material=g.visual.material)
        except Exception: pass
        sc.geometry[k] = ng
    sc.export(path)

def run():
    os.makedirs(OUT, exist_ok=True); c = connect()
    c.executescript("DROP TABLE IF EXISTS models; CREATE TABLE models(id TEXT PRIMARY KEY, title TEXT, description TEXT, license TEXT, file TEXT, bytes INTEGER, source_url TEXT, category TEXT);")
    for i, cat in IDS:
        dst0 = os.path.join(OUT, f"{i}.glb")
        p = get(f"https://3d.nih.gov/entries/{i}")
        t = re.search(r'<meta property="og:title" content="([^"]*)"', p) or re.search(r"<title>([^<]*)</title>", p)
        d = re.search(r'<meta name="description" content="([^"]*)"', p) or re.search(r'<meta property="og:description" content="([^"]*)"', p)
        lic = next((v for k, v in LIC.items() if f"/images/licenses/{k}" in p), "See source")
        q = p.replace('\\"', '"')
        files = [(int(m.group(2)), m.group(3)) for m in re.finditer(r'"name":"([^"]+\.glb)".{0,600}?"fileSize":(\d+).{0,400}?"outputFileUrl":"([^"]+)"', q, re.S)]
        if not files: print("no glb", i); continue
        files.sort(); sz, u = next(((s_, u_) for s_, u_ in files if s_ < 14e6), files[0])
        if sz > 90e6: print("too big", i, sz); continue
        if "NC" in lic or "ND" in lic: print("skip: restrictive license", i, lic); continue
        fn = f"{i}.glb"; dst = os.path.join(OUT, fn)
        if not (os.path.exists(dst) and os.path.getsize(dst) > 1000):
            subprocess.run(["curl","-sL","--max-time","300","-o",dst,"https://3d.nih.gov/api" + u])
        if os.path.getsize(dst) > 12e6: shrink(dst)
        mt = re.search(r'"submission":\{.*?"metadata":\{.*?"title":"([^"]+)"', q, re.S); title = mt.group(1) if mt else i
        ml = re.search(r'"submission":\{.*?"metadata":\{.*?"license":"([^"]+)"', q, re.S)
        if ml and ml.group(1) in ("CC-BY-NC", "CC-BY-NC-SA", "CC-BY-ND", "CC-BY-NC-ND"): print("skip: restrictive license", i, ml.group(1)); os.remove(dst); continue
        if ml: lic = {"CC-BY":"CC BY 4.0","CC-BY-SA":"CC BY-SA 4.0","CC-BY-NC":"CC BY-NC 4.0","PD":"Public Domain","CC0":"CC0","Public Domain":"Public Domain"}.get(ml.group(1), ml.group(1))
        ma = re.search(r'"attributionInstructions":"((?:[^"\\]|\\.)*)"', q)
        credit = re.sub(r"<[^>]+>", "", html.unescape(json.loads('"' + ma.group(1) + '"'))).strip() if ma else ""
        c.execute("INSERT INTO models VALUES(?,?,?,?,?,?,?,?)", (i, title, credit or None, lic, fn, os.path.getsize(os.path.join(OUT, fn)), f"https://3d.nih.gov/entries/{i}", cat))
        print(i, title, lic, sz // 1024, "KB", flush=True)
    meta(c, "models", {"source":"NIH 3D, National Institutes of Health","url":"https://3d.nih.gov"}); c.commit()
if __name__ == "__main__": run()
