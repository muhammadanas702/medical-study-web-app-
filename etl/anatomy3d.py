"""BodyParts3D 4.0 (DBCLS, CC BY-SA 2.1 JP) -> per-system GLB files + anatomy_parts table."""
import io, trimesh, numpy as np, fast_simplification
from bp3d_classify import classify, RAW
from common import connect, J, meta
import zipfile, os, collections, json
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "public", "models", "anatomy")
BUDGET = {"skeletal":260000,"cardiovascular":150000,"nervous":160000,"muscular":90000,"digestive":110000,"respiratory":60000,
          "urinary":30000,"endocrine":12000,"reproductive":8000,"integumentary":60000}

def run():
    os.makedirs(OUT, exist_ok=True)
    out, cel, cname = classify()
    z = zipfile.ZipFile(os.path.join(RAW, "bp3d_partof_obj.zip"))
    meshes = collections.defaultdict(list)
    for fj, (leaf, name, sysname, path) in out.items():
        if sysname == "other": continue
        m = trimesh.load(io.BytesIO(z.read(path)), file_type="obj", force="mesh", process=False)
        meshes[sysname].append((fj, name, m))
    c = connect()
    c.executescript("DROP TABLE IF EXISTS anatomy_parts; CREATE TABLE anatomy_parts(fj TEXT PRIMARY KEY, fma TEXT, name TEXT, system TEXT, mesh_id TEXT, cx REAL, cy REAL, cz REAL);")
    names = {}
    for cid, nm, et in c.execute("SELECT id, name, entry_terms FROM concepts WHERE cats LIKE '%A%'"):
        names.setdefault(nm.lower(), cid)
        for t in json.loads(et or "[]"): names.setdefault(t.lower(), cid)
    import re
    allb = np.vstack([m.bounds for ms in meshes.values() for _,_,m in ms]); lo, hi = allb.min(0), allb.max(0)
    center = (lo + hi) / 2
    info = {}
    for sysname, ms in meshes.items():
        total = sum(len(m.faces) for _,_,m in ms); ratio = min(1.0, BUDGET.get(sysname, 50000) / total)
        scene = trimesh.Scene(); kept = 0
        for fj, name, m in ms:
            v = (m.vertices - center) / 1000.0  # metres, centred
            v = v[:, [0, 2, 1]] * np.array([1, 1, -1])  # Z-up -> Y-up
            f = m.faces
            if ratio < 0.98 and len(f) > 400:
                target = max(1 - max(ratio, 300 / len(f)), 0)
                v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=target)
            mm = trimesh.Trimesh(v, f, process=True); kept += len(mm.faces)
            scene.add_geometry(mm, node_name=fj, geom_name=fj)
            ctr = mm.bounds.mean(0)
            fma = next((cc for cc in sorted(cel, key=lambda x: len(cel[x])) if fj in cel[cc]), None)
            base = re.sub(r"^(left|right) ", "", name.lower())
            mesh_id = names.get(name.lower()) or names.get(base) or names.get(base.split(" of ")[0] if " of " in base else "")
            if base.startswith("skeleton of"):  # "skeleton of mouth" is not the whole-body Skeleton heading
                mesh_id = None
            c.execute("INSERT OR REPLACE INTO anatomy_parts VALUES(?,?,?,?,?,?,?,?)", (fj, out[fj][0], name, sysname, mesh_id, *map(float, ctr)))
        fn = os.path.join(OUT, f"{sysname}.glb"); scene.export(fn)
        info[sysname] = {"parts": len(ms), "faces": kept, "bytes": os.path.getsize(fn)}
        print(sysname, len(ms), total, "->", kept, os.path.getsize(fn) // 1024, "KB", flush=True)
    meta(c, "anatomy3d", {"source":"BodyParts3D 4.0, The Database Center for Life Science (DBCLS)","license":"CC BY-SA 2.1 JP","url":"https://lifesciencedb.jp/bp3d/","data_url":"https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/","systems":info,"note":"Meshes decimated for web delivery; names are FMA (Foundational Model of Anatomy) terms."})
    c.commit()

if __name__ == "__main__": run()
