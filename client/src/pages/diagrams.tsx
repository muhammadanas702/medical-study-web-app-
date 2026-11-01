import { useEffect, useState } from "react";
import { Link } from "wouter";
import { DIAGRAMS, DIAGRAM_SYSTEM_MAP, type Hotspot } from "@/lib/diagrams";
import { ART_BY_ID } from "@/components/DiagramArt";
import { PageHeader, BookmarkButton } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHashQuery } from "@/lib/hash-query";
import { Check, Crosshair, Eye, EyeOff, Lightbulb, ListChecks, MousePointerClick, RefreshCw, X } from "lucide-react";

function shuffle<T>(a: T[]): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

type Mode = "explore" | "test";

export default function DiagramsPage() {
  const [params, setParams] = useHashQuery();
  const diagram = DIAGRAMS.find((d) => d.id === params.get("d")) ?? DIAGRAMS[0];
  const Art = ART_BY_ID[diagram.id];

  const [active, setActive] = useState<Hotspot | null>(diagram.hotspots[0]);
  const [hover, setHover] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [mode, setMode] = useState<Mode>("explore");

  // test-mode state
  const [order, setOrder] = useState<Hotspot[]>([]);
  const [ti, setTi] = useState(0);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean } | null>(null);

  const startTest = () => {
    const o = shuffle(diagram.hotspots);
    setOrder(o);
    setTi(0);
    setScore({ right: 0, wrong: 0 });
    setFeedback(null);
    setMode("test");
    setActive(null);
  };

  useEffect(() => {
    setActive(diagram.hotspots[0]);
    setMode("explore");
    setFeedback(null);
  }, [diagram.id]);

  const target = mode === "test" ? order[ti] : null;
  const done = mode === "test" && ti >= order.length;

  const clickHotspot = (h: Hotspot) => {
    if (mode === "explore") {
      setActive(h);
      return;
    }
    if (!target || feedback) return;
    const ok = h.id === target.id;
    setFeedback({ id: h.id, ok });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }));
    setActive(target);
  };

  const next = () => {
    setFeedback(null);
    setActive(null);
    setTi((i) => i + 1);
  };

  const showLabel = labels && mode === "explore";

  return (
    <div className="flex flex-col">
      <PageHeader eyebrow="High-yield diagrams" title={diagram.title} subtitle="Schematic review diagrams with annotated hotspots. Explore each structure, then switch to Test me to recall it without labels." actions={<div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5" role="tablist">
          {(["explore", "test"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              data-testid={`tab-mode-${m}`}
              onClick={() => (m === "test" ? startTest() : (setMode("explore"), setActive(diagram.hotspots[0]), setFeedback(null)))}
              className={`rounded px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              {m === "explore" ? "Explore" : "Test me"}
            </button>
          ))}
        </div>
        {mode === "explore" && (
          <Button variant="outline" size="sm" onClick={() => setLabels((v) => !v)} data-testid="button-toggle-labels">
            {labels ? <EyeOff /> : <Eye />} {labels ? "Hide labels" : "Show labels"}
          </Button>
        )}
        <BookmarkButton type="diagram" refId={diagram.id} title={diagram.title} />
      </div>} />

      {/* diagram tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {DIAGRAMS.map((d) => (
          <button
            key={d.id}
            onClick={() => setParams({ d: d.id }, false)}
            data-testid={`tab-diagram-${d.id}`}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm ${d.id === diagram.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {d.title}
          </button>
        ))}
      </div>

      <div className="mt-4 grid flex-1 gap-0 overflow-hidden rounded-xl border lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 p-4 md:p-6">
          <p className="mb-4 max-w-prose text-sm text-muted-foreground">{diagram.blurb}</p>

          {mode === "test" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3" data-testid="panel-test-prompt">
              {done ? (
                <div className="text-sm">
                  <span className="font-semibold">Round complete.</span> {score.right}/{order.length} correct.
                </div>
              ) : (
                <div className="flex min-w-0 items-start gap-2.5 text-sm">
                  <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Prompt {ti + 1} of {order.length} — click the hotspot</div>
                    <div className="font-medium" data-testid="text-test-prompt">{target?.prompt}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tabular">
                  <span className="text-success">{score.right}✓</span> <span className="text-destructive">{score.wrong}✗</span>
                </span>
                {done ? (
                  <Button size="sm" onClick={startTest} data-testid="button-test-restart"><RefreshCw /> Again</Button>
                ) : feedback ? (
                  <Button size="sm" onClick={next} data-testid="button-test-next">Next</Button>
                ) : null}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-card-border bg-card">
            <svg viewBox="0 0 800 540" className="diagram-svg block h-auto w-full text-muted-foreground" role="img" aria-label={diagram.title} data-testid="svg-diagram">
              <Art showLabels={showLabel} />
              {diagram.hotspots.map((h, i) => {
                const isActive = active?.id === h.id;
                const isHover = hover === h.id;
                const fb = feedback && (feedback.id === h.id || target?.id === h.id);
                const color = fb
                  ? target?.id === h.id
                    ? "hsl(var(--success))"
                    : "hsl(var(--destructive))"
                  : isActive
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground))";
                return (
                  <g
                    key={h.id}
                    transform={`translate(${h.x} ${h.y})`}
                    onClick={() => clickHotspot(h)}
                    onMouseEnter={() => setHover(h.id)}
                    onMouseLeave={() => setHover(null)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clickHotspot(h)}
                    tabIndex={0}
                    role="button"
                    aria-label={mode === "test" ? `Hotspot ${i + 1}` : h.label}
                    data-testid={`hotspot-${h.id}`}
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    <circle r="22" fill="transparent" />
                    {!isActive && !fb && <circle className="hs-ring" r="9" fill="none" stroke={color} strokeWidth="1.5" />}
                    <circle r={isActive || isHover ? 12 : 10} fill={color} fillOpacity={isActive || fb ? 1 : 0.85} stroke="hsl(var(--card))" strokeWidth="2.5" />
                    <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--card))">{i + 1}</text>
                    {(showLabel || (mode === "explore" && isHover)) && (
                      <g transform={`translate(${h.side === "left" || h.x + h.label.length * 7 + 40 > 800 ? -(h.label.length * 7 + 30) : 16} -10)`}>
                        <rect x="0" y="-4" rx="4" height="22" width={h.label.length * 7 + 14} fill="hsl(var(--background) / 0.9)" stroke="hsl(var(--border))" />
                        <text x="7" y="11" fontSize="12" fontWeight="600" fill="hsl(var(--foreground))">{h.label}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {mode === "explore" && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {diagram.hotspots.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => setActive(h)}
                  data-testid={`chip-hotspot-${h.id}`}
                  className={`hover-elevate rounded-full border px-2.5 py-1 text-xs ${active?.id === h.id ? "border-primary/60 bg-primary/15" : "border-border text-muted-foreground"}`}
                >
                  <span className="mr-1 font-mono">{i + 1}</span>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="border-t border-border bg-card lg:border-l lg:border-t-0">
          {active && (mode === "explore" || feedback) ? (
            <div className="space-y-5 p-5" data-testid="panel-annotation">
              {feedback && (
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${feedback.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`} data-testid="text-test-feedback">
                  {feedback.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {feedback.ok ? "Correct" : `Not quite — the answer is ${active.label}`}
                </div>
              )}
              <div>
                <Badge variant="secondary">{diagram.system}</Badge>
                <h2 className="mt-2 text-lg font-semibold" data-testid="text-annotation-title">{active.title}</h2>
              </div>
              <ul className="space-y-2.5 text-sm">
                {active.facts.map((f, i) => (
                  <li key={i} className="flex gap-2.5 leading-relaxed">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <Lightbulb className="h-3.5 w-3.5" /> Board pearl
                </div>
                {active.pearl}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <Crosshair className="h-5 w-5" />
              {mode === "test" ? "Hotspot labels are hidden. Pick the structure that matches the prompt." : "Select a hotspot to see its annotation."}
            </div>
          )}
          <div className="border-t border-border p-5">
            <div className="text-xs text-muted-foreground">Apply it: practice questions from the {DIAGRAM_SYSTEM_MAP[diagram.system]} question bank.</div>
            <Button asChild className="mt-3 w-full" variant="outline" data-testid="button-quiz-diagram">
              <Link href={`/qbank?system=${encodeURIComponent(DIAGRAM_SYSTEM_MAP[diagram.system])}`}><ListChecks /> Practice {DIAGRAM_SYSTEM_MAP[diagram.system]} questions</Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Diagrams are simplified teaching schematics written from standard physiology and pharmacology references; verify details against your course texts.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
