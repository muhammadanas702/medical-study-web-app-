import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Focus, Loader2, RotateCcw, Search, X, Maximize2, RefreshCw, Pencil, BookOpen, ListChecks, ImageIcon, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, ErrorState, ExtLink, BookmarkButton, ReportButton, ListSkeleton, useDebounced } from "@/components/common";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { WikiArticleView, ArticleText, type WikiArticle } from "@/components/wiki-article";
import { apiJson, assetUrl, queryClient } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/hooks/use-toast";

type Part = { fj: string; fma: string; name: string; system: string; mesh_id: string | null; mesh_name: string | null; kind: string | null; side: string | null; own: number; described: number };
type Rel = { fma: string; name: string; nfj?: number; wiki?: string | null };
type PartDetail = {
  fj: string; fma: string; name: string; system: string; side: string | null; kind: string | null; ta98: string[]; qid: string | null;
  generic: { fma: string; name: string; nfj: number; fjs: string[]; uberon: string | null } | null;
  article: WikiArticle | null; contextArticle: (WikiArticle & { viaFma: string; viaName: string }) | null;
  mesh: { id: string; name: string; scope_note: string | null; exact: boolean } | null;
  partOf: Rel[]; isa: Rel[]; children: Rel[]; subtypes: Rel[];
  override: { description: string; updated_at: number } | null;
  sections: { id: number; book: string; chapter: string; title: string; snip: string }[];
  figures: { id: number; title: string; src: string; book: string }[];
  questionCount: number; links: { fma: string; wikidata: string | null; bodyparts3d: string };
};
type Concept = { fma: string; name: string; wiki: string | null; mesh_id: string | null; ta98: string | null; nfj: number; fjs: string[]; part_parents: Rel[]; part_children: Rel[]; isa_parents: Rel[]; isa_children: Rel[]; systems: string[]; article: WikiArticle | null };

