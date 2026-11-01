"""Question bank built only from authoritative structured sources, so every keyed answer is traceable:
 - MeSH 2026 definitions (term <- scope note), sibling distractors from the same MeSH tree branch
 - MeSH pharmacologic actions for drugs; FDA Established Pharmacologic Class (EPC) from openFDA labels
 - MeSH organism taxonomy (family membership) for bacteria, viruses, fungi and parasites
 - MeSH anatomy hierarchy (structure -> parent structure)
 - NBME laboratory reference values
 - Curated USMLE-style clinical vignettes (data/curated_vignettes.json)
"""
import random, collections
from common import *
random.seed(20261101)
MESH_URL = "https://meshb.nlm.nih.gov/record/ui?ui="
SYSTEM_RULES = [
 ("Cardiovascular", r"cardi|circulat|vascular|\bheart|coronar|arter(y|ies|ial)|\bveins?\b|venous|aort|myocard|valv"),
 ("Respiratory", r"respirat|\blungs?\b|pulmonar|bronch|trache|pleura|alveol|laryn|pneumo"),
 ("Gastrointestinal", r"digestive|gastro|stomatognathic|\boral\b|\bmouth|esophag|stomach|intestin|colon|rectal|\bliver|hepat|biliar|pancrea|\bbowel|duoden"),
 ("Renal & Urogenital", r"urogenital|urinary|urolog|\bkidney|renal|nephr|glomerul|bladder|ureth|ureter"),
 ("Reproductive", r"reproduct|pregnan|genital|ovar|uter(us|ine)|testi|prostat|obstetric|placent|menstru|\bbreast"),
 ("Endocrine & Metabolic", r"endocrin|metabol|nutrition|diabet|thyroid|adrenal|pituitar|insulin|hormon|glyc"),
 ("Nervous & Special Senses", r"nervous|neural|neuro|\bsense|\beyes?\b|ocular|retin|otorhinolaryng|\bear\b|\bbrain|cerebr|spinal cord|cranial nerve"),
 ("Musculoskeletal & Skin", r"musculoskeletal|\bskin\b|integument|connective tissue|dermat|\bbones?\b|skelet|muscl|\bjoints?\b|cartilag|tendon"),
 ("Hematology & Immunology", r"hemic|hematolog|immun|lymph|\bblood\b|anemi|leukocyt|erythrocyt|platelet|coagul|spleen"),
 ("Microbiology & Infection", r"infect|virus|viral|bacteri|fung|parasit|microbio|organism"),
 ("Oncology", r"neoplasm|tumou?r|cancer|carcinom|sarcom|lymphoma|leukemi"),
 ("Psychiatry & Behavior", r"mental|behavio|psych"),
]
DISC = {"A":"Anatomy","B":"Microbiology","C":"Pathology","D":"Pharmacology","E":"Clinical Procedures","F":"Behavioral Science","G":"Physiology"}

def system_of(name):
    n = (name or "").lower()
    for s, rx in SYSTEM_RULES:
        if re.search(rx, n): return s
    return "General Principles"

def system_for(tree, cpt, tns=None):
    """Organ system for a concept.  Each MeSH tree location votes with the first rule matched along
    its path (general -> specific); name/scope-note keywords break ties.  This keeps e.g. the
    Glomerular Filtration Barrier (filed under both Urogenital and Cardiovascular trees) in Renal."""
    score = collections.Counter(); order = {s: i for i, (s, _) in enumerate(SYSTEM_RULES)}
    for tn in (tns or cpt["tns"]):
        for nm in path_names(tree, tn)[1:] or path_names(tree, tn):
            sy = system_of(nm)
            if sy != "General Principles": score[sy] += 2; break
    nm = (cpt["name"] or "").lower(); sn = (cpt["sn"] or "").lower()
    for sy, rx in SYSTEM_RULES:
        if re.search(rx, nm): score[sy] += 3
        score[sy] += min(2, len(re.findall(rx, sn)))
    if not score or max(score.values()) <= 0: return "General Principles"
    return sorted(score.items(), key=lambda kv: (-kv[1], order[kv[0]]))[0][0]

