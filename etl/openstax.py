"""OpenStax textbooks (CNXML source on GitHub) -> books, book_sections, book_figures, book_questions.

Text is converted to sanitised HTML. Figures are referenced from the pinned GitHub commit (not copied).
Licence of every included book: CC BY-NC-SA 4.0 (read from each collection file).
Source repos: https://github.com/openstax/osbooks-*   Set OSBOOKS_DIR to the folder holding the clones.
"""
import os, re, html, json, subprocess, sqlite3
import xml.etree.ElementTree as ET
from common import connect, meta, J

OSB = os.environ.get("OSBOOKS_DIR", "/tmp/osbooks")
CNX = "{http://cnx.rice.edu/cnxml}"
COL = "{http://cnx.rice.edu/collxml}"
MD = "{http://cnx.rice.edu/mdml}"
MML = "{http://www.w3.org/1998/Math/MathML}"

# slug -> (subject tag used across the app)
BOOKS = {
    "anatomy-and-physiology-2e": "Anatomy & Physiology",
    "microbiology": "Microbiology",
    "pharmacology": "Pharmacology",
    "nutrition": "Nutrition",
    "population-health": "Epidemiology & Public Health",
    "introduction-behavioral-neuroscience": "Neuroscience",
    "psychology-2e": "Behavioral Science",
    "lifespan-development": "Behavioral Science",
    "biology-2e": "Biology & Genetics",
    "chemistry-2e": "Chemistry",
    "organic-chemistry": "Biochemistry & Organic Chemistry",
    "introductory-statistics-2e": "Biostatistics",
}

def text_of(el):
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip() if el is not None else ""

