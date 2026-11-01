// Rebuild data/content.db from the gzip parts committed to the repo (GitHub limits files to 100 MB).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const dir = path.join(__dirname, "..", "data");
const parts = fs.readdirSync(dir).filter((f) => /^content\.db\.gz\.part\d+$/.test(f)).sort();
if (!parts.length) { console.error("No data/content.db.gz.part* files found."); process.exit(1); }
const out = path.join(dir, "content.db");
fs.writeFileSync(out, zlib.gunzipSync(Buffer.concat(parts.map((p) => fs.readFileSync(path.join(dir, p))))));
fs.writeFileSync(out + ".stamp", parts.map((p) => `${p}:${fs.statSync(path.join(dir, p)).size}`).join("|"));
console.log(`Restored ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) from ${parts.length} parts.`);