def load(c):
    con = {}
    for cid, name, sn, tns, cats, et, pa in c.execute("SELECT id,name,scope_note,tree_numbers,cats,entry_terms,pharm_actions FROM concepts"):
        con[cid] = dict(id=cid, name=name, sn=sn, tns=json.loads(tns or "[]"), cats=cats, et=json.loads(et or "[]"), pa=json.loads(pa or "[]"))
    tree = {tn: (cid, parent, depth, name) for tn, cid, parent, depth, name in c.execute("SELECT tn,id,parent,depth,name FROM tree")}
    kids = collections.defaultdict(list)
    for tn, (cid, parent, depth, name) in tree.items(): kids[parent].append(tn)
    return con, tree, kids

def first_sentence(s, n=220):
    s = s or ""; m = re.match(r"(.+?\.)(\s|$)", s); s = m.group(1) if m else s
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"

def soften(text, names_upper):
    # MeSH writes cross-referenced descriptors in CAPITALS; show them in normal case when they are descriptor names.
    def rep(m):
        w = m.group(0)
        return names_upper.get(w, w)
    return re.sub(r"\b[A-Z][A-Z0-9\-]{2,}(?:\s+[A-Z][A-Z0-9\-]{1,})*\b", rep, text)

def mask(text, terms):
    out = text
    for t in sorted(set(terms), key=len, reverse=True):
        if len(t) < 3: continue
        out = re.sub(r"(?i)\b" + re.escape(t) + r"s?\b", "_____", out)
    return out

def ancestors(tn):
    parts = tn.split("."); return {".".join(parts[:i]) for i in range(1, len(parts))} | {tn[:1]}

def top_name(tree, tn):
    return tree.get(tn.split(".")[0], (None, None, None, ""))[3]

def path_names(tree, tn):
    parts = tn.split("."); return [tree[".".join(parts[:i])][3] for i in range(1, len(parts) + 1) if ".".join(parts[:i]) in tree]

NONHUMAN = re.compile(r"\bplants?\b|insects?\b|\bfish|\bbirds?\b|avian|poultry|cattle|swine|\bpigs?\b|\bmice\b|murine|monkey|\bapes?\b|feline|canine|bovine|ovine|equine|sheep|goats?\b|rodent|chicken|tobacco|tomato|potato|\bcrops?\b|marine|plankton", re.I)
PATHOGEN_PATH = re.compile(r"Bacteria|Viruses|Fungi|Platyhelminthes|Nematoda|Apicomplexa|Euglenozoa|Amoebozoa|Metamonada|Parabasalidea|Culicidae|Ixodidae|Anoplura|Siphonaptera")
def allowed_def(con, tree, cid, tn, drug_mesh):
    k = tn[0]
    if re.search(r"Environment|Weather|Ecolog|Plant", " ".join(path_names(tree, tn))): return False
    if k == "A" and tn[:3] in ("A13", "A18", "A19"): return False
    if k == "G" and tn[:3] in ("G01", "G02", "G15", "G17"): return False
    if k == "D": return cid in drug_mesh
    if k == "B":
        return bool(PATHOGEN_PATH.search(" ".join(path_names(tree, tn)))) and not NONHUMAN.search(con[cid]["sn"] or "")
    if k in "CEF": return True
    if k in "AG": return True
    return False

def Q(qid, kind, disc, system, stem, ask, options, answer, explanation, rationales, objective, concept_id, source, url):
    return dict(id=qid, kind=kind, discipline=disc, system=system, stem=stem, ask=ask, options=options, answer=answer, explanation=explanation,
                rationales=rationales, objective=objective, concept_id=concept_id, source=source, source_url=url)

def shuffle(correct, distractors, rat_correct, rat_d):
    opts = [(correct, rat_correct, True)] + list(zip(distractors, rat_d, [False] * len(distractors)))
    random.shuffle(opts)
    return [o[0] for o in opts], next(i for i, o in enumerate(opts) if o[2]), [o[1] for o in opts]

