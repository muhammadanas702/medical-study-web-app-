import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bug, ExternalLink, GraduationCap, Loader2, Maximize2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, BookmarkButton, EmptyState, AddCardButton } from "@/components/common";
import { ArticleText } from "@/components/wiki-article";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { PdbViewer } from "@/components/pdb-viewer";
import { buildMorph, type MorphPart } from "@/lib/morph3d";
import { assetUrl } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";

type Row = { id: string; name: string; kind: string; grp: string | null; family: string | null; mesh_id: string | null; nih3d: string[]; question_count: number; structure: string | null };
type Facts = { structure?: string; genome?: string; transmission?: string; diseases?: string[]; virulence?: string[]; diagnosis?: string; treatment?: string; prevention?: string; pearls?: string[] };
type Pdb = { id: string; desc: string; title: string; organisms: string[]; method: string | null; resolution: number | null; year: string };
type Model3D = { id: string; title: string; description: string | null; license: string; file: string; bytes: number; source_url: string };
type Detail = {
  pathogen: { id: string; name: string; kind: string; group: string | null; family: string | null; facts: Facts; pdb: Pdb[]; wiki_title: string | null; wiki: string | null; wiki_url: string | null };
  models: Model3D[]; mesh: { id: string; name: string; note: string | null } | null; questions: number;
};

const KINDS = ["Virus", "Bacterium", "Fungus", "Parasite"];
const KIND_LABEL: Record<string, string> = { Virus: "Viruses", Bacterium: "Bacteria", Fungus: "Fungi", Parasite: "Parasites" };
const KIND_DOT: Record<string, string> = { Virus: "bg-rose-500", Bacterium: "bg-violet-500", Fungus: "bg-amber-500", Parasite: "bg-teal-500" };

