"""MeSH 2026 descriptors + pharmacological actions (NLM, public domain)."""
import gzip, xml.etree.ElementTree as ET
from common import *

CATS = {"A":"Anatomy","B":"Organisms","C":"Diseases","D":"Chemicals and Drugs","E":"Analytical, Diagnostic and Therapeutic Techniques, and Equipment","F":"Psychiatry and Psychology","G":"Phenomena and Processes"}

def run():
    c = connect()
    c.executescript("""
    DROP TABLE IF EXISTS concepts; DROP TABLE IF EXISTS tree; DROP TABLE IF EXISTS concepts_fts;
    CREATE TABLE concepts(id TEXT PRIMARY KEY, name TEXT, scope_note TEXT, tree_numbers TEXT, cats TEXT,
      entry_terms TEXT, pharm_actions TEXT, pa_members INTEGER DEFAULT 0, see_also TEXT, introduced TEXT, updated TEXT);
    CREATE TABLE tree(tn TEXT PRIMARY KEY, id TEXT, parent TEXT, depth INTEGER, name TEXT, nchild INTEGER DEFAULT 0);
    CREATE INDEX tree_parent ON tree(parent); CREATE INDEX tree_id ON tree(id);
    """)
    rows = []; trees = []
    with gzip.open(os.path.join(RAW, "desc2026.gz")) as f:
        for ev, el in ET.iterparse(f):
            if el.tag != "DescriptorRecord": continue
            uid = el.findtext("DescriptorUI"); name = el.findtext("DescriptorName/String")
            tns = [t.text for t in el.findall("TreeNumberList/TreeNumber")]
            # preferred concept scope note
            scope = None; terms = []
            for con in el.findall("ConceptList/Concept"):
                if con.get("PreferredConceptYN") == "Y":
                    scope = clean(con.findtext("ScopeNote"))
                for t in con.findall("TermList/Term"):
                    s = t.findtext("String")
                    if s and s != name and s not in terms: terms.append(s)
            pas = [p.findtext("DescriptorReferredTo/DescriptorUI") for p in el.findall("PharmacologicalActionList/PharmacologicalAction")]
            see = [s.findtext("DescriptorReferredTo/DescriptorUI") for s in el.findall("SeeRelatedList/SeeRelatedDescriptor")]
            intro = el.findtext("DateIntroduced/Year"); upd = el.findtext("LastUpdated/Year")
            cats = sorted({t[0] for t in tns})
            rows.append((uid, name, scope, J(tns), ",".join(cats), J(terms[:40]), J(pas), J(see), intro, upd))
            for t in tns:
                trees.append((t, uid, t.rsplit(".",1)[0] if "." in t else t[0], t.count(".")+1, name))
            el.clear()
    c.executemany("INSERT INTO concepts(id,name,scope_note,tree_numbers,cats,entry_terms,pharm_actions,see_also,introduced,updated) VALUES(?,?,?,?,?,?,?,?,?,?)", rows)
    c.executemany("INSERT OR IGNORE INTO tree(tn,id,parent,depth,name) VALUES(?,?,?,?,?)", trees)
    # root category pseudo-nodes for top-level (e.g. A01's parent 'A')
    for k,v in CATS.items():
        c.execute("INSERT OR IGNORE INTO tree(tn,id,parent,depth,name) VALUES(?,?,?,?,?)", (k, None, None, 0, v))
    c.execute("UPDATE tree SET nchild=(SELECT COUNT(*) FROM tree t2 WHERE t2.parent=tree.tn)")
    import collections, json as _j
    cnt = collections.Counter(p for r in rows for p in _j.loads(r[6]))
    c.executemany("UPDATE concepts SET pa_members=? WHERE id=?", [(v,k) for k,v in cnt.items()])
    c.execute("CREATE VIRTUAL TABLE concepts_fts USING fts5(id UNINDEXED, name, terms, scope, tokenize='porter unicode61')")
    c.execute("INSERT INTO concepts_fts SELECT id, name, (SELECT group_concat(value,' ; ') FROM json_each(entry_terms)), coalesce(scope_note,'') FROM concepts")
    meta(c, "mesh", {"version":"MeSH 2026","source":"U.S. National Library of Medicine","url":"https://www.nlm.nih.gov/mesh/meshhome.html","descriptors":len(rows)})
    c.commit(); print("mesh", len(rows), len(trees))

if __name__ == "__main__": run()