class Conv:
    def __init__(self, repo, sha, module_dir):
        self.repo, self.sha, self.mdir = repo, sha, module_dir
        self.figs = []

    def img_url(self, src):
        p = os.path.normpath(os.path.join("modules", self.mdir, src)).replace("\\", "/")
        return f"https://raw.githubusercontent.com/openstax/{self.repo}/{self.sha}/{p}"

    def inline(self, el):
        out = [html.escape(el.text or "")]
        for ch in el:
            out.append(self.node(ch)); out.append(html.escape(ch.tail or ""))
        return "".join(out)

    def node(self, el):
        tag = el.tag.replace(CNX, "")
        if el.tag.startswith(MML):
            return self.math(el)
        if tag in ("para",):
            return f"<p>{self.inline(el)}</p>"
        if tag == "title":
            return ""
        if tag == "term":
            return f"<strong class=\"term\">{self.inline(el)}</strong>"
        if tag == "emphasis":
            eff = el.get("effect", "bold")
            t = "em" if eff == "italics" else ("u" if eff == "underline" else "strong")
            return f"<{t}>{self.inline(el)}</{t}>"
        if tag in ("sup", "sub"):
            return f"<{tag}>{self.inline(el)}</{tag}>"
        if tag == "newline":
            return "<br/>"
        if tag == "link":
            url = el.get("url")
            if url and url.startswith("http"):
                return f"<a href=\"{html.escape(url)}\" target=\"_blank\" rel=\"noopener\">{self.inline(el) or html.escape(url)}</a>"
            return self.inline(el)
        if tag == "list":
            lt = "ol" if el.get("list-type") == "enumerated" else "ul"
            items = "".join(f"<li>{self.inline(i)}</li>" for i in el if i.tag == CNX + "item")
            title = el.find(CNX + "title")
            return (f"<p class=\"list-title\"><strong>{html.escape(text_of(title))}</strong></p>" if title is not None else "") + f"<{lt}>{items}</{lt}>"
        if tag == "figure":
            return self.figure(el)
        if tag == "media":
            img = el.find(CNX + "image")
            if img is not None and img.get("src"):
                return f"<img loading=\"lazy\" src=\"{self.img_url(img.get('src'))}\" alt=\"{html.escape(el.get('alt') or '')}\"/>"
            return ""
        if tag == "table":
            return self.table(el)
        if tag == "note":
            t = el.find(CNX + "title")
            body = "".join(self.node(c) for c in el if c.tag != CNX + "title")
            cls = html.escape(el.get("class") or "note")
            return f"<aside class=\"note {cls}\">" + (f"<h5>{html.escape(text_of(t))}</h5>" if t is not None else "") + body + "</aside>"
        if tag == "section":
            t = el.find(CNX + "title")
            cls = el.get("class") or ""
            if cls in ("multiple-choice", "free-response", "critical-thinking", "review-questions", "interactive-exercise"):
                return ""  # questions are extracted separately
            body = "".join(self.node(c) for c in el if c.tag != CNX + "title")
            return (f"<h3>{html.escape(text_of(t))}</h3>" if t is not None else "") + body
        if tag == "equation":
            return f"<div class=\"equation\">{self.inline(el)}</div>"
        if tag == "exercise":
            return ""
        if tag in ("glossary", "metadata"):
            return ""
        if tag == "definition":
            return ""
        if tag in ("quote", "preformat", "code"):
            return f"<blockquote>{self.inline(el)}</blockquote>"
        return self.inline(el)

    def math(self, el):
        def ser(e):
            t = e.tag.replace(MML, "")
            attrs = "".join(f' {k}="{html.escape(v)}"' for k, v in e.attrib.items() if ":" not in k and "{" not in k)
            inner = html.escape(e.text or "") + "".join(ser(c) + html.escape(c.tail or "") for c in e)
            return f"<{t}{attrs}>{inner}</{t}>"
        return ser(el)

    def table(self, el):
        rows = []
        for part in el.iter():
            if part.tag == CNX + "row":
                cells = "".join(f"<td>{self.inline(e)}</td>" for e in part if e.tag == CNX + "entry")
                rows.append(f"<tr>{cells}</tr>")
        title = el.find(CNX + "title")
        cap = f"<caption>{html.escape(text_of(title))}</caption>" if title is not None else ""
        return f"<div class=\"table-wrap\"><table>{cap}<tbody>{''.join(rows)}</tbody></table></div>"

    def figure(self, el):
        imgs = []
        for m in el.iter(CNX + "media"):
            img = m.find(CNX + "image")
            if img is not None and img.get("src"):
                imgs.append((self.img_url(img.get("src")), m.get("alt") or ""))
        title = text_of(el.find(CNX + "title"))
        cap_el = el.find(CNX + "caption")
        cap_html = self.inline(cap_el) if cap_el is not None else ""
        cap_txt = text_of(cap_el)
        fid = el.get("id")
        for u, alt in imgs:
            self.figs.append({"fid": fid, "title": title, "caption": cap_txt, "src": u, "alt": alt})
        im = "".join(f"<img loading=\"lazy\" src=\"{u}\" alt=\"{html.escape(a)}\"/>" for u, a in imgs)
        head = f"<strong>{html.escape(title)}</strong> " if title else ""
        return f"<figure id=\"{html.escape(fid or '')}\">{im}<figcaption>{head}{cap_html}</figcaption></figure>"

EXER = {}
def _load_ex():
    global EXER
    p = os.path.join(os.environ.get("RAW_DIR", "/tmp/data"), "os_exercises.json")
    if os.path.exists(p): EXER = json.load(open(p))

def _strip(h):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h or ""))).strip()

def embedded(nick):
    it = EXER.get(nick)
    if not it or not it.get("questions") or it.get("images"): return None
    q = it["questions"][0]
    if "multiple-choice" not in q.get("formats", []) or len(it["questions"]) != 1: return None
    ans = q.get("answers") or []
    corr = [i for i, a in enumerate(ans) if float(a.get("correctness") or 0) >= 1.0]
    if len(corr) != 1 or len(ans) < 3: return None
    if "<img" in (q.get("stem_html") or "") + (it.get("stimulus_html") or ""): return None
    stem = " ".join(x for x in (_strip(it.get("stimulus_html")), _strip(q.get("stimulus_html")), _strip(q.get("stem_html"))) if x)
    opts = [_strip(a.get("content_html")) for a in ans]
    if not stem or any(not o for o in opts): return None
    expl = " ".join(_strip(s.get("content_html")) for s in q.get("collaborator_solutions", []) if s.get("content_html"))
    fb = [_strip(a.get("feedback_html")) for a in ans]
    if not expl and fb[corr[0]]: expl = fb[corr[0]]
    return {"stem": stem, "options": opts, "answer": corr[0], "explanation": expl or None, "uid": it.get("uid"), "nickname": nick}

