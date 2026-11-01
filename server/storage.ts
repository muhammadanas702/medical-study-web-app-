import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  users, authTokens, quizSessions, attempts, flashcards, bookmarks, notes,
  type User, type QuizSession, type Attempt, type Flashcard, type InsertFlashcard,
  type Bookmark, type InsertBookmark, type Note, type InsertNote,
} from "@shared/schema";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new Database(path.join(DATA_DIR, "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Bootstrap schema (mirrors shared/schema.ts) so the app runs without a migration step.
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_tokens(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quiz_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, mode TEXT NOT NULL, config TEXT NOT NULL, question_ids TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, time_limit_sec INTEGER);
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, session_id INTEGER, question_id TEXT NOT NULL, choice INTEGER NOT NULL, correct INTEGER NOT NULL, time_ms INTEGER NOT NULL, system TEXT NOT NULL, discipline TEXT NOT NULL, kind TEXT NOT NULL, flagged INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(owner, question_id);
CREATE TABLE IF NOT EXISTS flashcards(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, front TEXT NOT NULL, back TEXT NOT NULL, deck TEXT NOT NULL DEFAULT 'My cards', source_type TEXT, source_id TEXT, ease REAL NOT NULL DEFAULT 2.5, interval INTEGER NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0, due INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS cards_owner ON flashcards(owner, due);
CREATE TABLE IF NOT EXISTS bookmarks(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, type TEXT NOT NULL, ref_id TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, ref_type TEXT, ref_id TEXT, updated_at INTEGER NOT NULL);
`);

export const db = drizzle(sqlite);
export const rawAppDb = sqlite;

function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(pw: string, stored: string) {
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && timingSafeEqual(hash, expected);
}

export interface IStorage {
  register(name: string, email: string, password: string): User | { error: string };
  login(email: string, password: string): User | null;
  createToken(userId: number): string;
  userByToken(token: string): User | undefined;
  deleteToken(token: string): void;
  mergeGuest(guestOwner: string, userOwner: string): void;
  createSession(owner: string, mode: string, config: unknown, ids: string[], limit: number | null): QuizSession;
  getSession(owner: string, id: number): QuizSession | undefined;
  finishSession(owner: string, id: number): void;
  listSessions(owner: string): QuizSession[];
  addAttempt(a: Omit<Attempt, "id">): Attempt;
  attemptsFor(owner: string): Attempt[];
  sessionAttempts(owner: string, sessionId: number): Attempt[];
  resetProgress(owner: string): void;
  cards(owner: string): Flashcard[];
  dueCards(owner: string, now: number): Flashcard[];
  addCard(owner: string, c: InsertFlashcard): Flashcard;
  reviewCard(owner: string, id: number, grade: number): Flashcard | undefined;
  deleteCard(owner: string, id: number): void;
  bookmarks(owner: string): Bookmark[];
  addBookmark(owner: string, b: InsertBookmark): Bookmark;
  deleteBookmark(owner: string, id: number): void;
  notes(owner: string): Note[];
  addNote(owner: string, n: InsertNote): Note;
  updateNote(owner: string, id: number, n: Partial<InsertNote>): Note | undefined;
  deleteNote(owner: string, id: number): void;
}

export class DatabaseStorage implements IStorage {
  register(name: string, email: string, password: string) {
    const exists = db.select().from(users).where(eq(users.email, email)).get();
    if (exists) return { error: "An account with this email already exists" };
    return db.insert(users).values({ name, email, passwordHash: hashPassword(password), createdAt: Date.now() }).returning().get();
  }
  login(email: string, password: string) {
    const u = db.select().from(users).where(eq(users.email, email)).get();
    if (!u || !verifyPassword(password, u.passwordHash)) return null;
    return u;
  }
  createToken(userId: number) {
    const token = randomBytes(32).toString("hex");
    db.insert(authTokens).values({ token, userId, createdAt: Date.now() }).run();
    return token;
  }
  userByToken(token: string) {
    const t = db.select().from(authTokens).where(eq(authTokens.token, token)).get();
    if (!t) return undefined;
    return db.select().from(users).where(eq(users.id, t.userId)).get();
  }
  deleteToken(token: string) {
    db.delete(authTokens).where(eq(authTokens.token, token)).run();
  }
  mergeGuest(guestOwner: string, userOwner: string) {
    for (const t of ["quiz_sessions", "attempts", "flashcards", "bookmarks", "notes"]) {
      sqlite.prepare(`UPDATE ${t} SET owner=? WHERE owner=?`).run(userOwner, guestOwner);
    }
  }
  createSession(owner: string, mode: string, config: unknown, ids: string[], limit: number | null) {
    return db.insert(quizSessions).values({ owner, mode, config: JSON.stringify(config), questionIds: JSON.stringify(ids), startedAt: Date.now(), timeLimitSec: limit }).returning().get();
  }
  getSession(owner: string, id: number) {
    return db.select().from(quizSessions).where(and(eq(quizSessions.owner, owner), eq(quizSessions.id, id))).get();
  }
  finishSession(owner: string, id: number) {
    db.update(quizSessions).set({ finishedAt: Date.now() }).where(and(eq(quizSessions.owner, owner), eq(quizSessions.id, id))).run();
  }
  listSessions(owner: string) {
    return db.select().from(quizSessions).where(eq(quizSessions.owner, owner)).orderBy(desc(quizSessions.startedAt)).limit(100).all();
  }
  addAttempt(a: Omit<Attempt, "id">) {
    // one attempt per question per session: replace an earlier answer in the same session
    if (a.sessionId != null) {
      sqlite.prepare("DELETE FROM attempts WHERE owner=? AND session_id=? AND question_id=?").run(a.owner, a.sessionId, a.questionId);
    }
    return db.insert(attempts).values(a).returning().get();
  }
  attemptsFor(owner: string) {
    return db.select().from(attempts).where(eq(attempts.owner, owner)).orderBy(attempts.createdAt).all();
  }
  sessionAttempts(owner: string, sessionId: number) {
    return db.select().from(attempts).where(and(eq(attempts.owner, owner), eq(attempts.sessionId, sessionId))).all();
  }
  resetProgress(owner: string) {
    db.delete(attempts).where(eq(attempts.owner, owner)).run();
    db.delete(quizSessions).where(eq(quizSessions.owner, owner)).run();
  }
  cards(owner: string) {
    return db.select().from(flashcards).where(eq(flashcards.owner, owner)).orderBy(desc(flashcards.createdAt)).all();
  }
  dueCards(owner: string, now: number) {
    return db.select().from(flashcards).where(and(eq(flashcards.owner, owner), lte(flashcards.due, now))).orderBy(flashcards.due).all();
  }
  addCard(owner: string, c: InsertFlashcard) {
    return db.insert(flashcards).values({ ...c, owner, due: Date.now(), createdAt: Date.now() }).returning().get();
  }
  // SM-2 spaced repetition. grade: 0 again, 3 hard, 4 good, 5 easy
  reviewCard(owner: string, id: number, grade: number) {
    const c = db.select().from(flashcards).where(and(eq(flashcards.owner, owner), eq(flashcards.id, id))).get();
    if (!c) return undefined;
    let { ease, interval, reps } = c;
    if (grade < 3) {
      reps = 0;
      interval = 0;
    } else {
      reps += 1;
      interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ease);
      if (grade === 5) interval = Math.max(interval, reps === 1 ? 4 : interval);
    }
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    const due = grade < 3 ? Date.now() + 10 * 60 * 1000 : Date.now() + interval * 86400000;
    return db.update(flashcards).set({ ease, interval, reps, due }).where(eq(flashcards.id, id)).returning().get();
  }
  deleteCard(owner: string, id: number) {
    db.delete(flashcards).where(and(eq(flashcards.owner, owner), eq(flashcards.id, id))).run();
  }
  bookmarks(owner: string) {
    return db.select().from(bookmarks).where(eq(bookmarks.owner, owner)).orderBy(desc(bookmarks.createdAt)).all();
  }
  addBookmark(owner: string, b: InsertBookmark) {
    const ex = db.select().from(bookmarks).where(and(eq(bookmarks.owner, owner), eq(bookmarks.type, b.type), eq(bookmarks.refId, b.refId))).get();
    if (ex) return ex;
    return db.insert(bookmarks).values({ ...b, owner, createdAt: Date.now() }).returning().get();
  }
  deleteBookmark(owner: string, id: number) {
    db.delete(bookmarks).where(and(eq(bookmarks.owner, owner), eq(bookmarks.id, id))).run();
  }
  notes(owner: string) {
    return db.select().from(notes).where(eq(notes.owner, owner)).orderBy(desc(notes.updatedAt)).all();
  }
  addNote(owner: string, n: InsertNote) {
    return db.insert(notes).values({ ...n, owner, updatedAt: Date.now() }).returning().get();
  }
  updateNote(owner: string, id: number, n: Partial<InsertNote>) {
    return db.update(notes).set({ ...n, updatedAt: Date.now() }).where(and(eq(notes.owner, owner), eq(notes.id, id))).returning().get();
  }
  deleteNote(owner: string, id: number) {
    db.delete(notes).where(and(eq(notes.owner, owner), eq(notes.id, id))).run();
  }
}

export const storage = new DatabaseStorage();
void sql;
