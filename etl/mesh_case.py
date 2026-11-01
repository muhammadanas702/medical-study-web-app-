"""MeSH scope notes write cross-referenced headings in ALL CAPS (e.g. "inhibits FACTOR Xa").
Restore natural casing for readability: an all-caps word of 5+ letters is replaced by its most
common non-all-caps spelling elsewhere in the scope-note corpus. Short tokens (DNA, HIV, AIDS,
roman numerals) and words never seen in another casing are left untouched."""
import json, re, sqlite3, sys
from collections import Counter, defaultdict

DB = sys.argv[1] if len(sys.argv) > 1 else "data/content.db"
c = sqlite3.connect(DB)
WORD = re.compile(r"\b[A-Za-z]{4,}\b")
KEEP4 = {"AIDS", "SARS", "MERS", "HELLP", "CREST", "POEMS", "SAPHO", "MELAS", "MERRF", "NARP", "LEOPARD", "PANDAS", "CHARGE", "VACTERL", "WAGR", "PHACE", "TRAPS"}
forms = defaultdict(Counter)
for (s,) in c.execute("SELECT scope_note FROM concepts WHERE scope_note IS NOT NULL"):
    for w in WORD.findall(s):
        if not w.isupper():
            forms[w.lower()][w] += 1

# words known from heading names (not acronyms); organisms (B) and geographic names (Z) keep a capital
name_word = {}
for name, cats in c.execute("SELECT name, cats FROM concepts"):
    proper = any(k in (cats or "") for k in ("B", "Z"))
    for w in WORD.findall(name):
        if w.isupper():
            continue
        lw = w.lower()
        if proper and w[0].isupper():
            name_word[lw] = w[0].upper() + lw[1:]
        else:
            name_word.setdefault(lw, lw)

def fix(text):
    if not text:
        return text
    def rep(m):
        w = m.group(0)
        if not w.isupper():
            return w
        if w in KEEP4:
            return w
        f = forms.get(w.lower())
        if not f:
            return name_word.get(w.lower(), w) if len(w) >= 5 else w
        best, cnt = f.most_common(1)[0]
        if len(w) == 4 and cnt < 20:  # short tokens are often acronyms; only fix very common words
            return w
        return best
    return WORD.sub(rep, text)

n = 0
rows = c.execute("SELECT id, scope_note FROM concepts WHERE scope_note IS NOT NULL").fetchall()
for i, s in rows:
    t = fix(s)
    if t != s:
        c.execute("UPDATE concepts SET scope_note=? WHERE id=?", (t, i)); n += 1
print("concepts updated", n)

m = 0
for qid, stem, ask, opts, expl, rats, obj in c.execute("SELECT id, stem, ask, options, explanation, rationales, objective FROM questions WHERE kind!='vignette'").fetchall():
    new = (fix(stem), fix(ask), fix(opts), fix(expl), fix(rats), fix(obj))
    if new != (stem, ask, opts, expl, rats, obj):
        c.execute("UPDATE questions SET stem=?, ask=?, options=?, explanation=?, rationales=?, objective=? WHERE id=?", (*new, qid)); m += 1
print("questions updated", m)
# keep the FTS index in sync for scope notes
try:
    c.execute("INSERT INTO concepts_fts(concepts_fts) VALUES('rebuild')")
except Exception as e:
    print("fts rebuild skipped:", e)
c.commit()