def questions(root, conv):
    out = []
    for sec in root.iter(CNX + "section"):
        if (sec.get("class") or "") not in ("multiple-choice", "review-questions"):
            continue
        for ex in sec.iter(CNX + "exercise"):
            emb = [l.get("url") for l in ex.iter(CNX + "link") if (l.get("url") or "").startswith("#exercise/")]
            if emb:
                q = embedded(emb[0].split("/", 1)[1])
                if q: out.append(q)
                continue
            prob = ex.find(CNX + "problem"); sol = ex.find(CNX + "solution")
            if prob is None or sol is None: continue
            lst = prob.find(CNX + "list")
            if lst is None: continue
            opts = [text_of(i) for i in lst if i.tag == CNX + "item"]
            stem = " ".join(text_of(p) for p in prob if p.tag == CNX + "para")
            ans = text_of(sol).strip().rstrip(".").strip()
            m = re.fullmatch(r"\(?([A-Ha-h])\)?", ans)
            if not m or len(opts) < 3 or not stem: continue
            k = ord(m.group(1).upper()) - 65
            if k >= len(opts): continue
            if any(re.search(r"\b(figure|image|diagram|picture) (shown|below|above)|\bshown (below|above)\b", stem, re.I) for _ in [0]):
                continue  # depends on an image we do not show inline
            out.append({"stem": stem, "options": opts, "answer": k, "explanation": None})
    return out

def walk(col_el, chapter_stack, acc):
    for ch in col_el:
        if ch.tag == COL + "module":
            acc.append((list(chapter_stack), ch.get("document")))
        elif ch.tag == COL + "subcollection":
            t = text_of(ch.find(MD + "title"))
            content = ch.find(COL + "content")
            if content is not None:
                walk(content, chapter_stack + [t], acc)

