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
| `bp3d_isa_obj.zip` | BodyParts3D 4.0 is-a element OBJ files (same archive) |
| NIH 3D models | fetched by `pathogens3d.py` from https://3d.nih.gov |
| `wd_fma.json` | written by `wikidata_fma.py` from https://query.wikidata.org/sparql |
| `wiki_anat.json`, `wd_fma_names.json` | written by `wiki_fetch.py` / `wiki_by_name.py` from the English Wikipedia API |
| `/tmp/osbooks/osbooks-*` | `git clone https://github.com/openstax/osbooks-<book>` for the 12 books listed in `openstax.py` |
| PubChem | fetched by `pubchem.py` from https://pubchem.ncbi.nlm.nih.gov/rest/pug (rate-limited, ~1 h) |

## Steps (in order)

1. `mesh.py` — MeSH descriptors, tree numbers, entry terms, pharmacologic actions, full-text index
2. `misc.py` — MedlinePlus, ICD-10-CM, FDA devices, NDC products, shortages, NBME labs
3. `fda_labels.py` — choose the most complete current Rx label per active ingredient
4. `fda_load.py` — load label sections, link to MeSH
5. `dedupe_drugs.py` — merge duplicate ingredients (e.g. "metformin" and "metformin hydrochloride"), keep aliases
6. `drug_classes.py` — FDA EPC / MoA / PE / CS classes from the NDC directory
7. `wikidata_fma.py` — FMA ID → Wikidata item, TA98, MeSH, UBERON, English Wikipedia title
8. `wiki_fetch.py` — fetch those Wikipedia articles (sections, revision date)
9. `wiki_by_name.py` — name-match remaining FMA concepts to Wikipedia (disambiguation pages skipped, anatomy-vocabulary check)
10. `anatomy3d.py` — BodyParts3D meshes for 11 systems → `client/public/models/anatomy/*.glb`, parts, organ concepts, articles
11. `pathogens3d.py` — NIH 3D pathogen models → `client/public/models/pathogens/`
12. `questions.py` — question generation plus `data/curated_vignettes.json`
13. `openstax.py` — 12 OpenStax books: sections, figures, review questions
14. `pubchem.py` — PubChem compounds for FDA-label active ingredients (properties, descriptions, 3D conformers)
14b. `compound_svg.py` — 2D structure drawings (RDKit) from SMILES
15. `book_questions_merge.py` — add OpenStax review questions to the question bank (`os-` ids; must run after `questions.py`)
16. `mesh_case.py` — restore natural casing of MeSH ALL-CAPS cross references

After rebuilding, regenerate the committed parts:

```bash
python3 -c "import gzip;d=gzip.compress(open('data/content.db','rb').read(),9);P=45*2**20;[open(f'data/content.db.gz.part{i//P:02d}','wb').write(d[i:i+P]) for i in range(0,len(d),P)]"
```
