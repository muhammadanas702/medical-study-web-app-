import sqlite3, os, json, re, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.environ.get("RAW_DIR", "/tmp/data")
DB = os.path.join(ROOT, "data", "content.db")

def connect():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    c = sqlite3.connect(DB)
    c.execute("PRAGMA journal_mode=OFF"); c.execute("PRAGMA synchronous=OFF")
    return c

def J(x): return json.dumps(x, ensure_ascii=False)

def meta(c, key, value):
    c.execute("CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)")
    c.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", (key, J(value)))

def clean(s):
    if s is None: return None
    s = re.sub(r"\s+", " ", s).strip()
    return s
