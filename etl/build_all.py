"""Rebuild data/content.db from raw public sources. See etl/README.md for download URLs."""
import subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
steps = ["mesh.py", "misc.py", "fda_labels.py", "fda_load.py", "dedupe_drugs.py", "drug_classes.py", "anatomy3d.py", "pathogens3d.py", "questions.py", "mesh_case.py"]
for s in steps:
    print("==>", s, flush=True)
    subprocess.check_call([sys.executable, os.path.join(here, s)], cwd=here)
import sqlite3
c = sqlite3.connect(os.path.join(os.path.dirname(here), "data", "content.db")); c.execute("VACUUM"); c.close()
print("done")
