"""Rebuild data/content.db from raw public sources. See etl/README.md for download URLs."""
import subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
steps = [
    "mesh.py", "misc.py", "fda_labels.py", "fda_load.py", "dedupe_drugs.py", "drug_classes.py",
    "wikidata_fma.py", "wiki_fetch.py", "wiki_by_name.py",       # FMA -> Wikidata -> Wikipedia text for 3D parts
    "anatomy3d.py", "pathogens3d.py",
    "questions.py",
    "openstax.py", "pubchem.py", "compound_svg.py", "book_questions_merge.py",       # textbooks/figures, PubChem compounds, textbook questions (after questions.py)
    "mesh_case.py",
    "hra_organs.py", "dailymed_images.py", "pathogen_facts.py",   # HRA 3D organs + UBERON, DailyMed drug images, pathogen fact sheets (after pathogens3d.py + questions.py)
]
for s in steps:
    print("==>", s, flush=True)
    subprocess.check_call([sys.executable, os.path.join(here, s)], cwd=here)
import sqlite3
c = sqlite3.connect(os.path.join(os.path.dirname(here), "data", "content.db")); c.execute("VACUUM"); c.close()
print("done")
