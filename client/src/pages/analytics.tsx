import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, Stat } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { KIND_LABEL } from "@/lib/meta";
import { useToast } from "@/hooks/use-toast";

type G = { key: string; answered: number; correct: number; pct: number; avgSec: number };
type A = { total: number; correct: number; pct: number | null; firstTryPct: number | null; unique: number; bank: number; avgSec: number | null; streak: number; bySystem: G[]; byDiscipline: G[]; byKind: G[]; daily: { date: string; answered: number; pct: number }[] };

function color(p: number) {
  return p >= 75 ? "hsl(var(--success))" : p >= 55 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
}

function Breakdown({ title, rows, label }: { title: string; rows: G[]; label?: (k: string) => string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.key} className="text-sm" data-testid={`row-breakdown-${r.key.replace(/\W+/g, "-").toLowerCase()}`}>
            <div className="mb-1 flex justify-between gap-2"><span className="truncate">{label ? label(r.key) : r.key}</span><span className="shrink-0 tabular text-muted-foreground">{r.correct}/{r.answered} · <span className="font-medium text-foreground">{r.pct}%</span></span></div>
            <Progress value={r.pct} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { toast } = useToast();
  const r = useQuery<A>({ queryKey: ["/api/analytics"] });
  const reset = useMutation({
    mutationFn: () => apiJson("POST", "/api/analytics/reset"),
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Question history cleared" }); },
  });
  if (r.isLoading) return <ListSkeleton rows={6} />;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const a = r.data!;
  if (a.total === 0) return (
    <div>
      <PageHeader title="Performance" />
      <EmptyState title="No answers yet">Complete a block in the question bank and your accuracy by system, discipline and question type will appear here. <div className="mt-3"><Button asChild><Link href="/qbank">Go to question bank</Link></Button></div></EmptyState>
    </div>
  );
  const sys = [...a.bySystem].sort((x, y) => y.answered - x.answered);
  const weak = a.bySystem.filter((s) => s.answered >= 5).sort((x, y) => x.pct - y.pct).slice(0, 3);
  return (
    <div>
      <PageHeader title="Performance" subtitle="All attempts, with first-attempt accuracy as the most honest measure of exam readiness."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" data-testid="button-reset-analytics">Reset history</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Clear all question history?</AlertDialogTitle><AlertDialogDescription>This deletes every attempt and block for this account or session. Flashcards and notes are kept.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => reset.mutate()} data-testid="button-confirm-reset">Clear history</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        } />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="First-attempt accuracy" value={a.firstTryPct == null ? "—" : `${a.firstTryPct}%`} hint={`${a.unique} unique questions`} testId="text-first-try" />
        <Stat label="All attempts" value={`${a.pct}%`} hint={`${a.correct} of ${a.total} correct`} />
        <Stat label="Bank coverage" value={`${((a.unique / Math.max(1, a.bank)) * 100).toFixed(1)}%`} hint={`of ${a.bank.toLocaleString()} questions`} />
        <Stat label="Avg time" value={a.avgSec == null ? "—" : `${a.avgSec}s`} hint={`${a.streak}-day streak`} />
      </div>
      {weak.length > 0 && (
        <div className="mb-6 rounded-lg border bg-accent/40 p-4 text-sm">
          <span className="font-medium">Focus next on:</span> {weak.map((w) => `${w.key} (${w.pct}%)`).join(", ")}.{" "}
          <Link href={`/qbank?system=${encodeURIComponent(weak[0].key)}`} className="text-primary hover:underline" data-testid="link-drill-weakest">Drill {weak[0].key}</Link>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Accuracy by system</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: Math.max(180, sys.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sys} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="key" width={150} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number, _n, p: any) => [`${v}% (${p.payload.correct}/${p.payload.answered})`, "Accuracy"]} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]}>{sys.map((s) => <Cell key={s.key} fill={color(s.pct)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Daily volume and accuracy</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.daily} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(d) => d.slice(5)} />
                  <YAxis yAxisId="l" fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line yAxisId="l" type="monotone" dataKey="answered" name="Answered" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="r" type="monotone" dataKey="pct" name="Accuracy %" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Breakdown title="By discipline" rows={a.byDiscipline} />
        <Breakdown title="By question type" rows={a.byKind} label={(k) => KIND_LABEL[k] ?? k} />
      </div>
    </div>
  );
}
