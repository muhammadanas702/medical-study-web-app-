"""FMA-based classification of every BodyParts3D 4.0 element (isa + partof trees).

System assignment uses the FMA class hierarchy (is-a) for tissue type and the FMA part-of
hierarchy for organ-system membership, instead of matching words in names.
"""
import collections, os, re
RAW = os.environ.get("RAW_DIR", "/tmp/data")

def rows(f):
    return [l.rstrip("\n").split("\t") for l in open(os.path.join(RAW, f), encoding="utf-8")][1:]

class Tree:
    def __init__(self):
        self.par = {"isa": collections.defaultdict(set), "partof": collections.defaultdict(set)}
        self.ch = {"isa": collections.defaultdict(set), "partof": collections.defaultdict(set)}
        self.name = {}
        self.elems = collections.defaultdict(set)      # concept -> FJ files (union of both trees)
        self.fjc = collections.defaultdict(set)        # FJ -> concepts
        self.rep = {}                                  # concept -> BP representation id
        for t in ("isa", "partof"):
            for p, pn, c, cn in rows(f"bp3d_{t}_inclusion_relation_list.txt"):
                self.par[t][c].add(p); self.ch[t][p].add(c); self.name[p] = pn; self.name[c] = cn
            for c, n, fj in rows(f"bp3d_{t}_element_parts.txt"):
                fj = fj.strip(); self.elems[c].add(fj); self.fjc[fj].add(c); self.name[c] = n
            for c, bp, n in rows(f"bp3d_{t}_parts_list_e.txt"):
                self.rep[c] = bp; self.name.setdefault(c, n)
        self._anc = {}

    def anc(self, t, c):
        k = (t, c)
        if k in self._anc: return self._anc[k]
        out = set(); stack = list(self.par[t][c])
        while stack:
            p = stack.pop()
            if p in out: continue
            out.add(p); stack.extend(self.par[t][p])
        self._anc[k] = out
        return out

    def leaf(self, fj):
        """Most specific concept whose element set is exactly/most nearly this file."""
        bad = ("subdivision of", "content of", "compartment of", "set of heterogeneous", "side of", "heterogeneous cluster",
               "integument", "anatomical cluster", "cardinal body part")
        def key(c):
            n = self.name[c].lower()
            pen = 1 if (n.startswith(bad) or n.endswith("system") or n in ("parenchyma", "right hip", "left hip")) else 0
            gen = re.sub(r"\b(left|right) ", "", n)
            depth = len(self.anc("isa", c)) or max((len(self.anc("isa", g)) for g in self.fjc[fj] if self.name[g].lower() == gen), default=0)
            return (len(self.elems[c]), pen, -depth, n)
        cs = sorted(self.fjc[fj], key=key)
        return cs[0] if cs else None

