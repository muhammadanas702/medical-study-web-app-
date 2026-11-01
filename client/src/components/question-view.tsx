import { CheckCircle2, XCircle, ExternalLink, Users, Target } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { AddCardButton, ReportButton } from "@/components/common";
import { KIND_LABEL } from "@/lib/meta";
import { LETTERS, type FullQ, type PublicQ, type Peer, isFull } from "@/lib/quiz-types";

export function QuestionMeta({ q }: { q: PublicQ }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="font-normal">{q.system}</Badge>
      {q.discipline !== q.system && <Badge variant="secondary" className="font-normal">{q.discipline}</Badge>}
      <Badge variant="outline" className="font-normal">{KIND_LABEL[q.kind] ?? q.kind}</Badge>
    </div>
  );
}

export function Stem({ q }: { q: PublicQ }) {
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px] leading-relaxed" data-testid="text-stem">{q.stem}</p>
      {q.ask && <p className="text-[15px] font-medium" data-testid="text-ask">{q.ask}</p>}
    </div>
  );
}

export function Options({ q, selected, struck, revealed, onSelect, onStrike }: {
  q: PublicQ | FullQ; selected: number | null; struck: number[]; revealed: boolean; onSelect?: (i: number) => void; onStrike?: (i: number) => void;
}) {
  const full = isFull(q) && revealed;
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
      {q.options.map((o, i) => {
        const isAns = full && (q as FullQ).answer === i;
        const isWrongPick = full && selected === i && !isAns;
        const isStruck = struck.includes(i);
        let cls = "border bg-card";
        if (isAns) cls = "border-success bg-success/10";
        else if (isWrongPick) cls = "border-destructive bg-destructive/10";
        else if (selected === i) cls = "border-primary bg-accent";
        return (
          <div key={i} className={`flex items-start gap-2 rounded-lg p-1 ${cls}`}>
            <button
              type="button"
              role="radio"
              aria-checked={selected === i}
              disabled={revealed}
              onClick={() => onSelect?.(i)}
              onContextMenu={(e) => { e.preventDefault(); onStrike?.(i); }}
              className={`flex flex-1 items-start gap-3 rounded-md px-2.5 py-2 text-left text-[15px] ${revealed ? "cursor-default" : "hover-elevate"}`}
              data-testid={`button-option-${i}`}
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${selected === i ? "border-primary bg-primary text-primary-foreground" : ""}`}>{LETTERS[i]}</span>
              <span className={`flex-1 ${isStruck ? "text-muted-foreground line-through" : ""}`}>{o}</span>
              {isAns && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />}
              {isWrongPick && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
            </button>
            {!revealed && onStrike && (
              <button type="button" onClick={() => onStrike(i)} className="mt-1.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover-elevate" aria-label={`Strike out option ${LETTERS[i]}`} data-testid={`button-strike-${i}`}>
                {isStruck ? "Undo" : "Strike"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Explanation({ q, choice, peer }: { q: FullQ; choice: number | null; peer?: Peer }) {
  const correct = choice === q.answer;
  return (
    <div className="mt-5 space-y-4" data-testid="panel-explanation">
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-4 py-3 text-sm ${correct ? "bg-success/10 text-success" : choice == null ? "bg-muted" : "bg-destructive/10 text-destructive"}`}>
        <span className="flex items-center gap-1.5 font-semibold" data-testid="text-result">
          {correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {correct ? "Correct" : choice == null ? "Not answered" : "Incorrect"} · answer {LETTERS[q.answer]}
        </span>
        {peer && peer.answered > 0 && (
          <span className="flex items-center gap-1 text-foreground/70"><Users className="h-3.5 w-3.5" /> {peer.pctCorrect}% of {peer.answered} learner{peer.answered > 1 ? "s" : ""} answered correctly first time</span>
        )}
      </div>
      <div>
        <h3 className="mb-1.5 text-sm font-semibold">Explanation</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed" data-testid="text-explanation">{q.explanation}</p>
      </div>
      {q.rationales.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">Why each option is right or wrong</h3>
          <ul className="space-y-1.5 text-sm">
            {q.options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === q.answer ? "bg-success text-white" : "bg-muted"}`}>{LETTERS[i]}</span>
                <span><span className="font-medium">{o}.</span> <span className="text-muted-foreground">{q.rationales[i]}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.objective && (
        <div className="flex gap-2 rounded-lg border bg-accent/40 p-3 text-sm">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><span className="font-medium">Educational objective:</span> {q.objective}</div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>Source:</span>
        {q.sourceUrl?.startsWith("#/") ? (
          <a href={q.sourceUrl} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-question-source">{q.source} · open section</a>
        ) : q.sourceUrl ? (
          <a href={q.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-question-source">{q.source} <ExternalLink className="h-3 w-3" /></a>
        ) : <span>{q.source}</span>}
        {q.conceptId && /^D\d+$/.test(q.conceptId) && <Link href={`/concept/${q.conceptId}`} className="text-primary hover:underline">Open concept</Link>}
        {q.conceptId && !/^D\d+$/.test(q.conceptId) && q.kind === "fda_class" && <Link href={`/drugs/${q.conceptId}`} className="text-primary hover:underline">Open drug label</Link>}
        <span className="ml-auto flex items-center gap-1"><ReportButton type="question" refId={q.id} title={q.stem.slice(0, 160)} /><AddCardButton front={q.ask ? `${q.stem}\n\n${q.ask}` : q.stem} back={`${q.options[q.answer]}\n\n${q.objective || q.explanation.slice(0, 400)}`} deck={q.system} sourceType="question" sourceId={q.id} label="Make flashcard" variant="ghost" /></span>
      </div>
    </div>
  );
}