def gen_definitions(con, tree, kids, drug_mesh, names_upper):
    out = []
    for cid, cpt in con.items():
        sn = cpt["sn"]
        if not sn or not (40 <= len(sn) <= 700) or not cpt["tns"]: continue
        tn = sorted(cpt["tns"], key=lambda t: (t.count("."), t))[0]
        if "." not in tn or not allowed_def(con, tree, cid, tn, drug_mesh): continue
        parent = tree[tn][1]
        terms = [cpt["name"]] + cpt["et"]
        tset = {t.lower() for t in terms}
        sibs = []
        for s in kids.get(parent, []):
            sid = tree[s][0]
            if sid == cid: continue
            sc = con.get(sid)
            if not sc or not sc["sn"] or sc["name"].lower() in tset: continue
            if cpt["name"].lower() in {t.lower() for t in sc["et"]}: continue
            if cid in {tree[a][0] for a in ancestors(s) if a in tree}: continue
            sibs.append(sc)
        if len(sibs) < 4: continue
        d = random.sample(sibs, 4)
        stem_text = mask(soften(sn, names_upper), terms)
        if "_____" not in stem_text and any(t.lower() in stem_text.lower() for t in terms if len(t) > 3): continue
        if any(re.search(r"(?i)\b" + re.escape(x["name"]) + r"\b", stem_text) for x in d): continue
        opts, ans, rats = shuffle(cpt["name"], [x["name"] for x in d],
            f"Correct. MeSH defines {cpt['name']} as: {first_sentence(soften(sn, names_upper))}",
            [f"{x['name']}: {first_sentence(soften(x['sn'], names_upper))}" for x in d])
        cat = tn[0]
        out.append(Q(f"def-{cid}", "definition", DISC[cat], system_for(tree, cpt),
            f"Definition: \u201c{stem_text}\u201d", "Which term matches this definition?", opts, ans,
            f"{cpt['name']} — {soften(sn, names_upper)}\n\nMeSH hierarchy: " + " › ".join(path_names(tree, tn)),
            rats, f"Recognise {cpt['name']} and distinguish it from related {tree[parent][3]} concepts.", cid,
            "MeSH 2026, U.S. National Library of Medicine", MESH_URL + cid))
    return out

def gen_pharm_actions(con, tree, drug_mesh):
    out = []
    pa_ids = collections.Counter(p for cid in drug_mesh for p in con[cid]["pa"] if cid in con)
    pool = [p for p, n in pa_ids.most_common(250) if p in con]
    for cid in drug_mesh:
        cpt = con.get(cid)
        if not cpt or not cpt["pa"]: continue
        own = set(cpt["pa"]); own_tns = set()
        for p in own:
            for t in con.get(p, {}).get("tns", []): own_tns |= ancestors(t) | {t}
        def unrelated(p):
            for t in con[p]["tns"]:
                if t in own_tns or any(o.startswith(t + ".") for o in own_tns): return False
            return p not in own
        cands = [p for p in pool if unrelated(p)]
        if len(cands) < 4: continue
        ans_pa = sorted(own, key=lambda p: -pa_ids[p])[0]
        if ans_pa not in con: continue
        d = random.sample(cands[:120], 4)
        allpa = ", ".join(con[p]["name"] for p in own if p in con)
        opts, ans, rats = shuffle(con[ans_pa]["name"], [con[p]["name"] for p in d],
            f"Correct. MeSH assigns {cpt['name']} the pharmacologic action(s): {allpa}.",
            [f"{con[p]['name']}: {first_sentence(con[p]['sn'])} Not a MeSH pharmacologic action of {cpt['name']}." for p in d])
        out.append(Q(f"pa-{cid}", "pharmacologic_action", "Pharmacology", "Pharmacology", f"A patient is prescribed {cpt['name']}.",
            f"Which pharmacologic action is assigned to {cpt['name']} in MeSH?", opts, ans,
            f"{cpt['name']}: {cpt['sn'] or ''}\n\nPharmacologic actions (MeSH): {allpa}.", rats,
            f"Know the drug class / action of {cpt['name']}.", cid, "MeSH 2026 Pharmacologic Actions, NLM", MESH_URL + cid))
    return out

