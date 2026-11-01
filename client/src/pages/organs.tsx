import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Box, CheckCircle2, Eye, EyeOff, Focus, GraduationCap, Layers, Loader2, Maximize2, RefreshCw, RotateCcw, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, BookmarkButton, EmptyState, AddCardButton } from "@/components/common";
import { ArticleText } from "@/components/wiki-article";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { assetUrl } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";

type OrganRow = { id: string; label: string; base: string; sex: string; system: string; uberon: string; file: string; bytes: number; nstruct: number; dims_mm: number[]; blurb: string | null };
type Structure = { node: string; label: string; uberon: string | null; color: string; definition: string | null; synonyms: string[]; wiki_title: string | null; wiki: string | null; wiki_url: string | null; mesh_id: string | null; mesh_name: string | null; fma: string | null; qid: string | null; atlas_name: string | null };
type OrganDetail = {
  organ: OrganRow & { definition: string | null; wiki: string | null; wiki_title: string | null; wiki_url: string | null; mesh_id: string | null; fma: string | null; qid: string | null; version: string; source_url: string; glb_url: string; creators: string[]; creation_date: string | null; faces_src: number };
  structures: Structure[]; mesh: { id: string; name: string; note: string | null } | null; questions: number; variants: { id: string; label: string; sex: string }[];
  source: { source: string; url: string; license: string; data: string; definitions: string } | null;
};

