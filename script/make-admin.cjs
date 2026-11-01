// Promote an existing account to administrator:  npm run admin -- you@example.com
// List accounts:                                  npm run admin
const path = require("node:path");
const Database = require("better-sqlite3");
const dir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
const db = new Database(path.join(dir, "app.db"));
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0"); } catch {}
const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  const rows = db.prepare("SELECT id, email, name, role, suspended FROM users ORDER BY id").all();
  if (!rows.length) console.log("No accounts yet. Register in the app first; the first account becomes the administrator automatically.");
  else console.table(rows);
  console.log('Usage: npm run admin -- <email>   (add --demote to remove admin rights)');
  process.exit(0);
}
const demote = process.argv.includes("--demote");
const r = db.prepare("UPDATE users SET role=?, suspended=0 WHERE lower(email)=?").run(demote ? "student" : "admin", email);
if (!r.changes) { console.error(`No account with email ${email}. Register it in the app first.`); process.exit(1); }
console.log(`${email} is now ${demote ? "a student" : "an administrator"}. Sign out and back in to refresh the menu.`);
