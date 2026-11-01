"""Copy OpenStax end-of-section / embedded questions (book_questions) into the main question bank.

Every merged item keeps its provenance: source = "OpenStax <book> (CC BY-NC-SA 4.0)", source_url points to the
book section inside the app (#/books/<slug>/<section id>) and the objective is the section title.
When OpenStax provides no written explanation we say so explicitly instead of inventing one.
"""
import json, re
from common import connect

DISC = {
    "anatomy-and-physiology-2e": "Anatomy", "biology-2e": "Biochemistry & Genetics", "microbiology": "Microbiology",
    "introduction-behavioral-neuroscience": "Behavioral Science", "psychology-2e": "Behavioral Science",
    "lifespan-development": "Behavioral Science", "pharmacology": "Pharmacology", "nutrition": "Biochemistry & Nutrition",
    "population-health": "Biostatistics & Epidemiology",
}
SYS_RULES = [
    (r"cardiovascular|heart|blood vessel|antidysrhythm|antihypertens|anticoag|lipid|shock", "Cardiovascular"),
    (r"blood\b|lymphatic|immune|inflammat", "Hematology & Immunology"),
    (r"respiratory", "Respiratory"), (r"digestive|gastro|antiulcer|hyperacid|weight", "Gastrointestinal"),
    (r"urinary|renal|diuretic|fluid, electrolyte|acid-base", "Renal & Urogenital"),
    (r"reproductive|development and inheritance|transgender", "Reproductive"),
    (r"endocrine|thyroid|pituitary|adrenal|diabet|metabolism", "Endocrine & Metabolic"),
    (r"nervous|neuro|myasthenia|parkinson|anticonvuls|pain|ophthalmic|otic", "Nervous & Special Senses"),
    (r"integumentary|skeletal|skeleton|joints|muscle|muscular|dermatolog", "Musculoskeletal & Skin"),
    (r"psychopharm|substance use", "Psychiatry & Behavior"), (r"cancer", "Oncology"), (r"anti-infective", "Microbiology & Infection"),
]

def system_for(book, chapter):
    ch = (chapter or "").lower()
    if book in ("psychology-2e", "lifespan-development", "introduction-behavioral-neuroscience"): return "Psychiatry & Behavior"
    if book == "microbiology": return "Microbiology & Infection"
    for rx, s in SYS_RULES:
        if re.search(rx, ch): return s
    return "Pharmacology" if book == "pharmacology" else "General Principles"

def run():
    c = connect()
    c.execute("DELETE FROM questions WHERE id LIKE 'os-%'")
    books = dict(c.execute("SELECT slug, title FROM books"))
    rows = c.execute("""SELECT q.id, q.book, q.section_id, q.stem, q.options, q.answer, q.explanation, s.chapter, s.chapter_no, s.title
                        FROM book_questions q JOIN book_sections s ON s.id=q.section_id""").fetchall()
    n = 0
    for qid, book, sid, stem, opts, ans, expl, chap, chno, stitle in rows:
        options = json.loads(opts or "[]")
        if len(options) < 2 or ans is None or not (0 <= ans < len(options)) or not (stem or "").strip(): continue
        correct = options[ans]
        where = f"{books.get(book, book)}, chapter {chno}: {chap} \u2014 section \u201c{stitle}\u201d"
        if (expl or "").strip():
            explanation = f"{expl.strip()}\n\nCorrect answer: \u201c{correct}\u201d. Source: OpenStax {where}."
        else:
            explanation = (f"Correct answer: \u201c{correct}\u201d.\n\nOpenStax does not publish a written rationale for this item. "
                           f"The concept is taught in OpenStax {where}; open the linked section to review it.")
        c.execute("INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            f"os-{qid}", "textbook", DISC.get(book, "General Principles"), system_for(book, chap), stem.strip(), "",
            json.dumps(options, ensure_ascii=False), ans, explanation, "[]", stitle, None,
            f"OpenStax {books.get(book, book)} (CC BY-NC-SA 4.0)", f"#/books/{book}/{sid}"))
        n += 1
    c.commit()
    print("merged", n)

if __name__ == "__main__":
    run()