def run():
    _load_ex()
    c = connect()
    c.executescript("""
    DROP TABLE IF EXISTS books; DROP TABLE IF EXISTS book_sections; DROP TABLE IF EXISTS book_figures; DROP TABLE IF EXISTS book_questions;
    DROP TABLE IF EXISTS book_fts; DROP TABLE IF EXISTS figure_fts;
    CREATE TABLE books(slug TEXT PRIMARY KEY, title TEXT, subject TEXT, license TEXT, license_url TEXT, repo TEXT, sha TEXT,
      url TEXT, sections INTEGER, figures INTEGER, questions INTEGER, updated TEXT, ord INTEGER);
    CREATE TABLE book_sections(id INTEGER PRIMARY KEY, book TEXT, unit TEXT, chapter TEXT, chapter_no INTEGER, ord INTEGER,
      module TEXT, title TEXT, abstract TEXT, html TEXT, text TEXT, words INTEGER);
    CREATE TABLE book_figures(id INTEGER PRIMARY KEY, book TEXT, section_id INTEGER, fid TEXT, title TEXT, caption TEXT, alt TEXT, src TEXT);
    CREATE TABLE book_questions(id INTEGER PRIMARY KEY, book TEXT, section_id INTEGER, stem TEXT, options TEXT, answer INTEGER, explanation TEXT, ref TEXT);
    """)
    order = 0
    for repo in sorted(os.listdir(OSB)):
        rdir = os.path.join(OSB, repo)
        if not os.path.isdir(os.path.join(rdir, "collections")): continue
        sha = subprocess.check_output(["git", "-C", rdir, "rev-parse", "HEAD"], text=True).strip()
        date = subprocess.check_output(["git", "-C", rdir, "log", "-1", "--format=%cs"], text=True).strip()
        for cf in sorted(os.listdir(os.path.join(rdir, "collections"))):
            root = ET.parse(os.path.join(rdir, "collections", cf)).getroot()
            slug = text_of(root.find(".//" + MD + "slug"))
            if slug not in BOOKS: continue
            title = text_of(root.find(".//" + MD + "title"))
            lic = root.find(".//" + MD + "license")
            mods = []; walk(root.find(COL + "content"), [], mods)
            nsec = nfig = nq = 0; chap_no = 0; last_chap = None
            for i, (stack, mid) in enumerate(mods):
                path = os.path.join(rdir, "modules", mid, "index.cnxml")
                if not os.path.exists(path): continue
                try: mroot = ET.parse(path).getroot()
                except ET.ParseError: continue
                chapter = stack[-1] if stack else "Front matter"
                unit = stack[0] if len(stack) > 1 else None
                if chapter != last_chap:
                    chap_no += 1 if stack else 0; last_chap = chapter
                conv = Conv(repo, sha, mid)
                mtitle = text_of(mroot.find(CNX + "title"))
                if not stack and re.match(r"(preface|index)", mtitle, re.I): pass
                content = mroot.find(CNX + "content")
                if content is None: continue
                body = "".join(conv.node(ch) for ch in content)
                ab = mroot.find(".//" + MD + "abstract")
                abstract = "".join(conv.node(x) for x in ab) if ab is not None else ""
                txt = re.sub(r"<[^>]+>", " ", body); txt = html.unescape(re.sub(r"\s+", " ", txt)).strip()
                if len(txt) < 40 and not conv.figs: continue
                cur = c.execute("INSERT INTO book_sections(book,unit,chapter,chapter_no,ord,module,title,abstract,html,text,words) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                                (slug, unit, chapter, chap_no if stack else 0, i, mid, mtitle, abstract, body, txt, len(txt.split())))
                sid = cur.lastrowid; nsec += 1
                for f in conv.figs:
                    c.execute("INSERT INTO book_figures(book,section_id,fid,title,caption,alt,src) VALUES(?,?,?,?,?,?,?)",
                              (slug, sid, f["fid"], f["title"], f["caption"], f["alt"], f["src"])); nfig += 1
                for q in questions(mroot, conv):
                    c.execute("INSERT INTO book_questions(book,section_id,stem,options,answer,explanation,ref) VALUES(?,?,?,?,?,?,?)",
                              (slug, sid, q["stem"], J(q["options"]), q["answer"], q.get("explanation"), q.get("uid"))); nq += 1
            order += 1
            c.execute("INSERT INTO books VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                      (slug, title, BOOKS[slug], lic.text if lic is not None else None, lic.get("url") if lic is not None else None,
                       repo, sha, f"https://openstax.org/details/books/{slug}", nsec, nfig, nq, date, order))
            print(slug, nsec, "sections", nfig, "figures", nq, "questions", flush=True)
    c.executescript("""
    CREATE VIRTUAL TABLE book_fts USING fts5(title, chapter, text, content='book_sections', content_rowid='id', tokenize='porter unicode61');
    INSERT INTO book_fts(rowid,title,chapter,text) SELECT id,title,chapter,text FROM book_sections;
    CREATE VIRTUAL TABLE figure_fts USING fts5(title, caption, alt, content='book_figures', content_rowid='id', tokenize='porter unicode61');
    INSERT INTO figure_fts(rowid,title,caption,alt) SELECT id,title,caption,alt FROM book_figures;
    CREATE INDEX IF NOT EXISTS bs_book ON book_sections(book, ord); CREATE INDEX IF NOT EXISTS bf_sec ON book_figures(section_id);
    CREATE INDEX IF NOT EXISTS bf_book ON book_figures(book); CREATE INDEX IF NOT EXISTS bq_sec ON book_questions(section_id);
    """)
    meta(c, "openstax", {"source": "OpenStax (Rice University)", "url": "https://openstax.org", "license": "CC BY-NC-SA 4.0",
                         "repos": "https://github.com/openstax", "note": "Book text and figures are attributed to OpenStax; figures are linked from the pinned GitHub commit."})
    c.commit()

if __name__ == "__main__":
    run()