ISA_TYPE = [  # (system, substrings of an is-a ancestor name) checked in order
    ("cardiovascular", ["artery", "vein", "vascular tree", "venous trunk", "arterial trunk", "cardiac chamber", "heart valve", "wall of heart", "region of wall of heart", "myocardium", "coronary sinus", "pericardi"]),
    ("skeletal", ["bone organ", "cartilage organ", "intervertebral disk", "articular disk", "ligament", "joint", "skeleton", "bone of", "zone of bone"]),
    ("muscular", ["muscle organ", "tendon", "fascia", "aponeurosis", "retinaculum"]),
    ("nervous", ["neuraxis", "nerve", "neural tree", "segment of brain", "gyrus", "ganglion", "spinal cord", "ventricular system"]),
]
PARTOF_SYS = [
    ("sensory", ["eye", "eyeball", "orbit", "visual system", "ear", "auditory", "vestibulocochlear organ", "lacrimal apparatus"]),
    ("cardiovascular", ["cardiovascular system", "vasculature of body", "heart", "vascular system"]),
    ("nervous", ["nervous system", "neuraxis", "brain", "spinal cord"]),
    ("respiratory", ["respiratory system", "lung", "respiratory tract", "bronchial tree", "larynx"]),
    ("digestive", ["alimentary system", "liver", "biliary tree", "pancreas", "gastrointestinal tract", "mouth", "pharynx"]),
    ("urinary", ["urinary system", "kidney", "urinary bladder"]),
    ("reproductive", ["genital system", "male genital system", "female genital system"]),
    ("endocrine", ["endocrine system", "thyroid gland", "adrenal gland", "pituitary gland", "hypophysis"]),
    ("integumentary", ["integumentary system", "integument", "skin"]),
    ("muscular", ["deep fascial system", "muscular system"]),
    ("skeletal", ["skeletal system"]),
]
ISA_ORGAN = [
    ("sensory", ["eyeball", "eye", "lens", "cornea", "retina", "sclera", "lacrimal gland", "ear ", "cochlea", "auditory ossicle", "tympanic"]),
    ("respiratory", ["tracheobronchial", "bronchial tree", "lung", "larynx", "trachea", "nasal cavity", "pleura"]),
    ("digestive", ["tooth", "intestine", "stomach", "liver", "hepatic", "biliary", "pancrea", "esophagus", "colon", "zone of small intestine", "zone of ileum", "zone of jejunum", "tongue", "salivary gland", "spleen", "gallbladder", "rectum", "anal canal"]),
    ("urinary", ["kidney", "ureter", "urinary bladder", "urethra", "renal"]),
    ("reproductive", ["prostate", "testis", "ovary", "uterus", "vagina", "penis", "seminal vesicle", "ductus deferens"]),
    ("endocrine", ["thyroid", "parathyroid", "adrenal gland", "suprarenal", "pituitary", "hypophysis", "pineal", "thymus"]),
    ("integumentary", ["skin", "integument"]),
]
REGION = [("head & neck", ["head", "neck"]), ("thorax", ["thorax", "chest", "thoracic"]), ("abdomen", ["abdomen"]),
          ("pelvis & perineum", ["pelvis", "perineum"]), ("back", ["back"]),
          ("upper limb", ["upper limb"]), ("lower limb", ["lower limb"])]

def _hit(names, rules):
    for sysname, keys in rules:
        for k in keys:
            for n in names:
                if n == k or n.startswith(k) or f" {k}" in f" {n}":
                    return sysname
    return None

def lineage(t: Tree, c):
    """Names of the is-a and part-of ancestors of a single concept (and of its generic is-a class)."""
    isa = {t.name[a].lower() for a in t.anc("isa", c)}
    part = {t.name[a].lower() for a in t.anc("partof", c)}
    return isa, part

def classify(t: Tree, fj):
    leaf = t.leaf(fj)
    if not leaf: return None
    isa, part = lineage(t, leaf)
    # A lateralised leaf ("left sclera") often only has part-of links; borrow the is-a lineage of its generic class.
    generic = re.sub(r"\b(left|right) ", "", t.name[leaf].lower())
    for c in t.fjc[fj]:
        if t.name[c].lower() == generic and c != leaf:
            gi, gp = lineage(t, c); isa |= gi | {generic}; part |= gp
    leafname = t.name[leaf].lower()
    s = _hit(isa | {leafname}, ISA_TYPE) or _hit(part, PARTOF_SYS) or _hit(isa | {leafname}, ISA_ORGAN) or _name_rule(leafname) or "other"
    if s == "nervous" and _hit(part, PARTOF_SYS[:1]): s = "sensory"   # optic/retinal neural parts of the eye
    organ = None
    for a in sorted(t.anc("partof", leaf), key=lambda a: len(t.elems[a])):
        ai = {t.name[x].lower() for x in t.anc("isa", a)}
        if "organ" in ai and not t.name[a].lower().endswith("system"):
            organ = a; break
    return leaf, s, organ

NAME_RULES = [
    ("cardiovascular", r"arter|\bveins?\b|venous|palmar arch|plantar arch|branches of .*aorta"),
    ("skeletal", r"interosseous membrane|pelvic girdle|\bhip bone|sternum|xiphoid"),
    ("muscular", r"interossei|lumbricals|intertransversarii|interspinales|levatores|trapezius|tendinous ring|raphe|linea alba"),
    ("reproductive", r"deferent duct|epididymis|mons pubis|prostate|vagina|uterus|ovary"),
    ("sensory", r"external ear|auricle|eyelid|eyebrow"),
    ("respiratory", r"conus elasticus|thyrohyoid membrane|epiglottis|larynx"),
    ("nervous", r"dura mater|subarachnoid|interventricular foramen|ciliary nerve|ganglion|tentorium|interpeduncular"),
    ("digestive", r"hepatovenous|pharynx|mouth|\blip\b|pancrea"),
]
def _name_rule(n):
    for sysname, rx in NAME_RULES:
        if re.search(rx, n): return sysname
    return None
