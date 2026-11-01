import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── User data (app.db). Reference content lives in the read-only content.db. ──

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const authTokens = sqliteTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

// owner = "u:<userId>" for accounts, "g:<visitorId>" for guests
export const quizSessions = sqliteTable("quiz_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  mode: text("mode").notNull(), // tutor | timed
  config: text("config").notNull(), // JSON
  questionIds: text("question_ids").notNull(), // JSON string[]
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  timeLimitSec: integer("time_limit_sec"),
});

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  sessionId: integer("session_id"),
  questionId: text("question_id").notNull(),
  choice: integer("choice").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  timeMs: integer("time_ms").notNull(),
  system: text("system").notNull(),
  discipline: text("discipline").notNull(),
  kind: text("kind").notNull(),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const flashcards = sqliteTable("flashcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  deck: text("deck").notNull().default("My cards"),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  ease: real("ease").notNull().default(2.5),
  interval: integer("interval").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  due: integer("due").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  type: text("type").notNull(), // concept | drug | device | icd10 | question | paper | topic | model
  refId: text("ref_id").notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  updatedAt: integer("updated_at").notNull(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const insertFlashcardSchema = createInsertSchema(flashcards).pick({ front: true, back: true, deck: true, sourceType: true, sourceId: true }).extend({
  front: z.string().trim().min(1).max(4000),
  back: z.string().trim().min(1).max(8000),
  deck: z.string().trim().min(1).max(80).default("My cards"),
});
export const insertBookmarkSchema = createInsertSchema(bookmarks).pick({ type: true, refId: true, title: true });
export const insertNoteSchema = createInsertSchema(notes).pick({ title: true, body: true, refType: true, refId: true }).extend({
  title: z.string().trim().min(1, "Add a title").max(200),
  body: z.string().max(50000),
});

export const quizBuildSchema = z.object({
  systems: z.array(z.string()).default([]),
  disciplines: z.array(z.string()).default([]),
  kinds: z.array(z.string()).default([]),
  count: z.number().int().min(1).max(100).default(20),
  mode: z.enum(["tutor", "timed"]).default("tutor"),
  pool: z.enum(["all", "unseen", "incorrect", "flagged"]).default("all"),
  conceptId: z.string().optional(),
});
export const answerSchema = z.object({
  sessionId: z.number().int().optional(),
  questionId: z.string(),
  choice: z.number().int().min(0).max(9),
  timeMs: z.number().int().min(0).max(36_000_000),
  flagged: z.boolean().optional(),
});

export type User = typeof users.$inferSelect;
export type QuizSession = typeof quizSessions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type QuizBuild = z.infer<typeof quizBuildSchema>;
