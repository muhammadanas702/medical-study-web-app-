import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flag, Timer, Square, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ErrorState, PageHeader, Stat } from "@/components/common";
import { LabSheet } from "@/components/lab-sheet";
import { Explanation, Options, QuestionMeta, Stem } from "@/components/question-view";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LETTERS, type AnswerR, type FullQ, type SessionR, isFull } from "@/lib/quiz-types";

type Local = { selected: number | null; struck: number[]; flagged: boolean; result?: AnswerR; submitted: boolean; startedAt: number; spentMs: number };

function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function QuizRunner() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const r = useQuery<SessionR>({ queryKey: ["/api/quiz/sessions", id] });
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useState<Record<string, Local>>({});
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(Date.now());
  const enterRef = useRef(Date.now());
  const initialised = useRef(false);

  const items = r.data?.items || [];
  const sess = r.data?.session;
  const timed = sess?.mode === "timed";

  // hydrate from server attempts (resume)
  useEffect(() => {
    if (!r.data || initialised.current) return;
    initialised.current = true;
    if (r.data.session.finishedAt) { navigate(`/quiz/${id}/review`, { replace: true }); return; }
    const init: Record<string, Local> = {};
    for (const it of r.data.items) {
      init[it.question.id] = {
        selected: it.attempt?.choice ?? null, struck: [], flagged: it.attempt?.flagged ?? false, submitted: !!it.attempt, startedAt: Date.now(), spentMs: it.attempt?.timeMs ?? 0,
        result: it.attempt && isFull(it.question) ? { ...(it.question as FullQ), correct: it.attempt.correct, choice: it.attempt.choice, peer: it.peer } : undefined,
      };
    }
    setSt(init);
    const firstOpen = r.data.items.findIndex((it) => !it.attempt);
    setIdx(firstOpen < 0 ? 0 : firstOpen);
  }, [r.data, id, navigate]);

  useEffect(() => { enterRef.current = Date.now(); }, [idx]);
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timed]);

  const q = items[idx]?.question;
  const cur = q ? st[q.id] : undefined;
  const remaining = sess?.timeLimitSec ? Math.max(0, sess.timeLimitSec - (now - sess.startedAt) / 1000) : null;

  const answer = useMutation({
    mutationFn: (v: { qid: string; choice: number; timeMs: number; flagged: boolean }) =>
      apiJson<AnswerR>("POST", "/api/quiz/answer", { sessionId: Number(id), questionId: v.qid, choice: v.choice, timeMs: v.timeMs, flagged: v.flagged }),
    onSuccess: (res) => {
      setSt((s) => ({ ...s, [res.id]: { ...s[res.id], result: res, submitted: true } }));
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    },
    onError: (e: Error, v) => {
      setSt((s) => ({ ...s, [v.qid]: { ...s[v.qid], submitted: false } }));
      toast({ title: "Answer not saved", description: e.message, variant: "destructive" });
    },
  });

  const finish = useMutation({
    mutationFn: async () => {
      // timed mode: submit any selected-but-unsubmitted answers first
      for (const it of items) {
        const l = st[it.question.id];
        if (l && l.selected != null && !l.submitted) {
          await apiJson("POST", "/api/quiz/answer", { sessionId: Number(id), questionId: it.question.id, choice: l.selected, timeMs: Math.round(l.spentMs) || 1000, flagged: l.flagged });
        }
      }
      await apiJson("POST", `/api/quiz/sessions/${id}/finish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      navigate(`/quiz/${id}/review`);
    },
    onError: (e: Error) => toast({ title: "Could not end block", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (timed && remaining === 0 && !finish.isPending && !finish.isSuccess) {
      toast({ title: "Time is up", description: "Your block has been submitted." });
      finish.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, timed]);

  const go = (n: number) => {
    if (!q || n < 0 || n >= items.length) return;
    const spent = Date.now() - enterRef.current;
    setSt((s) => ({ ...s, [q.id]: { ...s[q.id], spentMs: (s[q.id]?.spentMs || 0) + (s[q.id]?.submitted ? 0 : spent) } }));
    // in timed mode a selection is committed when you move on
    if (timed && cur && cur.selected != null && !cur.submitted) {
      setSt((s) => ({ ...s, [q.id]: { ...s[q.id], submitted: true } }));
      answer.mutate({ qid: q.id, choice: cur.selected, timeMs: Math.round((cur.spentMs || 0) + spent), flagged: cur.flagged });
    }
    setIdx(n);
  };

  const submit = () => {
    if (!q || !cur || cur.selected == null || cur.submitted) return;
    const spent = Date.now() - enterRef.current;
    setSt((s) => ({ ...s, [q.id]: { ...s[q.id], submitted: true, spentMs: (s[q.id].spentMs || 0) + spent } }));
    answer.mutate({ qid: q.id, choice: cur.selected, timeMs: Math.round((cur.spentMs || 0) + spent), flagged: cur.flagged });
  };

  // keyboard: A–E select, Enter submit, ←/→ navigate, F flag
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!q || !cur || (e.target as HTMLElement)?.closest("input,textarea,[role=dialog]")) return;
      const k = e.key.toUpperCase();
      const li = LETTERS.indexOf(k);
      if (li >= 0 && li < q.options.length && !cur.submitted) setSt((s) => ({ ...s, [q.id]: { ...s[q.id], selected: li } }));
      else if (e.key === "Enter") { if (!timed && !cur.submitted) submit(); else go(idx + 1); }
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
      else if (k === "F" && !cur.submitted) setSt((s) => ({ ...s, [q.id]: { ...s[q.id], flagged: !s[q.id].flagged } }));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (r.isLoading || (r.data && !initialised.current)) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  if (!q || !cur) return <Skeleton className="h-64" />;

  const answeredCount = Object.values(st).filter((l) => l.submitted || l.selected != null).length;
  const revealed = !timed && cur.submitted && !!cur.result;

  return (
    <div className="pb-20">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="text-sm font-semibold" data-testid="text-question-position">Question {idx + 1} of {items.length}</div>
          <div className="text-xs text-muted-foreground">Block #{id} · {timed ? "Timed" : "Tutor"} mode · {answeredCount} answered</div>
        </div>
        {timed && remaining != null && (
          <Badge variant={remaining < 120 ? "destructive" : "secondary"} className="gap-1 px-2.5 py-1 tabular text-sm" data-testid="text-timer"><Timer className="h-3.5 w-3.5" />{fmtClock(remaining)}</Badge>
        )}
        <LabSheet />
        <Button variant={cur.flagged ? "default" : "outline"} size="sm" disabled={cur.submitted && !timed} onClick={() => setSt((s) => ({ ...s, [q.id]: { ...s[q.id], flagged: !s[q.id].flagged } }))} data-testid="button-flag">
          <Flag className="h-4 w-4" /> {cur.flagged ? "Flagged" : "Flag"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)} data-testid="button-end-block"><Square className="h-4 w-4" /> End block</Button>
      </div>
      <Progress value={((idx + 1) / items.length) * 100} className="mb-4 h-1.5" />

      <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
        <Card>
          <CardContent className="pt-5">
            <QuestionMeta q={q} />
            <Stem q={q} />
            <div className="mt-4">
              <Options
                q={cur.result ?? q}
                selected={cur.selected}
                struck={cur.struck}
                revealed={revealed}
                onSelect={(i) => !cur.submitted && setSt((s) => ({ ...s, [q.id]: { ...s[q.id], selected: i } }))}
                onStrike={(i) => setSt((s) => ({ ...s, [q.id]: { ...s[q.id], struck: s[q.id].struck.includes(i) ? s[q.id].struck.filter((x) => x !== i) : [...s[q.id].struck, i] } }))}
              />
            </div>
            {!timed && !cur.submitted && (
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={submit} disabled={cur.selected == null || answer.isPending} data-testid="button-submit-answer">Submit answer</Button>
                <span className="hidden text-xs text-muted-foreground sm:inline">Keys: A–E select · Enter submit · F flag · ←/→ move · right-click strikes out</span>
              </div>
            )}
            {!timed && cur.submitted && !cur.result && <Skeleton className="mt-5 h-40" />}
            {revealed && <Explanation q={cur.result!} choice={cur.selected} peer={cur.result!.peer} />}
            {timed && cur.selected != null && <p className="mt-4 text-xs text-muted-foreground">Your answer is locked in when you move to another question. Explanations are shown at the end of the block.</p>}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Navigator</div>
          <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-5" data-testid="grid-navigator">
            {items.map((it, i) => {
              const l = st[it.question.id];
              let cls = "border bg-card";
              if (!timed && l?.result) cls = l.result.correct ? "bg-success/15 border-success text-success" : "bg-destructive/10 border-destructive text-destructive";
              else if (l?.selected != null) cls = "bg-accent border-primary";
              return (
                <button key={it.question.id} onClick={() => go(i)} className={`relative h-8 rounded-md text-xs font-medium tabular ${cls} ${i === idx ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : ""}`} data-testid={`button-nav-${i}`} aria-label={`Question ${i + 1}`}>
                  {i + 1}
                  {l?.flagged && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur md:left-[var(--sidebar-width)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <Button variant="outline" onClick={() => go(idx - 1)} disabled={idx === 0} data-testid="button-prev-question"><ChevronLeft className="h-4 w-4" /> Previous</Button>
          {idx === items.length - 1 ? (
            <Button onClick={() => setConfirmEnd(true)} data-testid="button-finish">Finish block</Button>
          ) : (
            <Button onClick={() => go(idx + 1)} data-testid="button-next-question">Next <ChevronRight className="h-4 w-4" /></Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this block?</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount} of {items.length} answered. Unanswered questions count as omitted and their answers will be revealed in the review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end">Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish.mutate()} data-testid="button-confirm-end">{finish.isPending ? "Submitting…" : "End and review"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function QuizReview() {
  const { id } = useParams<{ id: string }>();
  const r = useQuery<SessionR>({ queryKey: ["/api/quiz/sessions", id] });
  const [filter, setFilter] = useState<"all" | "incorrect" | "flagged" | "omitted">("all");
  const [open, setOpen] = useState<string | null>(null);
  const sum = useMemo(() => {
    const items = r.data?.items || [];
    const answered = items.filter((i) => i.attempt);
    const correct = answered.filter((i) => i.attempt!.correct).length;
    const time = answered.reduce((s, i) => s + i.attempt!.timeMs, 0);
    const bySys = new Map<string, { n: number; c: number }>();
    for (const i of items) {
      const g = bySys.get(i.question.system) || { n: 0, c: 0 };
      g.n++; g.c += i.attempt?.correct ? 1 : 0;
      bySys.set(i.question.system, g);
    }
    return { total: items.length, answered: answered.length, correct, avg: answered.length ? Math.round(time / answered.length / 1000) : 0, bySys: Array.from(bySys) };
  }, [r.data]);
  if (r.isLoading) return <Skeleton className="h-80" />;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const items = r.data!.items.filter((i) => filter === "all" || (filter === "incorrect" && i.attempt && !i.attempt.correct) || (filter === "flagged" && i.attempt?.flagged) || (filter === "omitted" && !i.attempt));
  const pctScore = sum.total ? Math.round((sum.correct / sum.total) * 100) : 0;

  return (
    <div>
      <PageHeader eyebrow={`Block #${id} · ${r.data!.session.mode === "timed" ? "Timed" : "Tutor"}`} title="Block review" subtitle="Every question with the answer, explanation and source. Use the filters to focus on what you missed."
        actions={<><Button asChild variant="outline"><Link href="/qbank" data-testid="link-new-block">New block</Link></Button><Button asChild><Link href="/analytics" data-testid="link-review-analytics">Performance</Link></Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Score" value={`${pctScore}%`} hint={`${sum.correct} of ${sum.total} correct`} testId="text-score" />
        <Stat label="Answered" value={`${sum.answered}/${sum.total}`} hint={`${sum.total - sum.answered} omitted`} />
        <Stat label="Avg time / question" value={`${sum.avg}s`} hint="Exam pace is about 90 s" />
        <Stat label="Systems covered" value={sum.bySys.length} hint={sum.bySys.slice(0, 2).map(([k]) => k).join(", ")} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "incorrect", "flagged", "omitted"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize" data-testid={`button-filter-${f}`}>{f}</Button>
        ))}
      </div>
      <div className="space-y-2" data-testid="list-review">
        {items.map((it) => {
          const q = it.question;
          const ix = r.data!.items.indexOf(it) + 1;
          const isOpen = open === q.id;
          return (
            <Card key={q.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : q.id)} data-testid={`button-review-item-${ix}`}>
                {it.attempt ? (it.attempt.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />) : <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <span className="w-6 text-sm tabular text-muted-foreground">{ix}</span>
                <span className="line-clamp-1 flex-1 text-sm">{q.stem}</span>
                {it.attempt?.flagged && <Flag className="h-4 w-4 fill-warning text-warning" />}
                <span className="hidden text-xs text-muted-foreground sm:inline">{q.system}</span>
              </button>
              {isOpen && isFull(q) && (
                <CardContent className="border-t pt-4">
                  <QuestionMeta q={q} />
                  <Stem q={q} />
                  <div className="mt-4"><Options q={q} selected={it.attempt?.choice ?? null} struck={[]} revealed /></div>
                  <Explanation q={q} choice={it.attempt?.choice ?? null} peer={it.peer} />
                </CardContent>
              )}
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing in this filter.</p>}
      </div>
    </div>
  );
}
