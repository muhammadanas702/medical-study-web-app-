import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Focus, Loader2, RotateCcw, Search, X, Maximize2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader, ErrorState, ExtLink, BookmarkButton } from "@/components/common";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { assetUrl } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";

type Part = { fj: string; fma: string; name: string; system: string; mesh_id: string | null; mesh_name: string | null };

export const SYSTEMS: { key: string; label: string; color: string }[] = [
  { key: "skeletal", label: "Skeletal", color: "#e7dcc3" },
  { key: "muscular", label: "Muscular", color: "#b8574c" },
  { key: "cardiovascular", label: "Cardiovascular", color: "#d2433a" },
  { key: "nervous", label: "Nervous", color: "#e8c55d" },
  { key: "respiratory", label: "Respiratory", color: "#e9a3a8" },
  { key: "digestive", label: "Digestive", color: "#d69a78" },
  { key: "urinary", label: "Urinary", color: "#c58a5f" },
  { key: "endocrine", label: "Endocrine", color: "#9c7ccc" },
  { key: "reproductive", label: "Reproductive", color: "#d48fb0" },
  { key: "integumentary", label: "Integumentary (skin)", color: "#e6c1a3" },
];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.key, s]));

function styleFor(system: string, name: string): { color: string; opacity?: number } {
  const n = name.toLowerCase();
  if (system === "cardiovascular") {
    if (/\bvein|venous|vena|sinus\b|portal/.test(n)) return { color: "#3d6fc4" };
    if (/myocard|atri|ventric|valve|heart|cusp|papillary|chordae|septum/.test(n)) return { color: "#b5403a" };
    return { color: "#d2433a" };
  }
  if (system === "integumentary") return { color: SYS.integumentary.color, opacity: 0.3 };
  if (system === "muscular") return { color: SYS.muscular.color, opacity: 0.9 };
  return { color: SYS[system]?.color ?? "#cccccc" };
}

