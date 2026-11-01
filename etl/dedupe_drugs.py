"""Merge duplicate FDA label entries that describe the same active ingredient(s).

openFDA contains one label per product/labeler, so the same ingredient appears under
many "generic_name" spellings ("Metformin Hcl", "Metformin ER 500 mg", "Metformin
Hydrochloride Tablets").  This pass groups them by a normalised ingredient key, keeps the
most complete label as the canonical record, unions pharmacologic classes / brands /
routes from all members, records aliases, and rewrites question references.
Run after fda_load.py and questions.py:  python etl/dedupe_drugs.py data/content.db
"""
import json
import re
import sqlite3
import sys
from collections import defaultdict

DB = sys.argv[1] if len(sys.argv) > 1 else "data/content.db"

STRENGTH = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:%|mg|mcg|µg|g|ml|meq|units?|iu|mg/ml|mcg/ml)(?![a-z0-9])", re.I)
FORM_WORDS = r"""tablets? capsules? oral injection injectable extended-release extended release
 delayed-release delayed release er xr xl sr cr dr odt solution suspension usp chewable film-coated
 for of orally disintegrating ophthalmic topical cream ointment gel lotion kit vial prefilled syringe
 pen auto-injector film coated coated concentrate powder liquid elixir syrup spray patch transdermal sublingual""".split()
FORM = re.compile(r"\b(?:" + "|".join(w.replace("-", r"\-") for w in FORM_WORDS) + r")\b", re.I)
ABBREV = [(r"\bhctz\b", "hydrochlorothiazide"), (r"\bclav(?:ulanate)? pot(?:assium)?\b", "clavulanate potassium"),
          (r"\bsusp\b", " "), (r"\bsoln\b", " "), (r"\binj\b", " "), (r"\btabs?\b", " "), (r"\bcaps?\b", " ")]
SALTS = """hydrochloride hcl hydrobromide sulfate sulphate sodium potassium calcium magnesium maleate
 mesylate besylate tartrate bitartrate citrate acetate succinate fumarate phosphate dihydrate
 monohydrate hemihydrate trihydrate anhydrous bromide chloride""".split()


def clean(name: str) -> str:
    s = (name or "").lower()
    for pat, rep in ABBREV:
        s = re.sub(pat, rep, s)
    s = STRENGTH.sub(" ", s)
    s = FORM.sub(" ", s)
    s = re.sub(r"[^a-z0-9,/&+ -]", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" ,-")
    return s


def key_of(name: str) -> str:
    s = clean(name)
    parts = re.split(r"\s*(?:,|\band\b|/|\+|&)\s*", s)
    out = []
    for p in parts:
        toks = [t for t in p.split() if t]
        # Conservative: only HCl/hydrochloride spellings are treated as equivalent.  Other salts
        # (potassium vs sodium, acetate vs succinate) are distinct products and stay separate.
        toks = ["hydrochloride" if t == "hcl" else t for t in toks]
        if toks:
            out.append(" ".join(toks))
    return " + ".join(sorted(set(out)))


def main():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    cols = [r[1] for r in c.execute("PRAGMA table_info(drugs)")]
    section_cols = cols[cols.index("mesh_id") + 1:]
    rows = [dict(r) for r in c.execute("SELECT * FROM drugs")]
    groups = defaultdict(list)
    for r in rows:
        groups[key_of(r["generic"]) or r["slug"]].append(r)

    # a bare ingredient name ("Metformin") is the same moiety as its hydrochloride label
    for k in list(groups):
        if "+" not in k and (k + " hydrochloride") in groups and k in groups:
            groups[k + " hydrochloride"].extend(groups.pop(k))
    c.execute("CREATE TABLE IF NOT EXISTS drug_alias(slug TEXT PRIMARY KEY, canonical TEXT, generic TEXT)")
    merged = 0
    for k, members in groups.items():
        if len(members) == 1:
            continue

        def score(r):
            filled = sum(1 for s in section_cols if r.get(s))
            return (filled, len(json.loads(r["epc"] or "[]")) > 0, -len(r["generic"] or ""), r.get("effective") or "")

        members.sort(key=score, reverse=True)
        best = members[0]
        # display name: shortest name after removing strength/form words (keeps salt)
        disp = min((clean(m["generic"]) for m in members), key=len) or clean(best["generic"])
        best_name = re.sub(r"(^|[\s/(-])([a-z])", lambda m: m.group(1) + m.group(2).upper(), disp)
        best_name = re.sub(r"\bAnd\b", "and", best_name)
        union = {}
        for fld in ("epc", "moa", "pe", "cs", "brands", "routes"):
            seen, vals = set(), []
            for m in members:
                for v in json.loads(m[fld] or "[]"):
                    if v and v.lower() not in seen:
                        seen.add(v.lower())
                        vals.append(v)
            union[fld] = json.dumps(vals)
        mesh = best["mesh_id"] or next((m["mesh_id"] for m in members if m["mesh_id"]), None)
        c.execute(
            "UPDATE drugs SET generic=?, epc=?, moa=?, pe=?, cs=?, brands=?, routes=?, mesh_id=? WHERE slug=?",
            (best_name, union["epc"], union["moa"], union["pe"], union["cs"], union["brands"], union["routes"], mesh, best["slug"]),
        )
        for m in members[1:]:
            c.execute("INSERT OR REPLACE INTO drug_alias VALUES (?,?,?)", (m["slug"], best["slug"], m["generic"]))
            c.execute("DELETE FROM drugs WHERE slug=?", (m["slug"],))
            c.execute("DELETE FROM drugs_fts WHERE slug=?", (m["slug"],))
            # questions derived from duplicate labels: drop (canonical label already has its own)
            has = c.execute("SELECT 1 FROM questions WHERE concept_id=? AND kind='fda_class'", (best["slug"],)).fetchone()
            if has:
                c.execute("DELETE FROM questions WHERE concept_id=? AND kind='fda_class'", (m["slug"],))
            c.execute("UPDATE questions SET concept_id=? WHERE concept_id=?", (best["slug"], m["slug"]))
            merged += 1
        c.execute("DELETE FROM drugs_fts WHERE slug=?", (best["slug"],))
        c.execute(
            "INSERT INTO drugs_fts(slug, generic, brands, classes, indications) VALUES (?,?,?,?,?)",
            (best["slug"], best_name + " " + " ".join(m["generic"] for m in members),
             " ".join(json.loads(union["brands"])), " ".join(json.loads(union["epc"]) + json.loads(union["moa"])),
             (best.get("indications_and_usage") or "")[:4000]),
        )
    # canonical record must have an fda_class question if it has an EPC but lost its own
    c.commit()
    n = c.execute("SELECT count(*) FROM drugs").fetchone()[0]
    print(f"merged {merged} duplicate labels -> {n} drugs")
    c.close()


if __name__ == "__main__":
    main()