const SYSTEM_LABEL: Record<string, string> = {
  cardiovascular: "Cardiovascular", respiratory: "Respiratory", digestive: "Digestive", urinary: "Urinary", nervous: "Nervous",
  sensory: "Special senses", lymphatic: "Lymphatic & immune", reproductive: "Reproductive", integumentary: "Integumentary", skeletal: "Skeletal", other: "Other",
};
const SYSTEM_COLOR: Record<string, string> = {
  cardiovascular: "bg-red-500", respiratory: "bg-sky-500", digestive: "bg-amber-500", urinary: "bg-yellow-500", nervous: "bg-violet-500",
  sensory: "bg-indigo-500", lymphatic: "bg-emerald-500", reproductive: "bg-pink-500", integumentary: "bg-orange-400", skeletal: "bg-stone-400", other: "bg-slate-400",
};
const uberonUrl = (u: string) => `https://www.ebi.ac.uk/ols4/ontologies/uberon/classes/${encodeURIComponent(encodeURIComponent(`http://purl.obolibrary.org/obo/${u.replace(":", "_")}`))}`;
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function OrgansPage() {
  const [params, setParams] = useHashQuery();
  const r = useQuery<{ organs: OrganRow[]; source: OrganDetail["source"] }>({ queryKey: ["/api/organs"] });
  const sys = params.get("system") || "";
  const [q, setQ] = useState(params.get("q") || "");
  const organs = r.data?.organs ?? [];
  const systems = useMemo(() => Array.from(new Set(organs.map((o) => o.system))), [organs]);
  const shown = organs.filter((o) => (!sys || o.system === sys) && (!q || o.label.toLowerCase().includes(q.toLowerCase()) || (o.blurb ?? "").toLowerCase().includes(q.toLowerCase())));
  const totalStructures = organs.reduce((a, o) => a + o.nstruct, 0);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="3D anatomy" title="3D organ library"
        subtitle={<>Every organ in the Human Reference Atlas as an interactive 3D model, segmented from the Visible Human datasets of the U.S. National Library of Medicine. Each named part of an organ can be selected, isolated and studied, with its ontology definition and textbook-style description.{organs.length > 0 && <> {organs.length} organ models, {totalStructures.toLocaleString()} labelled structures.</>}</>}
        actions={<Link href="/atlas"><Button variant="outline" size="sm" data-testid="link-whole-body-atlas"><Box className="mr-1.5 h-4 w-4" />Whole-body atlas</Button></Link>} />
      {r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setParams({ q: e.target.value || null }); }} placeholder="Find an organ" className="pl-8" data-testid="input-organ-search" />
            </div>
            <Button size="sm" variant={!sys ? "default" : "outline"} onClick={() => setParams({ system: null })} data-testid="button-system-all">All systems</Button>
            {systems.map((s) => (
              <Button key={s} size="sm" variant={sys === s ? "default" : "outline"} onClick={() => setParams({ system: s })} data-testid={`button-system-${s}`}>
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${SYSTEM_COLOR[s] ?? "bg-slate-400"}`} />{SYSTEM_LABEL[s] ?? cap(s)}
              </Button>
            ))}
          </div>
          {r.isLoading ? <ListSkeleton rows={6} /> : shown.length === 0 ? <EmptyState title="No organs match">Try a different name or system.</EmptyState> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((o) => (
                <Link key={o.id} href={`/organs/${o.id}`} data-testid={`card-organ-${o.id}`}>
                  <Card className="h-full cursor-pointer hover-elevate">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold leading-tight">{o.label}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={`inline-block h-2 w-2 rounded-full ${SYSTEM_COLOR[o.system] ?? "bg-slate-400"}`} />{SYSTEM_LABEL[o.system] ?? o.system}
                            <span>·</span><span>{o.sex}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{o.nstruct} parts</Badge>
                      </div>
                      {o.blurb && <p className="line-clamp-3 text-sm text-muted-foreground">{o.blurb}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {r.data?.source && (
            <p className="text-xs text-muted-foreground">
              Models: <ExtLink href={r.data.source.url}>{r.data.source.source}</ExtLink>, {r.data.source.license}; derived from {r.data.source.data}. Definitions: {r.data.source.definitions}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function OrganPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useHashQuery();
  const r = useQuery<OrganDetail>({ queryKey: [`/api/organs/${id}`] });
  const viewer = useRef<ViewerHandle>(null);
  const loadedKey = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const [xray, setXray] = useState(false);
  const [isolated, setIsolated] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState(params.get("part") ? "structures" : "overview");
  const sel = params.get("part");
  const d = r.data;
  const byNode = useMemo(() => new Map((d?.structures ?? []).map((s) => [s.node, s])), [d]);
  const cur = sel ? byNode.get(sel) ?? null : null;

  // quiz ("identify the highlighted structure")
  const [quiz, setQuiz] = useState<{ target: Structure; options: Structure[]; picked: string | null } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  useEffect(() => {
    if (!d || !viewer.current || loadedKey.current === d.organ.id) return;
    const v = viewer.current;
    if (loadedKey.current) v.unload(loadedKey.current);
    loadedKey.current = d.organ.id;
    setLoading(true); setErr(null); setIsolated(false); setXray(false); setQuiz(null);
    const colors = new Map(d.structures.map((s) => [s.node, s.color]));
    v.load(d.organ.id, assetUrl(`/models/organs/${d.organ.file}`), (name) => ({ color: colors.get(name) ?? "#c9a28b", opacity: 1 }))
      .then(() => { v.frameAll(); if (sel && byNode.has(sel)) v.select([sel], true); })
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.organ.id]);

  // keep the viewer selection in sync with the URL
  useEffect(() => {
    if (!viewer.current || loading || !d || quiz) return;
    viewer.current.select(sel && byNode.has(sel) ? [sel] : [], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, loading, d]);

  const choose = (node: string | null, frame = false) => {
    if (quiz) return;
    setParams({ part: node });
    if (node) { setTab("structures"); viewer.current?.select([node], frame); if (isolated) viewer.current?.isolate([node]); }
    else viewer.current?.select([], false);
  };

  const newQuestion = () => {
    if (!d) return;
    // only structures with distinct labels can be asked fairly
    const pool = Array.from(new Map(d.structures.map((s) => [s.label.toLowerCase(), s])).values());
    if (pool.length < 4) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const others = pool.filter((s) => s.label.toLowerCase() !== target.label.toLowerCase()).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [target, ...others].sort(() => Math.random() - 0.5);
    setQuiz({ target, options, picked: null });
    setParams({ part: null });
    viewer.current?.isolate(null); setIsolated(false);
    viewer.current?.select([target.node], true);
  };
  const answer = (node: string) => {
    if (!quiz || quiz.picked) return;
    const ok = byNode.get(node)?.label.toLowerCase() === quiz.target.label.toLowerCase();
    setQuiz({ ...quiz, picked: node });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };
  const endQuiz = () => { setQuiz(null); viewer.current?.select([], false); viewer.current?.frameAll(); };

  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const o = d?.organ;
  const list = (d?.structures ?? []).filter((s) => !filter || s.label.toLowerCase().includes(filter.toLowerCase()) || s.synonyms.some((x) => x.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={<Link href="/organs" className="hover:underline" data-testid="link-organ-library">3D organ library</Link>}
        title={o ? o.label : "Loading…"}
        subtitle={o ? <>{SYSTEM_LABEL[o.system] ?? o.system} system · {o.sex} reference organ · {o.nstruct} labelled structures · real size about {o.dims_mm.map((x) => Math.round(x)).join(" × ")} mm</> : undefined}
        actions={o && (
          <div className="flex flex-wrap gap-1.5">
            {d!.variants.length > 1 && d!.variants.map((v) => (
              <Link key={v.id} href={`/organs/${v.id}`}><Button size="sm" variant={v.id === o.id ? "default" : "outline"} data-testid={`button-variant-${v.sex.toLowerCase()}`}>{v.sex}</Button></Link>
            ))}
            <BookmarkButton type="organ" refId={o.id} title={o.label} />
          </div>
        )} />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-xl border bg-gradient-to-b from-slate-900 to-slate-950">
            <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-organ" onPick={(n) => { if (quiz) { if (n) answer(n); return; } choose(n && byNode.has(n) ? n : null); }} />
            {(loading || r.isLoading) && <div className="absolute inset-x-0 top-3 flex justify-center"><Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading 3D model…</Badge></div>}
            {err && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-200">Could not load this model: {err}</div>}
            {cur && !quiz && (
              <div className="absolute left-3 top-3 max-w-[70%] rounded-md bg-black/60 px-2.5 py-1.5 text-sm font-medium text-white" data-testid="text-viewer-label">{cap(cur.label)}</div>
            )}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
              <Button size="sm" variant="secondary" onClick={() => { viewer.current?.reset(); viewer.current?.frameAll(); setIsolated(false); setXray(false); viewer.current?.setGroupOpacity(o?.id ?? "", 1); setParams({ part: null }); }} data-testid="button-reset"><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>
              <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
              <Button size="sm" variant={xray ? "default" : "secondary"} disabled={!o} onClick={() => { const n = !xray; setXray(n); viewer.current?.setGroupOpacity(o!.id, n ? 0.28 : 1); }} data-testid="button-xray"><Layers className="mr-1 h-3.5 w-3.5" />See-through</Button>
              {cur && !quiz && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => viewer.current?.select([cur.node], true)} data-testid="button-zoom-part"><Focus className="mr-1 h-3.5 w-3.5" />Zoom to</Button>
                  <Button size="sm" variant={isolated ? "default" : "secondary"} onClick={() => { const n = !isolated; setIsolated(n); viewer.current?.isolate(n ? [cur.node] : null); }} data-testid="button-isolate-part">
                    {isolated ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}{isolated ? "Show all" : "Isolate"}
                  </Button>
                </>
              )}
            </div>
            <div className="absolute bottom-3 right-3 hidden rounded bg-black/50 px-2 py-1 text-[11px] text-white/80 sm:block">Drag to rotate · scroll to zoom · click a part</div>
          </div>

          {quiz && (
            <Card data-testid="card-organ-quiz">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Identify the highlighted structure</div>
                  <Badge variant="outline" data-testid="text-quiz-score">{score.right} / {score.total} correct</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {quiz.options.map((s) => {
                    const right = s.label.toLowerCase() === quiz.target.label.toLowerCase();
                    const state = !quiz.picked ? "" : right ? "border-emerald-500 bg-emerald-500/10" : quiz.picked === s.node ? "border-red-500 bg-red-500/10" : "opacity-60";
                    return (
                      <button key={s.node} onClick={() => answer(s.node)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover-elevate ${state}`} data-testid={`button-quiz-option-${s.node}`}>
                        {quiz.picked && right && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                        {quiz.picked === s.node && !right && <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
                        {cap(s.label)}
                      </button>
                    );
                  })}
                </div>
                {quiz.picked && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="text-quiz-explanation">
                    <div className="font-medium">{cap(quiz.target.label)}</div>
                    <p className="mt-1 text-muted-foreground">{quiz.target.definition ?? (quiz.target.wiki ? quiz.target.wiki.split("\n")[0].slice(0, 400) : "No definition recorded for this structure.")}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={newQuestion} disabled={!quiz.picked} data-testid="button-quiz-next">Next structure</Button>
                  <Button size="sm" variant="outline" onClick={endQuiz} data-testid="button-quiz-end">End practice</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:max-h-[calc(58vh+0px)] lg:min-h-[380px] lg:overflow-hidden">
          {r.isLoading || !d ? <CardContent className="p-4"><ListSkeleton rows={8} /></CardContent> : (
            <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
              <CardHeader className="pb-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="structures" data-testid="tab-structures">Structures ({d.structures.length})</TabsTrigger>
                </TabsList>
              </CardHeader>
              <TabsContent value="overview" className="mt-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                {o!.definition && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">Definition (UBERON {o!.uberon})</div>
                    <p className="mt-1">{o!.definition}</p>
                  </div>
                )}
                {o!.wiki && <ArticleText text={o!.wiki} max={1400} />}
                {o!.wiki_url && <p className="text-[11px] text-muted-foreground">Text from the Wikipedia article <ExtLink href={o!.wiki_url}>{o!.wiki_title}</ExtLink>, CC BY-SA 4.0. Verify clinical facts against your course textbook.</p>}
                <div className="flex flex-wrap gap-2">
                  {d.mesh && <Link href={`/concept/${d.mesh.id}`}><Button size="sm" variant="outline" data-testid="link-organ-mesh">MeSH: {d.mesh.name}</Button></Link>}
                  {d.mesh && d.questions > 0 && <Link href={`/qbank?concept=${d.mesh.id}`}><Button size="sm" variant="outline" data-testid="link-organ-questions"><GraduationCap className="mr-1 h-3.5 w-3.5" />{d.questions} questions</Button></Link>}
                  {o!.fma && <Link href={`/atlas?organ=${o!.fma}`}><Button size="sm" variant="outline" data-testid="link-organ-atlas"><Box className="mr-1 h-3.5 w-3.5" />In whole-body atlas</Button></Link>}
                  <Button size="sm" onClick={newQuestion} disabled={d.structures.length < 4 || !!quiz} data-testid="button-quiz-start"><GraduationCap className="mr-1 h-3.5 w-3.5" />Test me on this organ</Button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Model: <ExtLink href={o!.source_url}>Human Reference Atlas, {o!.label} ({o!.sex}) {o!.version}</ExtLink>{o!.creators.length > 0 ? ` by ${o!.creators.join(", ")}` : ""}, CC BY 4.0, HuBMAP / NIH Common Fund, derived from the Visible Human Project (U.S. National Library of Medicine).
                  Simplified from {o!.faces_src.toLocaleString()} triangles for the web; colors are for distinguishing parts and are not natural tissue colors.
                </p>
              </TabsContent>
              <TabsContent value="structures" className="mt-0 flex min-h-0 flex-1 flex-col px-4 pb-4">
                {cur ? (
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto" data-testid="panel-structure">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold" data-testid="text-structure-name">{cap(cur.label)}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {cur.uberon && <Badge variant="outline">{cur.uberon}</Badge>}
                          {cur.fma && <Badge variant="outline">{cur.fma}</Badge>}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => choose(null)} data-testid="button-structure-close">All parts</Button>
                    </div>
                    {cur.definition && <div className="rounded-lg border bg-muted/40 p-3 text-sm"><div className="text-xs font-medium text-muted-foreground">Definition (UBERON)</div><p className="mt-1">{cur.definition}</p></div>}
                    {cur.synonyms.length > 0 && <p className="text-xs text-muted-foreground">Also called: {cur.synonyms.join("; ")}</p>}
                    {cur.wiki && <ArticleText text={cur.wiki} max={1200} />}
                    {cur.wiki_url && <p className="text-[11px] text-muted-foreground">Text from the Wikipedia article <ExtLink href={cur.wiki_url}>{cur.wiki_title}</ExtLink>, CC BY-SA 4.0.</p>}
                    {!cur.definition && !cur.wiki && <p className="text-sm text-muted-foreground">No curated definition is recorded for this structure yet. See the organ overview for context.</p>}
                    <div className="flex flex-wrap gap-2">
                      {cur.mesh_id && <Link href={`/concept/${cur.mesh_id}`}><Button size="sm" variant="outline" data-testid="link-structure-mesh">MeSH: {cur.mesh_name}</Button></Link>}
                      {cur.fma && <Link href={`/atlas?organ=${cur.fma}`}><Button size="sm" variant="outline" data-testid="link-structure-atlas"><Box className="mr-1 h-3.5 w-3.5" />Whole-body atlas</Button></Link>}
                      {cur.uberon && <ExtLink href={uberonUrl(cur.uberon)} testId="link-structure-uberon">UBERON entry</ExtLink>}
                      <AddCardButton front={`${o!.label}: identify / describe the ${cur.label}`} back={cur.definition ?? (cur.wiki ?? "").split("\n")[0].slice(0, 500)} deck={`3D organs: ${o!.label}`} sourceType="organ" sourceId={`${o!.id}#${cur.node}`} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter structures" className="pl-8" data-testid="input-structure-filter" />
                    </div>
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                      {list.map((s) => (
                        <button key={s.node} onClick={() => choose(s.node, true)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover-elevate" data-testid={`button-structure-${s.node}`}>
                          <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                          <span className="min-w-0 flex-1 truncate">{cap(s.label)}</span>
                          {(s.definition || s.wiki) && <span className="text-[10px] text-muted-foreground">info</span>}
                        </button>
                      ))}
                      {list.length === 0 && <p className="p-2 text-sm text-muted-foreground">No structures match.</p>}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  );
}