export default function AtlasPage() {
  const [params, setParams] = useHashQuery();
  const viewer = useRef<ViewerHandle>(null);
  const parts = useQuery<{ parts: Part[]; source: any }>({ queryKey: ["/api/anatomy/parts"] });
  const initialSystems = (params.get("system") || "skeletal").split(",").filter((s) => SYS[s]);
  const [on, setOn] = useState<Set<string>>(new Set(initialSystems.length ? initialSystems : ["skeletal"]));
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [spin, setSpin] = useState(false);
  const focusDone = useRef(false);

  const byFj = useMemo(() => new Map((parts.data?.parts ?? []).map((p) => [p.fj, p])), [parts.data]);

  // load / show / hide systems
  useEffect(() => {
    const v = viewer.current; if (!v) return;
    for (const s of SYSTEMS) {
      if (on.has(s.key)) {
        if (loaded.has(s.key)) { v.setVisible(s.key, true); continue; }
        if (loading.has(s.key)) continue;
        setLoading((x) => new Set(x).add(s.key));
        v.load(s.key, assetUrl(`/models/anatomy/${s.key}.glb`), (nm) => styleFor(s.key, byFj.get(nm)?.name ?? ""))
          .then(() => setLoaded((x) => new Set(x).add(s.key)))
          .catch((e) => setFailed((f) => ({ ...f, [s.key]: String(e?.message ?? e) })))
          .finally(() => setLoading((x) => { const n = new Set(x); n.delete(s.key); return n; }));
      } else if (loaded.has(s.key)) v.setVisible(s.key, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, loaded, byFj.size]);

  // deep-link focus=FJ1,FJ2
  useEffect(() => {
    const f = params.get("focus");
    if (!f || focusDone.current || !byFj.size) return;
    const ids = f.split(",").filter((id) => byFj.has(id));
    if (!ids.length) { focusDone.current = true; return; }
    const sys = new Set(ids.map((id) => byFj.get(id)!.system));
    if (Array.from(sys).some((s) => !on.has(s))) { setOn((o) => new Set([...Array.from(o), ...Array.from(sys)])); return; }
    if (Array.from(sys).every((s) => loaded.has(s))) {
      focusDone.current = true;
      setSelected(ids[0]);
      viewer.current?.select(ids, true);
    }
  }, [params, byFj, loaded, on]);

  const select = (fj: string | null, frame = false) => {
    setSelected(fj);
    viewer.current?.select(fj ? [fj] : [], frame);
    if (isolated && fj) viewer.current?.isolate([fj]);
  };

  const toggleSystem = (key: string, v: boolean) => {
    const n = new Set(on); v ? n.add(key) : n.delete(key);
    setOn(n);
    setParams({ system: Array.from(n).join(",") || null, focus: null });
  };

  const visibleParts = (parts.data?.parts ?? []).filter((p) => on.has(p.system));
  const ql = q.trim().toLowerCase();
  const list = ql ? visibleParts.filter((p) => p.name.toLowerCase().includes(ql) || p.fma.toLowerCase().includes(ql) || p.fj.toLowerCase() === ql) : visibleParts;
  const sel = selected ? byFj.get(selected) : null;
  const busy = loading.size > 0;
  const src = parts.data?.source;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="3D anatomy"
        title="Anatomy atlas"
        subtitle="Real segmented human anatomy from BodyParts3D (DBCLS), built from a full-body MRI/CT reference. Drag to rotate, scroll or pinch to zoom, right-drag to pan, click a structure to identify it."
      />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        {/* systems & parts */}
        <Card className="order-2 lg:order-1">
          <CardContent className="space-y-4 p-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Systems</div>
              <div className="space-y-1.5">
                {SYSTEMS.map((s) => (
                  <label key={s.key} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover-elevate" data-testid={`toggle-system-${s.key}`}>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border" style={{ background: s.color }} />
                      {s.label}
                      {loading.has(s.key) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </span>
                    <Switch checked={on.has(s.key)} onCheckedChange={(v) => toggleSystem(s.key, v)} aria-label={`Show ${s.label}`} />
                  </label>
                ))}
              </div>
              {Object.entries(failed).map(([k, m]) => <p key={k} className="mt-2 text-xs text-destructive">Could not load {k}: {m}</p>)}
            </div>
            {Array.from(on).filter((k) => loaded.has(k)).length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layer opacity</div>
                {SYSTEMS.filter((s) => on.has(s.key) && loaded.has(s.key)).map((s) => (
                  <div key={s.key} className="mb-2">
                    <div className="mb-1 flex justify-between text-xs"><span>{s.label}</span><span className="tabular-nums text-muted-foreground">{Math.round((opacity[s.key] ?? (styleFor(s.key, "").opacity ?? 1)) * 100)}%</span></div>
                    <Slider data-testid={`opacity-${s.key}`} min={5} max={100} step={5} value={[Math.round((opacity[s.key] ?? (styleFor(s.key, "").opacity ?? 1)) * 100)]}
                      onValueChange={([v]) => { setOpacity((o) => ({ ...o, [s.key]: v / 100 })); viewer.current?.setGroupOpacity(s.key, v / 100); viewer.current?.select(selected ? [selected] : []); }} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* viewer */}
        <div className="order-1 lg:order-2">
          <div className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-xl border bg-gradient-to-b from-muted/40 to-muted/80 lg:h-[72vh]">
            <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-atlas" onPick={(n) => select(n && byFj.has(n) ? n : null)} />
            {busy && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading 3D meshes…</Badge>
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => { viewer.current?.reset(); setSelected(null); setIsolated(false); setHidden([]); }} data-testid="button-reset-view"><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
              <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
              <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
            </div>
            {hidden.length > 0 && (
              <div className="absolute bottom-3 right-3">
                <Button size="sm" variant="secondary" onClick={() => { setHidden([]); viewer.current?.hideMeshes([]); }} data-testid="button-unhide">Show {hidden.length} hidden</Button>
              </div>
            )}
          </div>
          {src && (
            <p className="mt-2 text-xs text-muted-foreground">
              Models: <ExtLink href="https://lifesciencedb.jp/bp3d/">BodyParts3D</ExtLink>, © The Database Center for Life Science (DBCLS), licensed CC BY-SA 2.1 Japan. Structure names and FMA identifiers from BodyParts3D; MeSH links matched by name. {parts.data?.parts.length.toLocaleString()} structures across 10 systems.
            </p>
          )}
        </div>

        {/* selection + list */}
        <div className="order-3 space-y-4">
          <Card>
            <CardContent className="p-4">
              {sel ? (
                <div className="space-y-3" data-testid="panel-selected">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{SYS[sel.system]?.label}</div>
                      <h3 className="text-base font-semibold leading-snug" data-testid="text-selected-name">{cap(sel.name)}</h3>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{sel.fma} · {sel.fj}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => select(null)} aria-label="Clear selection"><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => viewer.current?.select([sel.fj], true)} data-testid="button-focus"><Focus className="mr-1 h-3.5 w-3.5" />Zoom to</Button>
                    <Button size="sm" variant={isolated ? "default" : "outline"} data-testid="button-isolate"
                      onClick={() => { const n = !isolated; setIsolated(n); viewer.current?.isolate(n ? [sel.fj] : null); }}>
                      {isolated ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}{isolated ? "Show all" : "Isolate"}
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-hide"
                      onClick={() => { const h = [...hidden, sel.fj]; setHidden(h); viewer.current?.hideMeshes(h); select(null); }}>Hide</Button>
                    <BookmarkButton type="anatomy" refId={sel.fj} title={sel.name} />
                  </div>
                  {sel.mesh_id ? (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">MeSH heading</div>
                      <Link href={`/concept/${sel.mesh_id}`} className="font-medium text-primary hover:underline" data-testid="link-selected-concept">{sel.mesh_name}</Link>
                      <div className="mt-1 text-xs text-muted-foreground">Definition, hierarchy and practice questions</div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No exact MeSH heading matched this structure name.</p>
                  )}
                  <ExtLink href={`https://www.ebi.ac.uk/ols4/search?q=${encodeURIComponent(sel.fma)}&ontology=fma`}>Look up {sel.fma} in the FMA ontology</ExtLink>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-selection">Click any structure in the model, or pick one from the list below.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Find a structure…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-part-search" />
              </div>
              <div className="text-xs text-muted-foreground">{list.length.toLocaleString()} structures in visible systems</div>
              {parts.isError ? <ErrorState error={parts.error} onRetry={() => parts.refetch()} /> : (
                <ScrollArea className="h-72">
                  <ul className="space-y-0.5 pr-2">
                    {list.slice(0, 400).map((p) => (
                      <li key={p.fj}>
                        <button onClick={() => loaded.has(p.system) && select(p.fj, true)} disabled={!loaded.has(p.system)}
                          className={`w-full rounded px-2 py-1 text-left text-sm hover-elevate ${selected === p.fj ? "bg-primary/10 font-medium text-primary" : ""}`} data-testid={`button-part-${p.fj}`}>
                          {cap(p.name)}
                        </button>
                      </li>
                    ))}
                    {list.length > 400 && <li className="px-2 py-1 text-xs text-muted-foreground">Refine the search to see more…</li>}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