export function PathogensPage() {
  const [params, setParams] = useHashQuery();
  const [, navigate] = useLocation();
  const r = useQuery<{ pathogens: Row[] }>({ queryKey: ["/api/pathogens"] });
  const kind = params.get("kind") || "";
  const [q, setQ] = useState(params.get("q") || "");
  const rows = r.data?.pathogens ?? [];
  // old links: /pathogens?id=3DPX-xxxxxx -> pathogen that owns the model
  const legacy = params.get("id");
  useEffect(() => {
    if (!legacy || !rows.length) return;
    const p = rows.find((x) => x.nih3d.includes(legacy));
    if (p) navigate(`/pathogens/${p.id}`, { replace: true });
  }, [legacy, rows, navigate]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((x) => (!kind || x.kind === kind) && (!t || `${x.name} ${x.grp} ${x.family} ${x.structure}`.toLowerCase().includes(t)));
  }, [rows, kind, q]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, rows.filter((x) => x.kind === k).length])), [rows]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Microbiology" title="Pathogen library"
        subtitle="Colored 3D models of viruses, bacteria, fungi and parasites with high-yield fact sheets: structure, genome, transmission, diseases, virulence factors, diagnosis, treatment and prevention, plus real protein structures from the Protein Data Bank." />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={!kind ? "default" : "outline"} onClick={() => setParams({ kind: null })} data-testid="button-kind-all">All ({rows.length})</Button>
        {KINDS.map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setParams({ kind: k })} data-testid={`button-kind-${k.toLowerCase()}`}>
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${KIND_DOT[k]}`} />{KIND_LABEL[k]} ({counts[k] ?? 0})
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setParams({ q: e.target.value || null }); }} placeholder="Search pathogens" className="pl-8" data-testid="input-pathogen-search" />
        </div>
      </div>
      {r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.isLoading ? <ListSkeleton rows={8} /> : !shown.length ? (
        <EmptyState title="No pathogens match" icon={<Bug className="h-6 w-6" />}>Try another name or clear the filter.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((x) => (
            <Link key={x.id} href={`/pathogens/${x.id}`} data-testid={`link-pathogen-${x.id}`}>
              <Card className="h-full cursor-pointer hover-elevate">
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold leading-tight">{x.name}</div>
                    <Badge variant="outline" className="shrink-0 gap-1"><span className={`h-2 w-2 rounded-full ${KIND_DOT[x.kind]}`} />{x.kind}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{x.grp}{x.family ? ` · ${x.family}` : ""}</div>
                  {x.structure && <p className="line-clamp-2 text-sm text-muted-foreground">{x.structure}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary">{x.nih3d.length ? `NIH 3D model${x.nih3d.length > 1 ? "s" : ""}` : "Schematic 3D"}</Badge>
                    {x.question_count > 0 && <Badge variant="secondary">{x.question_count} questions</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Sources: fact sheets curated from standard microbiology references and checked against CDC and WHO guidance; scanned/structural 3D models from <ExtLink href="https://3d.nih.gov">NIH 3D</ExtLink>; protein structures from the <ExtLink href="https://www.rcsb.org">RCSB Protein Data Bank</ExtLink>; summaries from Wikipedia (CC BY-SA 4.0). Schematic models are illustrative and not to scale. Always confirm treatment choices against current local guidelines.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
const List = ({ items }: { items?: string[] }) => !items?.length ? null : <ul className="list-disc space-y-1 pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

export function PathogenPage() {
  const { id } = useParams<{ id: string }>();
  const r = useQuery<Detail>({ queryKey: [`/api/pathogens/${id}`] });
  const viewer = useRef<ViewerHandle>(null);
  const d = r.data; const p = d?.pathogen;
  const views = useMemo(() => {
    if (!d) return [] as { key: string; label: string }[];
    const v = d.models.map((m) => ({ key: m.id, label: m.title }));
    if (!v.length || buildMorph(d.pathogen.id)) v.push({ key: "schematic", label: "Schematic morphology" });
    return v;
  }, [d]);
  const [view, setView] = useState<string | null>(null);
  const cur = view && views.some((v) => v.key === view) ? view : views[0]?.key;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [spin, setSpin] = useState(true);
  const [parts, setParts] = useState<MorphPart[]>([]);
  const [caption, setCaption] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [pdb, setPdb] = useState<string | null>(null);
  const shown = useRef<string | null>(null);

  useEffect(() => { setView(null); setSel(null); setPdb(null); }, [id]);
  useEffect(() => {
    const v = viewer.current; if (!v || !d || !cur) return;
    const key = `${d.pathogen.id}:${cur}`;
    if (shown.current === key) return;
    if (shown.current) v.unload(shown.current);
    shown.current = key; setErr(null); setSel(null);
    if (cur === "schematic") {
      const m = buildMorph(d.pathogen.id);
      if (m) { v.add(key, m.group); setParts(m.parts); setCaption(m.caption); v.setAutoRotate(spin); }
      return;
    }
    setParts([]); setCaption("");
    const m = d.models.find((x) => x.id === cur)!;
    setLoading(true);
    v.load(key, assetUrl(`/models/pathogens/${m.file}`), null).then(() => v.setAutoRotate(spin)).catch((e) => setErr(String(e?.message ?? e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, cur]);

  const choose = (name: string | null) => { setSel(name); viewer.current?.select(name ? [name] : [], false); };
  const model = d?.models.find((x) => x.id === cur);
  const activePdb = pdb ?? p?.pdb[0]?.id ?? null;
  const f = p?.facts ?? {};
  const selPart = parts.find((x) => x.name === sel);

  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  return (
    <div className="space-y-4">
      <div className="text-sm"><Link href="/pathogens" className="text-primary hover:underline" data-testid="link-back-pathogens">Pathogen library</Link>{p && <span className="text-muted-foreground"> / {p.kind}</span>}</div>
      {!p ? <ListSkeleton rows={6} /> : (
        <>
          <PageHeader eyebrow={`${p.kind}${p.group ? ` · ${p.group}` : ""}`} title={p.name} subtitle={p.family ?? undefined}
            actions={<div className="flex flex-wrap gap-2">
              {d!.mesh && d!.questions > 0 && <Link href={`/qbank?concept=${d!.mesh.id}`}><Button size="sm" variant="outline" data-testid="link-pathogen-questions"><GraduationCap className="mr-1 h-3.5 w-3.5" />{d!.questions} questions</Button></Link>}
              <AddCardButton front={`${p.name}: key features?`} back={[f.structure, f.diseases?.[0], f.treatment].filter(Boolean).join("\n\n")} deck="Microbiology" sourceType="pathogen" sourceId={p.id} />
              <BookmarkButton type="pathogen" refId={p.id} title={p.name} />
            </div>} />
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-2">
              {views.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {views.map((v) => <Button key={v.key} size="sm" variant={cur === v.key ? "default" : "outline"} onClick={() => setView(v.key)} data-testid={`button-view-${v.key}`}>{v.label}</Button>)}
                </div>
              )}
              <div className="relative h-[54vh] min-h-[360px] overflow-hidden rounded-xl border bg-gradient-to-b from-slate-900 to-slate-950">
                <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-pathogen" onPick={(n) => cur === "schematic" && choose(n)} />
                {loading && <div className="absolute inset-x-0 top-3 flex justify-center"><Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading model…</Badge></div>}
                {err && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-200">Could not load this model: {err}</div>}
                {selPart && <div className="absolute right-3 top-3 max-w-[70%] rounded-lg bg-slate-900/85 p-3 text-sm text-white shadow" data-testid="text-part-popup"><div className="font-semibold">{selPart.name}</div><div className="mt-1 text-slate-200">{selPart.desc}</div></div>}
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
                  <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-model-credit">
                {model ? <>3D model: <ExtLink href={model.source_url}>{model.title} (NIH 3D {model.id})</ExtLink>, {model.license}. Colors are illustrative; untextured parts are shown in a palette.</>
                  : <>{caption} Schematic 3D model built for this app from textbook morphology; click a part to identify it.</>}
              </p>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{parts.length ? "Labelled parts" : "At a glance"}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {parts.length ? parts.map((x) => (
                  <button key={x.name} onClick={() => choose(sel === x.name ? null : x.name)} data-testid={`button-part-${x.name.replace(/\W+/g, "-").toLowerCase()}`}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover-elevate ${sel === x.name ? "bg-primary/10" : ""}`}>
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-sm border" style={{ background: x.color }} />
                    <span><span className="font-medium">{x.name}</span>{sel === x.name && <span className="block text-xs text-muted-foreground">{x.desc}</span>}</span>
                  </button>
                )) : (
                  <div className="space-y-3 text-sm">
                    {f.structure && <Section title="Structure">{f.structure}</Section>}
                    {f.genome && <Section title="Genome">{f.genome}</Section>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Fact sheet</CardTitle></CardHeader>
              <CardContent className="space-y-3" data-testid="card-factsheet">
                {f.structure && parts.length > 0 && <Section title="Structure">{f.structure}</Section>}
                {f.genome && parts.length > 0 && <Section title="Genome">{f.genome}</Section>}
                {f.transmission && <Section title="Transmission">{f.transmission}</Section>}
                {!!f.diseases?.length && <Section title="Diseases"><List items={f.diseases} /></Section>}
                {!!f.virulence?.length && <Section title="Virulence factors and pathogenesis"><List items={f.virulence} /></Section>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Diagnosis, treatment and prevention</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {f.diagnosis && <Section title="Diagnosis">{f.diagnosis}</Section>}
                {f.treatment && <Section title="Treatment">{f.treatment}</Section>}
                {f.prevention && <Section title="Prevention">{f.prevention}</Section>}
                {!!f.pearls?.length && <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">High-yield pearls</div><div className="text-sm"><List items={f.pearls} /></div></div>}
              </CardContent>
            </Card>
          </div>

          {p.pdb.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Protein structures (Protein Data Bank)</CardTitle></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1fr_300px]">
                {activePdb && <PdbViewer key={activePdb} id={activePdb} />}
                <div className="space-y-1.5">
                  {p.pdb.map((x) => (
                    <button key={x.id} onClick={() => setPdb(x.id)} data-testid={`button-pdb-${x.id}`} className={`w-full rounded-md border px-3 py-2 text-left text-sm hover-elevate ${activePdb === x.id ? "border-primary bg-primary/5" : ""}`}>
                      <div className="font-medium">{x.desc}</div>
                      <div className="text-xs text-muted-foreground">PDB {x.id}{x.method ? ` · ${x.method.toLowerCase()}` : ""}{x.resolution ? ` · ${x.resolution.toFixed(1)} Å` : ""}{x.year ? ` · ${x.year}` : ""}</div>
                    </button>
                  ))}
                  {activePdb && <div className="pt-1 text-xs text-muted-foreground">Deposited title: {p.pdb.find((x) => x.id === activePdb)?.title}. <ExtLink href={`https://www.rcsb.org/structure/${activePdb}`}>Open on RCSB PDB</ExtLink></div>}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {p.wiki && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Overview</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <ArticleText text={p.wiki} max={1800} />
                  <p className="text-xs text-muted-foreground">From Wikipedia, <ExtLink href={p.wiki_url!}>{p.wiki_title}</ExtLink> (CC BY-SA 4.0).</p>
                </CardContent>
              </Card>
            )}
            {d!.mesh && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">MeSH heading</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Link href={`/concept/${d!.mesh.id}`} className="font-medium text-primary hover:underline" data-testid="link-pathogen-concept">{d!.mesh.name}</Link>
                  {d!.mesh.note && <p className="text-muted-foreground">{d!.mesh.note}</p>}
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(d!.mesh.name)}%5BMeSH%5D`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-pathogen-pubmed">Recent research on PubMed <ExternalLink className="h-3 w-3" /></a>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
