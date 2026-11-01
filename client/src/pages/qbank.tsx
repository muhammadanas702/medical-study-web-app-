import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Timer, GraduationCap, Play, History, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ListSkeleton, ErrorState } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";
import { useToast } from "@/hooks/use-toast";
import { KIND_LABEL, fmtDate } from "@/lib/meta";

type Facet = { v: string; n: number };
type Facets = { systems: Facet[]; disciplines: Facet[]; kinds: Facet[] };
type Sess = { id: number; mode: string; startedAt: number; finishedAt: number | null; total: number; answered: number; correct: number; config: any };

function FacetList({ title, items, selected, onToggle, label, testid }: { title: string; items: Facet[]; selected: string[]; onToggle: (v: string) => void; label?: (v: string) => string; testid: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{selected.length ? `${selected.length} selected` : "All"}</div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((f) => (
          <label key={f.v} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover-elevate">
            <Checkbox checked={selected.includes(f.v)} onCheckedChange={() => onToggle(f.v)} data-testid={`checkbox-${testid}-${f.v.replace(/\W+/g, "-").toLowerCase()}`} />
            <span className="flex-1 truncate">{label ? label(f.v) : f.v}</span>
            <span className="text-xs tabular text-muted-foreground">{f.n.toLocaleString()}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Qbank() {
  const [params, update] = useHashQuery();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const concept = params.get("concept") || "";
  const presetSystem = params.get("system") || "";
  const facets = useQuery<Facets>({ queryKey: ["/api/questions/facets"] });
  const sessions = useQuery<{ sessions: Sess[] }>({ queryKey: ["/api/quiz/sessions"] });
  const [systems, setSystems] = useState<string[]>(presetSystem ? [presetSystem] : []);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<"tutor" | "timed">("tutor");
  const [pool, setPool] = useState<"all" | "unseen" | "incorrect" | "flagged">("all");
  useEffect(() => { if (presetSystem) setSystems([presetSystem]); }, [presetSystem]);
  const toggle = (set: (f: (p: string[]) => string[]) => void) => (v: string) => set((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const countQ = useQuery<{ n: number }>({
    queryKey: ["/api/questions/count", systems, disciplines, kinds, pool, concept],
    queryFn: () => apiJson("POST", "/api/questions/count", { systems, disciplines, kinds, pool, ...(concept ? { conceptId: concept } : {}) }),
  });
  const estimate = countQ.data?.n;

  const build = useMutation({
    mutationFn: () => apiJson<{ session: { id: number }; available: number }>("POST", "/api/quiz/build", { systems, disciplines, kinds, count, mode, pool, ...(concept ? { conceptId: concept } : {}) }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/sessions"] });
      navigate(`/quiz/${r.session.id}`);
    },
    onError: (e: Error) => toast({ title: "Could not build block", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Question bank"
        subtitle="Build a custom block. Tutor mode reveals the answer, explanation and why each distractor is wrong right after you answer; timed mode gives 90 seconds per question like the exam and reveals everything at the end."
      />
      {concept && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-accent/50 px-4 py-2.5 text-sm" data-testid="banner-concept">
          <span>Questions limited to one topic: <span className="font-mono">{concept}</span></span>
          <Button size="sm" variant="ghost" onClick={() => update({ concept: null })} data-testid="button-clear-concept"><X className="h-4 w-4" /> Clear</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-6 pt-5">
            {facets.isLoading ? <ListSkeleton rows={6} /> : facets.isError ? <ErrorState error={facets.error} /> : (
              <>
                <FacetList title="Systems" items={facets.data!.systems} selected={systems} onToggle={toggle(setSystems)} testid="system" />
                <FacetList title="Disciplines" items={facets.data!.disciplines} selected={disciplines} onToggle={toggle(setDisciplines)} testid="discipline" />
                <FacetList title="Question types" items={facets.data!.kinds} selected={kinds} onToggle={toggle(setKinds)} label={(v) => KIND_LABEL[v] ?? v} testid="kind" />
              </>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Block settings</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between text-sm"><Label>Questions</Label><span className="tabular font-medium" data-testid="text-count">{count}</span></div>
                <Slider min={5} max={40} step={1} value={[count]} onValueChange={(v) => setCount(v[0])} data-testid="slider-count" />
                <div className="mt-1 text-xs text-muted-foreground">USMLE Step 1 blocks have up to 40 questions.</div>
              </div>
              <div>
                <Label className="mb-2 block">Mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as "tutor" | "timed")} className="grid grid-cols-2 gap-2">
                  {[{ v: "tutor", icon: GraduationCap, l: "Tutor" }, { v: "timed", icon: Timer, l: "Timed" }].map((o) => (
                    <Label key={o.v} htmlFor={`mode-${o.v}`} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm ${mode === o.v ? "border-primary bg-accent" : ""}`}>
                      <RadioGroupItem id={`mode-${o.v}`} value={o.v} data-testid={`radio-mode-${o.v}`} /><o.icon className="h-4 w-4" />{o.l}
                    </Label>
                  ))}
                </RadioGroup>
                {mode === "timed" && <div className="mt-1 text-xs text-muted-foreground">{Math.round((count * 90) / 60)} minutes total.</div>}
              </div>
              <div>
                <Label className="mb-2 block">Question pool</Label>
                <RadioGroup value={pool} onValueChange={(v) => setPool(v as typeof pool)} className="space-y-1">
                  {[{ v: "all", l: "All questions" }, { v: "unseen", l: "Unused only" }, { v: "incorrect", l: "Previously incorrect" }, { v: "flagged", l: "Flagged" }].map((o) => (
                    <div key={o.v} className="flex items-center gap-2"><RadioGroupItem id={`pool-${o.v}`} value={o.v} data-testid={`radio-pool-${o.v}`} /><Label htmlFor={`pool-${o.v}`} className="text-sm font-normal">{o.l}</Label></div>
                  ))}
                </RadioGroup>
              </div>
              <div className="text-xs text-muted-foreground"><span className="tabular font-medium text-foreground" data-testid="text-available">{estimate == null ? "…" : estimate.toLocaleString()}</span> questions match these filters.</div>
              <Button className="w-full" onClick={() => build.mutate()} disabled={build.isPending || estimate === 0} data-testid="button-build-block">
                <Play className="h-4 w-4" /> {build.isPending ? "Building…" : "Start block"}
              </Button>
            </CardContent>
          </Card>
          <div className="flex gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Clinical vignettes are written from cited guidelines and references. Other items are generated directly from NLM and FDA records, and every explanation links to its source record.</span>
          </div>
        </div>
      </div>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4" /> Previous blocks</h2>
      {sessions.isLoading ? <ListSkeleton rows={3} /> : !sessions.data?.sessions.length ? (
        <p className="text-sm text-muted-foreground">Blocks you start will appear here so you can resume or review them.</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card" data-testid="list-sessions">
          {sessions.data.sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Block #{s.id} · {s.mode === "timed" ? "Timed" : "Tutor"} · {s.total} questions</div>
                <div className="text-xs text-muted-foreground">{fmtDate(s.startedAt)} · {(s.config?.systems as string[])?.length ? (s.config.systems as string[]).join(", ") : "All systems"}</div>
              </div>
              <Badge variant="secondary" className="tabular font-normal">{s.answered}/{s.total} answered{s.answered ? ` · ${Math.round((s.correct / s.answered) * 100)}%` : ""}</Badge>
              {s.finishedAt ? (
                <Button asChild size="sm" variant="outline"><Link href={`/quiz/${s.id}/review`} data-testid={`button-review-${s.id}`}>Review</Link></Button>
              ) : (
                <Button asChild size="sm"><Link href={`/quiz/${s.id}`} data-testid={`button-resume-${s.id}`}>Resume</Link></Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