def gen_epc(c):
    out = []; rows = list(c.execute("SELECT slug, generic, generic_key, epc, set_id, mechanism_of_action FROM drugs WHERE epc!='[]' AND generic_key NOT LIKE '% AND %' AND generic_key NOT LIKE '%,%'"))
    allepc = collections.Counter(e for r in rows for e in json.loads(r[3]))
    pool = [e for e, n in allepc.most_common() if n >= 3]
    for slug, generic, key, epc, set_id, moa in rows:
        own = set(json.loads(epc)); ans = sorted(own, key=lambda e: -allepc[e])[0]
        # never offer a distractor that shares a substantive word with a correct class
        # (e.g. "Opioid Agonist" vs "Full Opioid Agonist") - avoids two defensible answers
        GENERIC_W = {"inhibitor", "agonist", "antagonist", "blocker", "agent", "class", "[epc]", "activator", "receptor", "partial", "modulator", "analog"}
        own_w = {w for e in own for w in e.lower().replace("-", " ").split() if w not in GENERIC_W and len(w) > 3}
        cands = [e for e in pool if e not in own and not (own_w & {w for w in e.lower().replace("-", " ").split()})]
        if len(cands) < 4 or len(generic) > 60: continue
        d = random.sample(cands[:150], 4); clean_ = lambda e: e.replace(" [EPC]", "")
        opts, a, rats = shuffle(clean_(ans), [clean_(e) for e in d], f"Correct. The FDA label for {generic} lists the Established Pharmacologic Class: {', '.join(map(clean_, own))}.",
            [f"{clean_(e)} is not an established pharmacologic class for {generic}." for e in d])
        out.append(Q(f"epc-{slug}", "fda_class", "Pharmacology", "Pharmacology", f"{generic} is prescribed for a patient.",
            f"What is the FDA Established Pharmacologic Class (EPC) of {generic}?", opts, a,
            f"FDA Established Pharmacologic Class: {', '.join(map(clean_, own))}." + (f"\n\nMechanism of action (FDA label): {first_sentence(clean(moa), 600)}" if moa else ""),
            rats, f"Classify {generic} by its FDA pharmacologic class.", slug, "FDA drug label (openFDA / DailyMed)",
            f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}"))
    return out

def gen_taxonomy(con, tree):
    out = []
    fam = {}
    for tn, (cid, parent, depth, name) in tree.items():
        if tn.startswith("B") and re.search(r"(viridae|aceae)$", name): fam[tn] = name
    for cid, cpt in con.items():
        if not cpt["cats"] or "B" not in cpt["cats"]: continue
        for tn in cpt["tns"]:
            if not tn.startswith(("B03", "B04", "B01")): continue
            if tree[tn][3] in fam.values(): continue
            if not PATHOGEN_PATH.search(" ".join(path_names(tree, tn))) or NONHUMAN.search(cpt["sn"] or ""): continue
            fams = [a for a in sorted(ancestors(tn)) if a in fam]
            if not fams: continue
            f = fams[-1]; group = f[:3]
            own = {fam[a] for t in cpt["tns"] for a in ancestors(t) if a in fam}
            cands = sorted({n for t, n in fam.items() if t.startswith(group) and n not in own})
            if len(cands) < 4: break
            d = random.sample(cands, 4)
            opts, a, rats = shuffle(fam[f], d, f"Correct. In MeSH, {cpt['name']} sits under {fam[f]}: " + " › ".join(path_names(tree, tn)) + ".",
                [f"{x} is a different family." for x in d])
            out.append(Q(f"tax-{cid}", "taxonomy", "Microbiology", "Microbiology & Infection", f"Organism: {cpt['name']}.",
                f"To which family does {cpt['name']} belong?", opts, a, (cpt["sn"] or "") + "\n\nTaxonomy (MeSH): " + " › ".join(path_names(tree, tn)), rats,
                f"Place {cpt['name']} in its family.", cid, "MeSH 2026 Organisms tree, NLM", MESH_URL + cid))
            break
    return out

def gen_anatomy(con, tree, kids):
    out = []
    for cid, cpt in con.items():
        tns = [t for t in cpt["tns"] if t.startswith(("A01","A02","A03","A04","A05","A06","A07","A08","A09","A14","A15","A17")) and t.count(".") >= 2]
        if not tns or not cpt["sn"]: continue
        tn = sorted(tns)[0]; parent = tree[tn][1]; pname = tree[parent][3]
        if pname.lower() in cpt["name"].lower(): continue
        own_anc = {tree[a][3] for t in cpt["tns"] for a in ancestors(t) if a in tree}
        level = [x for x in tree if x.startswith(tn[:3]) and x.count(".") == parent.count(".") and tree[x][3] not in own_anc and tree[x][0] != cid]
        level = sorted({tree[x][3] for x in level} - {cpt["name"]})
        if len(level) < 4: continue
        d = random.sample(level, 4)
        opts, a, rats = shuffle(pname, d, f"Correct. MeSH places {cpt['name']} under {pname}: " + " › ".join(path_names(tree, tn)) + ".",
            [f"{x} is a separate structure in the {top_name(tree, tn)} hierarchy." for x in d])
        out.append(Q(f"anat-{cid}", "anatomy_hierarchy", "Anatomy", system_for(tree, cpt, tns), f"Structure: {cpt['name']}. {first_sentence(cpt['sn'], 300)}",
            f"Under which broader structure is {cpt['name']} classified?", opts, a, cpt["sn"] + "\n\nHierarchy (MeSH): " + " › ".join(path_names(tree, tn)), rats,
            f"Locate {cpt['name']} within {top_name(tree, tn)}.", cid, "MeSH 2026 Anatomy tree, NLM", MESH_URL + cid))
    return out

def gen_labs(c):
    out = []; rows = list(c.execute("SELECT id, section, subsection, test, conventional, si FROM labs"))
    for i, sec, sub, test, conv, si in rows:
        unit = conv.split()[-1]
        same = [r[4] for r in rows if r[0] != i and r[4] != conv and r[4].split()[-1] == unit]
        other = [r[4] for r in rows if r[0] != i and r[4] != conv and r[4] not in same]
        pool = same if len(same) >= 4 else same + other
        d = random.sample(sorted(set(pool)), 4)
        opts, a, rats = shuffle(conv, d, f"Correct. NBME reference range for {test}: {conv} (SI: {si}).", [f"{x} is the reference range of a different test." for x in d])
        out.append(Q(f"lab-{i}", "lab_value", "Physiology", "Laboratory Medicine", f"{sec}{' — ' + sub if sub else ''}: {test}.",
            f"What is the NBME reference range for {test}?", opts, a, f"{test}: {conv}; SI units {si}. Source: NBME Laboratory Values (the table provided during USMLE exams).",
            rats, f"Know the normal range for {test}.", str(i), "NBME Laboratory Values", "https://www.nbme.org/laboratory-values/"))
    return out

def gen_vignettes():
    p = os.path.join(ROOT, "data", "curated_vignettes.json")
    if not os.path.exists(p): return []
    out = []
    for v in json.load(open(p)):
        out.append(Q(v["id"], "vignette", v["discipline"], v["system"], v["stem"], v["ask"], v["options"], v["answer"], v["explanation"], v["rationales"], v["objective"],
                     v.get("mesh_id"), v.get("source", "Curated USMLE-style vignette"), v.get("source_url")))
    return out

def run():
    c = connect(); con, tree, kids = load(c)
    drug_mesh = {r[0] for r in c.execute("SELECT DISTINCT mesh_id FROM drugs WHERE mesh_id IS NOT NULL")}
    names_upper = {}
    for cpt in con.values():
        keep_case = "B" in (cpt["cats"] or "")
        for t in [cpt["name"]] + cpt["et"]:
            if t.isupper() or re.search(r"[A-Z]{2}", t): continue
            names_upper.setdefault(t.upper(), t if keep_case else t.lower())
    qs = gen_vignettes() + gen_labs(c) + gen_pharm_actions(con, tree, drug_mesh) + gen_epc(c) + gen_taxonomy(con, tree) + gen_anatomy(con, tree, kids) + gen_definitions(con, tree, kids, drug_mesh, names_upper)
    seen = set(); final = []
    for q in qs:
        if q["id"] in seen: continue
        assert len(q["options"]) == 5 and len(set(o.lower() for o in q["options"])) == 5, q["id"]
        assert 0 <= q["answer"] < 5 and len(q["rationales"]) == 5
        seen.add(q["id"]); final.append(q)
    c.executescript("DROP TABLE IF EXISTS questions; CREATE TABLE questions(id TEXT PRIMARY KEY, kind TEXT, discipline TEXT, system TEXT, stem TEXT, ask TEXT, options TEXT, answer INTEGER, explanation TEXT, rationales TEXT, objective TEXT, concept_id TEXT, source TEXT, source_url TEXT); DROP TABLE IF EXISTS questions_fts;")
    c.executemany("INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [(q["id"], q["kind"], q["discipline"], q["system"], q["stem"], q["ask"], J(q["options"]), q["answer"], q["explanation"], J(q["rationales"]), q["objective"], q["concept_id"], q["source"], q["source_url"]) for q in final])
    c.execute("CREATE INDEX q_kind ON questions(kind)"); c.execute("CREATE INDEX q_sys ON questions(system)"); c.execute("CREATE INDEX q_disc ON questions(discipline)")
    cnt = collections.Counter(q["kind"] for q in final)
    meta(c, "questions", {"total": len(final), "by_kind": cnt}); c.commit()
    print(len(final), cnt)

if __name__ == "__main__": run()