export const SYSTEMS: { key: string; label: string; color: string }[] = [
  { key: "skeletal", label: "Skeletal", color: "#e7dcc3" },
  { key: "muscular", label: "Muscular", color: "#b8574c" },
  { key: "cardiovascular", label: "Cardiovascular", color: "#d2433a" },
  { key: "nervous", label: "Nervous", color: "#e8c55d" },
  { key: "sensory", label: "Eye & ear (sensory)", color: "#7fb3d5" },
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
  if (system === "sensory") {
    if (/lens/.test(n)) return { color: "#d9ecf5", opacity: 0.85 };
    if (/sclera|cornea/.test(n)) return { color: "#f2f0ea", opacity: 0.55 };
    if (/retina|choroid/.test(n)) return { color: "#c0504d" };
    return { color: SYS.sensory.color };
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
  const [concept, setConcept] = useState<string | null>(params.get("organ"));
  const [isolated, setIsolated] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [spin, setSpin] = useState(false);
  const [tab, setTab] = useState(params.get("organ") ? "organs" : "systems");
  // a set of meshes waiting for their systems to finish loading before they can be highlighted
  const pending = useRef<{ fjs: string[]; isolate: boolean } | null>(null);
  const [pendingTick, setPendingTick] = useState(0);

  const byFj = useMemo(() => new Map((parts.data?.parts ?? []).map((p) => [p.fj, p])), [parts.data]);

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

  /** Highlight (and optionally isolate) a set of meshes, switching on their systems first if needed. */
  const focusMeshes = (fjs: string[], iso = false) => {
    const ids = fjs.filter((id) => byFj.has(id));
    if (!ids.length) return;
    const sys = new Set(ids.map((id) => byFj.get(id)!.system));
    const missing = Array.from(sys).filter((s) => !on.has(s));
    if (missing.length) setOn((o) => new Set([...Array.from(o), ...missing]));
    pending.current = { fjs: ids, isolate: iso };
    setPendingTick((t) => t + 1);
  };
  useEffect(() => {
    const p = pending.current; if (!p || !viewer.current) return;
    const sys = new Set(p.fjs.map((id) => byFj.get(id)!.system));
    if (!Array.from(sys).every((s) => loaded.has(s))) return;
    pending.current = null;
    viewer.current.select(p.fjs, true);
    if (p.isolate) { viewer.current.isolate(p.fjs); setIsolated(true); }
    else if (isolated) { viewer.current.isolate(null); setIsolated(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pendingTick, byFj]);

  // deep links: focus=FJ1,FJ2 (from concept pages) and part=FJ
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !byFj.size) return;
    linked.current = true;
    const f = params.get("focus") || params.get("part");
    if (f) { const ids = f.split(","); setSelected(ids.find((i) => byFj.has(i)) ?? null); focusMeshes(ids); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byFj]);

  // follow hash changes made from outside the page (e.g. links clicked while the atlas is open)
  const extOrgan = params.get("organ"); const extPart = params.get("focus") || params.get("part");
  useEffect(() => {
    if (!byFj.size) return;
    if (extOrgan && extOrgan !== concept) { setConcept(extOrgan); setTab("organs"); }
    if (extPart && !extPart.split(",").includes(selected ?? "")) { const ids = extPart.split(","); setSelected(ids.find((i) => byFj.has(i)) ?? null); focusMeshes(ids); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extOrgan, extPart]);

  const select = (fj: string | null, frame = false) => {
    setSelected(fj);
    if (fj) setParams({ part: fj, focus: null });
    viewer.current?.select(fj ? [fj] : [], frame);
    if (isolated && fj) viewer.current?.isolate([fj]);
  };
  const openConcept = (fma: string) => { setConcept(fma); setTab("organs"); setSelected(null); setParams({ organ: fma, part: null }); };

  const toggleSystem = (key: string, v: boolean) => {
    const n = new Set(on); v ? n.add(key) : n.delete(key);
    setOn(n);
    setParams({ system: Array.from(n).join(",") || null, focus: null });
  };

  const visibleParts = (parts.data?.parts ?? []).filter((p) => on.has(p.system));
  const ql = q.trim().toLowerCase();
  const list = ql ? (parts.data?.parts ?? []).filter((p) => p.name.toLowerCase().includes(ql) || p.fma.toLowerCase().includes(ql) || p.fj.toLowerCase() === ql) : visibleParts;
  const busy = loading.size > 0;
  const total = parts.data?.parts.length ?? 0;
  const described = (parts.data?.parts ?? []).filter((p) => p.described).length;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="3D anatomy"
        title="Anatomy atlas"
        subtitle="Real segmented human anatomy from BodyParts3D (DBCLS), built from a full-body MRI/CT reference. Click any structure, or open an organ, to see its structure, function, clinical significance, sub-parts and linked textbook sections."
      />
      <div className="grid gap-4 xl:grid-cols-[270px_1fr_400px] lg:grid-cols-[260px_1fr]">
        {/* left: systems / organs / structure list */}
        <Card className="order-2 lg:order-1">
          <CardContent className="p-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="systems" data-testid="tab-systems">Systems</TabsTrigger>
                <TabsTrigger value="organs" data-testid="tab-organs">Organ explorer</TabsTrigger>
              </TabsList>
              <TabsContent value="systems" className="space-y-4 pt-2">
                <div className="space-y-1">
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
                  {Object.entries(failed).map(([k, m]) => <p key={k} className="mt-2 text-xs text-destructive">Could not load {k}: {m}</p>)}
                </div>
                {SYSTEMS.some((s) => on.has(s.key) && loaded.has(s.key)) && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layer opacity</div>
                    {SYSTEMS.filter((s) => on.has(s.key) && loaded.has(s.key)).map((s) => {
                      const val = Math.round((opacity[s.key] ?? (styleFor(s.key, "").opacity ?? 1)) * 100);
                      return (
                        <div key={s.key} className="mb-2">
                          <div className="mb-1 flex justify-between text-xs"><span>{s.label}</span><span className="tabular-nums text-muted-foreground">{val}%</span></div>
                          <Slider data-testid={`opacity-${s.key}`} min={5} max={100} step={5} value={[val]}
                            onValueChange={([v]) => { setOpacity((o) => ({ ...o, [s.key]: v / 100 })); viewer.current?.setGroupOpacity(s.key, v / 100); viewer.current?.select(selected ? [selected] : []); }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Find a structure…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-part-search" />
                  </div>
                  <div className="text-xs text-muted-foreground">{ql ? `${list.length.toLocaleString()} matches in all systems` : `${list.length.toLocaleString()} structures in visible systems`}</div>
                  {parts.isError ? <ErrorState error={parts.error} onRetry={() => parts.refetch()} /> : parts.isLoading ? <ListSkeleton rows={6} /> : (
                    <ScrollArea className="h-72">
                      <ul className="space-y-0.5 pr-2">
                        {list.slice(0, 500).map((p) => (
                          <li key={p.fj}>
                            <button onClick={() => { setSelected(p.fj); setParams({ part: p.fj, focus: null }); focusMeshes([p.fj]); }}
                              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover-elevate ${selected === p.fj ? "bg-primary/10 font-medium text-primary" : ""}`} data-testid={`button-part-${p.fj}`}>
                              <span>{cap(p.name)}</span>
                              {ql && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SYS[p.system]?.color }} title={SYS[p.system]?.label} />}
                            </button>
                          </li>
                        ))}
                        {list.length > 500 && <li className="px-2 py-1 text-xs text-muted-foreground">Refine the search to see more…</li>}
                      </ul>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="organs" className="pt-2">
                <OrganList current={concept} onPick={openConcept} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* viewer */}
        <div className="order-1 lg:order-2">
          <div className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-xl border bg-gradient-to-b from-muted/40 to-muted/80 lg:h-[74vh]">
            <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-atlas" onPick={(n) => select(n && byFj.has(n) ? n : null)} />
            {busy && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading 3D meshes…</Badge>
              </div>
            )}
            {selected && byFj.get(selected) && (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[70%]">
                <Badge className="pointer-events-auto text-xs" data-testid="badge-selected">{cap(byFj.get(selected)!.name)}</Badge>
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => { viewer.current?.reset(); setSelected(null); setIsolated(false); setHidden([]); setParams({ part: null, focus: null }); }} data-testid="button-reset-view"><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
              <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
              <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
              {isolated && <Button size="sm" variant="secondary" onClick={() => { setIsolated(false); viewer.current?.isolate(null); }} data-testid="button-show-all"><Eye className="mr-1 h-3.5 w-3.5" />Show all</Button>}
            </div>
            {hidden.length > 0 && (
              <div className="absolute bottom-3 right-3">
                <Button size="sm" variant="secondary" onClick={() => { setHidden([]); viewer.current?.hideMeshes([]); }} data-testid="button-unhide">Show {hidden.length} hidden</Button>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Models: <ExtLink href="https://lifesciencedb.jp/bp3d/">BodyParts3D</ExtLink>, © The Database Center for Life Science (DBCLS), CC BY-SA 2.1 Japan (adult male reference; female reproductive organs are not part of the dataset).
            {total > 0 && ` ${total.toLocaleString()} structures in ${SYSTEMS.length} systems; ${described.toLocaleString()} have a written description (own article or the article of the structure they belong to).`}
            {" "}Descriptions: Wikipedia (CC BY-SA 4.0) matched through FMA → Wikidata; identifiers from FMA, TA98 and MeSH.
          </p>
        </div>

        {/* right: detail */}
        <div className="order-3 lg:col-span-2 xl:col-span-1">
          <Card className="xl:sticky xl:top-4">
            <CardContent className="p-4">
              <ScrollArea className="xl:h-[calc(100vh-9rem)] xl:pr-3">
                {selected && byFj.has(selected) ? (
                  <PartPanel fj={selected} onClose={() => select(null)} viewer={viewer} isolated={isolated} setIsolated={setIsolated}
                    onHide={() => { const h = [...hidden, selected]; setHidden(h); viewer.current?.hideMeshes(h); select(null); }}
                    onConcept={openConcept} onHighlight={focusMeshes} />
                ) : concept ? (
                  <ConceptPanel ready={byFj.size > 0} fma={concept} onClose={() => { setConcept(null); setParams({ organ: null }); }} onPart={(fj) => { setSelected(fj); setParams({ part: fj }); focusMeshes([fj]); }} onConcept={openConcept} onHighlight={focusMeshes} />
                ) : (
                  <div className="space-y-2 text-sm text-muted-foreground" data-testid="text-no-selection">
                    <p>Click any structure in the model, pick one from the list, or open the Organ explorer to study a whole organ (for example the heart, a kidney or the eyeball) with all of its parts.</p>
                    <p>Each structure shows its anatomical description, function and clinical significance, TA98 / FMA / MeSH identifiers, what it is part of, its sub-parts, related textbook sections and figures, and practice questions.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrganList({ current, onPick }: { current: string | null; onPick: (fma: string) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const organs = useQuery<{ organs: { fma: string; name: string; nfj: number; systems: string[] }[] }>({ queryKey: [`/api/anatomy/organs${dq ? `?q=${encodeURIComponent(dq)}` : ""}`] });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Heart, kidney, eyeball, femur…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-organ-search" />
      </div>
      <p className="text-xs text-muted-foreground">Organs, regions and groups built from several 3D parts. Opening one highlights all of its parts in the model.</p>
      {organs.isError ? <ErrorState error={organs.error} onRetry={() => organs.refetch()} /> : organs.isLoading ? <ListSkeleton rows={8} /> : (
        <ScrollArea className="h-[52vh]">
          <ul className="space-y-0.5 pr-2">
            {(organs.data?.organs ?? []).map((o) => (
              <li key={o.fma}>
                <button onClick={() => onPick(o.fma)} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover-elevate ${current === o.fma ? "bg-primary/10 font-medium text-primary" : ""}`} data-testid={`button-organ-${o.fma}`}>
                  <span>{cap(o.name)}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {o.systems.slice(0, 3).map((s) => <span key={s} className="h-2 w-2 rounded-full" style={{ background: SYS[s]?.color }} />)}
                    <span className="text-[11px] tabular-nums text-muted-foreground">{o.nfj}</span>
                  </span>
                </button>
              </li>
            ))}
            {organs.data?.organs.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No organ matches.</li>}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function Ids({ ta98, fma, qid, mesh, uberon, links }: { ta98?: string[]; fma: string; qid?: string | null; mesh?: PartDetail["mesh"]; uberon?: string | null; links?: PartDetail["links"] }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
      <span className="text-muted-foreground">FMA</span>
      <ExtLink href={links?.fma ?? `https://www.ebi.ac.uk/ols4/ontologies/fma/classes?obo_id=FMA:${fma.replace("FMA", "")}`}>{fma}</ExtLink>
      {ta98 && ta98.length > 0 && (<><span className="text-muted-foreground">TA98</span><span className="font-mono">{ta98.join(", ")}</span></>)}
      {mesh && (<><span className="text-muted-foreground">MeSH</span><span><Link href={`/concept/${mesh.id}`} className="text-primary hover:underline" data-testid="link-part-mesh">{mesh.name}</Link>{!mesh.exact && <span className="text-muted-foreground"> (broader heading)</span>}</span></>)}
      {uberon && (<><span className="text-muted-foreground">UBERON</span><span className="font-mono">{uberon}</span></>)}
      {qid && (<><span className="text-muted-foreground">Wikidata</span><ExtLink href={`https://www.wikidata.org/wiki/${qid}`}>{qid}</ExtLink></>)}
    </div>
  );
}

function RelList({ title, items, onPick, testId }: { title: string; items: Rel[]; onPick: (fma: string) => void; testId: string }) {
  const [all, setAll] = useState(false);
  if (!items?.length) return null;
  const shown = all ? items : items.slice(0, 12);
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title} <span className="font-normal">({items.length})</span></div>
      <div className="flex flex-wrap gap-1">
        {shown.map((r) => (
          <button key={r.fma} onClick={() => onPick(r.fma)} className="rounded-md border px-2 py-0.5 text-xs hover-elevate" data-testid={`${testId}-${r.fma}`}>
            {cap(r.name)}{r.nfj ? <span className="ml-1 text-muted-foreground">· {r.nfj}</span> : null}
          </button>
        ))}
        {items.length > 12 && <button className="px-1 text-xs text-primary hover:underline" onClick={() => setAll(!all)}>{all ? "fewer" : `+${items.length - 12} more`}</button>}
      </div>
    </div>
  );
}

function PartPanel({ fj, onClose, viewer, isolated, setIsolated, onHide, onConcept, onHighlight }: {
  fj: string; onClose: () => void; viewer: React.RefObject<ViewerHandle>; isolated: boolean; setIsolated: (v: boolean) => void; onHide: () => void;
  onConcept: (fma: string) => void; onHighlight: (fjs: string[], iso?: boolean) => void;
}) {
  const d = useQuery<PartDetail>({ queryKey: [`/api/anatomy/part/${fj}`] });
  const { user } = useApp();
  const [edit, setEdit] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const practice = useMutation({
    mutationFn: () => apiJson<{ session: { id: number } }>("POST", "/api/quiz/build", { conceptId: d.data!.mesh!.id, mode: "tutor", count: Math.min(20, d.data!.questionCount) }),
    onSuccess: (r) => navigate(`/quiz/${r.session.id}`),
    onError: (e: Error) => toast({ title: "Could not start practice", description: e.message, variant: "destructive" }),
  });
  if (d.isLoading) return <ListSkeleton rows={8} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const p = d.data;
  const article = p.article;
  return (
    <div className="space-y-4" data-testid="panel-selected">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SYS[p.system]?.color }} />{SYS[p.system]?.label}
            {p.side && <Badge variant="outline" className="text-[10px] normal-case">{p.side} side</Badge>}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug" data-testid="text-selected-name">{cap(p.name)}</h3>
          {p.kind && p.kind.toLowerCase() !== p.name.toLowerCase() && <div className="text-xs text-muted-foreground">Type: {p.kind}</div>}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Clear selection" data-testid="button-clear-selection"><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => viewer.current?.select([fj], true)} data-testid="button-focus"><Focus className="mr-1 h-3.5 w-3.5" />Zoom to</Button>
        <Button size="sm" variant={isolated ? "default" : "outline"} data-testid="button-isolate" onClick={() => { const n = !isolated; setIsolated(n); viewer.current?.isolate(n ? [fj] : null); }}>
          {isolated ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}{isolated ? "Show all" : "Isolate"}
        </Button>
        <Button size="sm" variant="outline" data-testid="button-hide" onClick={onHide}>Hide</Button>
        {p.generic && p.generic.nfj > 1 && (
          <Button size="sm" variant="outline" onClick={() => onHighlight(p.generic!.fjs)} data-testid="button-highlight-both"><Layers className="mr-1 h-3.5 w-3.5" />Both sides</Button>
        )}
        <BookmarkButton type="anatomy" refId={fj} title={p.name} />
      </div>

      {p.override && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="text-override">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Editor's note</div>
          <ArticleText text={p.override.description} />
        </div>
      )}

      {article ? (
        <WikiArticleView a={article} compact testId="part-article" />
      ) : p.contextArticle ? (
        <div className="space-y-2">
          <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground" data-testid="text-context-note">
            No dedicated article exists for this exact structure. Showing the description of the structure it belongs to:{" "}
            <button className="font-medium text-primary hover:underline" onClick={() => onConcept(p.contextArticle!.viaFma)} data-testid="button-context-concept">{cap(p.contextArticle.viaName || p.contextArticle.title)}</button>.
          </div>
          <WikiArticleView a={p.contextArticle} compact testId="part-article" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No written description is available for this structure yet. Its identifiers and hierarchy are listed below.</p>
      )}

      <Ids ta98={p.ta98} fma={p.fma} qid={p.qid} mesh={p.mesh} uberon={p.generic?.uberon} links={p.links} />
      {p.mesh?.scope_note && (
        <div className="text-sm"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">MeSH definition</div><p className="leading-relaxed">{p.mesh.scope_note}</p></div>
      )}

      <RelList title="Part of" items={p.partOf} onPick={onConcept} testId="button-partof" />
      <RelList title="Sub-parts" items={p.children} onPick={onConcept} testId="button-child" />
      <RelList title="Is a type of" items={p.isa} onPick={onConcept} testId="button-isa" />
      <RelList title="Subtypes" items={p.subtypes} onPick={onConcept} testId="button-subtype" />

      {p.questionCount > 0 && p.mesh && (
        <Button className="w-full" onClick={() => practice.mutate()} disabled={practice.isPending} data-testid="button-practice-part">
          <ListChecks className="mr-1.5 h-4 w-4" />Practice {Math.min(20, p.questionCount)} questions on {p.mesh.name}
        </Button>
      )}

      {p.sections.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />Textbook sections</div>
          <ul className="space-y-1.5">
            {p.sections.map((s) => (
              <li key={s.id} className="text-sm">
                <Link href={`/books/${s.book}/${s.id}`} className="font-medium text-primary hover:underline" data-testid={`link-part-section-${s.id}`}>{s.title}</Link>
                <div className="text-xs text-muted-foreground">{s.chapter}</div>
                <div className="text-xs text-muted-foreground [&_mark]:bg-yellow-200/60 dark:[&_mark]:bg-yellow-500/30" dangerouslySetInnerHTML={{ __html: s.snip }} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.figures.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" />Figures</div>
          <div className="grid grid-cols-3 gap-1.5">
            {p.figures.map((f) => (
              <Link key={f.id} href={`/figures/${f.id}`} className="group block overflow-hidden rounded-md border bg-white" data-testid={`link-part-figure-${f.id}`} title={f.title}>
                <img src={f.src} alt={f.title} loading="lazy" className="aspect-square w-full object-contain transition group-hover:scale-105" />
              </Link>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Figures: OpenStax Anatomy and Physiology 2e, CC BY 4.0 / CC BY-NC-SA 4.0.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
        <ReportButton type="anatomy" refId={fj} title={p.name} />
        {user?.role === "admin" && <Button size="sm" variant="ghost" onClick={() => setEdit(true)} data-testid="button-edit-anatomy"><Pencil className="h-4 w-4" />Edit description</Button>}
      </div>
      {edit && <OverrideDialog fj={fj} name={p.name} initial={p.override?.description ?? ""} onClose={() => setEdit(false)} />}
    </div>
  );
}

function OverrideDialog({ fj, name, initial, onClose }: { fj: string; name: string; initial: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const { toast } = useToast();
  const m = useMutation({
    mutationFn: () => apiJson("PUT", `/api/admin/anatomy/${fj}`, { description: text }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/anatomy/part/${fj}`] }); toast({ title: text.trim() ? "Description saved" : "Editor's note removed" }); onClose(); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editor's note: {cap(name)}</DialogTitle>
          <DialogDescription>Shown above the imported article for every learner. Cite your reference. Leave empty to remove the note.</DialogDescription>
        </DialogHeader>
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} data-testid="input-anatomy-override" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending} data-testid="button-save-anatomy">{m.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConceptPanel({ fma, ready, onClose, onPart, onConcept, onHighlight }: { fma: string; ready: boolean; onClose: () => void; onPart: (fj: string) => void; onConcept: (fma: string) => void; onHighlight: (fjs: string[], iso?: boolean) => void }) {
  const c = useQuery<Concept>({ queryKey: [`/api/anatomy/concept/${fma}`] });
  const parts = useQuery<{ parts: Part[] }>({ queryKey: ["/api/anatomy/parts"] });
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (ready && c.data && shown.current !== fma && c.data.fjs.length) { shown.current = fma; onHighlight(c.data.fjs, c.data.fjs.length > 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.data, fma, ready]);
  if (c.isLoading) return <ListSkeleton rows={8} />;
  if (c.isError || !c.data) return <ErrorState error={c.error} onRetry={() => c.refetch()} />;
  const g = c.data;
  const byFj = new Map((parts.data?.parts ?? []).map((p) => [p.fj, p]));
  const meshes = g.fjs.map((f) => byFj.get(f)).filter(Boolean) as Part[];
  const ta98 = g.ta98 ? (JSON.parse(g.ta98) as string[]) : [];
  return (
    <div className="space-y-4" data-testid="panel-concept">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            {g.systems.map((s) => <span key={s} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SYS[s]?.color }} />{SYS[s]?.label}</span>)}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug" data-testid="text-concept-name">{cap(g.name)}</h3>
          <div className="text-xs text-muted-foreground">{g.nfj} 3D part{g.nfj === 1 ? "" : "s"} highlighted</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close organ" data-testid="button-close-concept"><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => onHighlight(g.fjs, true)} data-testid="button-isolate-concept"><EyeOff className="mr-1 h-3.5 w-3.5" />Isolate organ</Button>
        <Button size="sm" variant="outline" onClick={() => onHighlight(g.fjs, false)} data-testid="button-in-context"><Eye className="mr-1 h-3.5 w-3.5" />In context</Button>
      </div>
      {g.article ? <WikiArticleView a={g.article} compact testId="concept-article" /> : <p className="text-sm text-muted-foreground">No written description is linked to this grouping.</p>}
      <Ids ta98={ta98} fma={g.fma} mesh={g.mesh_id ? { id: g.mesh_id, name: g.mesh_id, scope_note: null, exact: true } : null} />
      <RelList title="Part of" items={g.part_parents} onPick={onConcept} testId="button-cpartof" />
      <RelList title="Sub-parts" items={g.part_children} onPick={onConcept} testId="button-cchild" />
      <RelList title="Is a type of" items={g.isa_parents} onPick={onConcept} testId="button-cisa" />
      <RelList title="Subtypes" items={g.isa_children} onPick={onConcept} testId="button-csub" />
      {meshes.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">3D parts ({meshes.length})</div>
          <ul className="max-h-64 space-y-0.5 overflow-auto pr-1">
            {meshes.map((m) => (
              <li key={m.fj}>
                <button onClick={() => onPart(m.fj)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover-elevate" data-testid={`button-concept-part-${m.fj}`}>
                  <span>{cap(m.name)}</span>
                  {!m.described && <span className="text-[10px] text-muted-foreground">ids only</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
