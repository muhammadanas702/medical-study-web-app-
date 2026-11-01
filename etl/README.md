# Data pipeline

`python3 etl/build_all.py` rebuilds `data/content.db` from raw downloads placed in `RAW_DIR` (default `/tmp/data`).
Install Python deps first: `pip install -r etl/requirements.txt`.

## Raw files

| File in RAW_DIR | Download |
|---|---|
| `desc2026.gz` | https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc2026.gz |
| `pa2026.xml` | https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/pa2026.xml |
| `mplus.xml` | MedlinePlus health topic XML (latest `mplus_topics_YYYY-MM-DD.xml`) from https://medlineplus.gov/xml.html |
| `icd10/Code Descriptions/icd10cm_order_2027.txt` | FY2027 "Code Descriptions in Tabular Order" zip from https://www.cms.gov/medicare/coding-billing/icd-10-codes |
| `fda/drug-label-*.json.zip`, `fda/drug-ndc-*.json.zip`, `fda/device-classification-*.json.zip`, `fda/drug-shortages-*.json.zip` | file list at https://api.fda.gov/download.json |
| `bp3d_*.txt`, `bp3d_partof_obj.zip` | https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ (`partof_*` and `isa_*` lists, `partof_BP3D_4.0_obj_99.zip`) |
| NIH 3D models | fetched by `pathogens3d.py` from https://3d.nih.gov |

## Steps (in order)

1. `mesh.py` — MeSH descriptors, tree numbers, entry terms, pharmacologic actions, full-text index
2. `misc.py` — MedlinePlus, ICD-10-CM, FDA devices, NDC products, shortages, NBME labs
3. `fda_labels.py` — choose the most complete current Rx label per active ingredient
4. `fda_load.py` — load label sections, link to MeSH
5. `dedupe_drugs.py` — merge duplicate ingredients (e.g. "metformin" and "metformin hydrochloride"), keep aliases
6. `drug_classes.py` — FDA EPC / MoA / PE / CS classes from the NDC directory
7. `anatomy3d.py` — BodyParts3D meshes per system → `client/public/models/anatomy/*.glb`
8. `pathogens3d.py` — NIH 3D pathogen models → `client/public/models/pathogens/`
9. `questions.py` — question generation plus `data/curated_vignettes.json`
10. `mesh_case.py` — restore natural casing of MeSH ALL-CAPS cross references

After rebuilding, regenerate the committed parts:

```bash
python3 -c "import gzip;d=gzip.compress(open('data/content.db','rb').read(),9);P=45*2**20;[open(f'data/content.db.gz.part{i//P:02d}','wb').write(d[i:i+P]) for i in range(0,len(d),P)]"
```
