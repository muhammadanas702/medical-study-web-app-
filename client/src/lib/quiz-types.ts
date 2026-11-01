export type PublicQ = {
  id: string; kind: string; discipline: string; system: string; stem: string; ask: string; options: string[];
  source: string; sourceUrl: string; conceptId: string | null;
};
export type FullQ = PublicQ & { answer: number; explanation: string; rationales: string[]; objective: string };
export type Peer = { answered: number; pctCorrect: number | null };
export type AnswerR = FullQ & { correct: boolean; choice: number; peer: Peer };
export type SessionItem = { question: PublicQ | FullQ; attempt: { choice: number; correct: boolean; timeMs: number; flagged: boolean } | null; peer: Peer };
export type SessionR = {
  session: { id: number; mode: "tutor" | "timed"; startedAt: number; finishedAt: number | null; timeLimitSec: number | null; config: Record<string, unknown> };
  items: SessionItem[];
};
export const isFull = (q: PublicQ | FullQ): q is FullQ => typeof (q as FullQ).answer === "number";
export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
