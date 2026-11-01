// Read-only reference database built by etl/ from public authoritative sources.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
const DB_PATH = process.env.CONTENT_DB || path.join(DATA_DIR, "content.db");

function ensureDb() {
  if (fs.existsSync(DB_PATH)) return;
  // The repository ships the database as gzip parts (GitHub's 100 MB file limit): content.db.gz.part00, part01, ...
  const parts = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter((f) => /^content\.db\.gz(\.part\d+)?$/.test(f)).sort() : [];
  if (!parts.length) {
    throw new Error(`content.db not found at ${DB_PATH}. Run "npm run db:restore" or rebuild with "python3 etl/build_all.py".`);
  }
  console.log(`[content] restoring ${DB_PATH} from ${parts.join(", ")} ...`);
  const gz = Buffer.concat(parts.map((p) => fs.readFileSync(path.join(DATA_DIR, p))));
  fs.writeFileSync(DB_PATH, zlib.gunzipSync(gz));
}

ensureDb();
export const content = new Database(DB_PATH, { readonly: true, fileMustExist: true });
content.pragma("cache_size = -64000");

const stmtCache = new Map<string, Database.Statement>();
function prep(sql: string) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = content.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}
export function all<T = any>(sql: string, ...params: unknown[]): T[] {
  return prep(sql).all(...params) as T[];
}
export function get<T = any>(sql: string, ...params: unknown[]): T | undefined {
  return prep(sql).get(...params) as T | undefined;
}

/** Turn free text into a safe FTS5 prefix query. */
export function ftsQuery(q: string): string | null {
  const words = (q || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w) => `"${w}"*`).join(" ");
}

export function parseJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export const META: Record<string, any> = Object.fromEntries(
  all<{ key: string; value: string }>("SELECT key, value FROM meta").map((r) => [r.key, parseJSON(r.value, {})]),
);
