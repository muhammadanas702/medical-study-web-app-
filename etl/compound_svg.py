"""Draw a 2D structure (SVG) for every PubChem compound from its SMILES with RDKit, so the app needs no
external image requests (PubChem throttles bulk image loading). Run after pubchem.py."""
import re
from rdkit import Chem, RDLogger
from rdkit.Chem.Draw import rdMolDraw2D
from common import connect

RDLogger.DisableLog("rdApp.*")


def svg(smiles):
    m = Chem.MolFromSmiles(smiles or "")
    if m is None or m.GetNumAtoms() == 0 or m.GetNumAtoms() > 250: return None
    d = rdMolDraw2D.MolDraw2DSVG(300, 300)
    o = d.drawOptions(); o.clearBackground = False; o.bondLineWidth = 1.5; o.padding = 0.08
    d.DrawMolecule(m); d.FinishDrawing()
    s = d.GetDrawingText()
    s = s[s.index("<svg"):].replace("\n", "")
    s = re.sub(r"(\d+\.\d)\d+", r"\1", s)            # one decimal is plenty at 300 px
    s = re.sub(r"<!-- .*? -->", "", s).replace("stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1", "")
    s = re.sub(r" class='[^']*'", "", s).replace("fill:none;fill-rule:evenodd;", "fill:none;").replace("stroke-width:1.5px;", "")
    s = re.sub(r"\s{2,}", " ", s).replace("<svg ", "<svg stroke-width='1.5' ", 1).replace("'width=", "' width=")
    return s


def run():
    c = connect()
    try: c.execute("ALTER TABLE compounds ADD COLUMN svg TEXT")
    except Exception: pass
    n = 0
    for cid, smi in c.execute("SELECT cid, smiles FROM compounds").fetchall():
        s = svg(smi)
        if s: n += 1
        c.execute("UPDATE compounds SET svg=? WHERE cid=?", (s, cid))
    c.commit(); print("svg drawn", n)


if __name__ == "__main__":
    run()
