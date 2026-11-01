import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, EmptyState, Pager, BookmarkButton, ReportButton, useDebounced } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/hooks/use-toast";

type Fig = { id: number; book: string; title: string; caption: string; src: string; section: string | null; annotated: boolean };
type Spot = { x: number; y: number; label: string; detail: string };

export function FiguresPage() {
  const [params, setParams] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q, 300);
  const book = params.get("book") || "";
  const annotated = params.get("annotated") === "1";
  const page = Number(params.get("page") || 0);
  const extQ = params.get("q") || "";
  useEffect(() => { if (extQ !== dq) setQ(extQ); /* eslint-disable-next-line */ }, [extQ]);
  useEffect(() => { if ((params.get("q") || "") !== dq) setParams({ q: dq || null, page: null }); /* eslint-disable-next-line */ }, [dq]);
  const qs = new URLSearchParams({ ...(dq ? { q: dq } : {}), ...(book ? { book } : {}), ...(annotated ? { annotated: "1" } : {}), page: String(page) }).toString();
  const d = useQuery<{ total: number; page: number; size: number; rows: Fig[]; books: { slug: string; title: string; figures: number }[] }>({ queryKey: [`/api/figures?${qs}`] });
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Learn" title="Figure library"
        subtitle="Every illustration, micrograph and diagram from the OpenStax textbooks, with captions, searchable by structure, disease or process. Figures with labelled hotspots are marked; editors can add hotspot annotations to any figure." />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search figures — e.g. nephron, brachial plexus, mitosis, cardiac cycle" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-figure-search" />
        </div>
        <Select value={book || "all"} onValueChange={(v) => setParams({ book: v === "all" ? null : v, page: null })}>
          <SelectTrigger className="w-60" data-testid="select-figure-book"><SelectValue placeholder="All books" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All books</SelectItem>
            {d.data?.books.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.title} ({b.figures})</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={annotated} onCheckedChange={(v) => setParams({ annotated: v ? "1" : null, page: null })} data-testid="switch-annotated" />Annotated only</label>
      </div>
      {d.isLoading ? <ListSkeleton rows={8} /> : d.isError ? <ErrorState error={d.error} onRetry={() => d.refetch()} /> : !d.data!.rows.length ? (
        <EmptyState title={annotated ? "No annotated figures yet" : "No figures match"}>{annotated ? "Editors can open any figure and add hotspot labels." : "Try a broader term."}</EmptyState>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">{d.data!.total.toLocaleString()} figures</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {d.data!.rows.map((f) => (
              <Link key={f.id} href={`/figures/${f.id}`} data-testid={`card-figure-${f.id}`}>
                <Card className="h-full overflow-hidden hover-elevate">
                  <div className="relative aspect-[4/3] bg-white"><img src={f.src} alt={f.title} loading="lazy" className="h-full w-full object-contain" />
                    {f.annotated && <Badge className="absolute right-1.5 top-1.5 gap-0.5 text-[10px]"><MapPin className="h-3 w-3" />Hotspots</Badge>}
                  </div>
                  <CardContent className="p-2"><div className="line-clamp-2 text-xs font-medium leading-snug">{f.title || f.caption?.slice(0, 80) || "Figure"}</div><div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{f.section}</div></CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Pager page={page} total={d.data!.total} size={d.data!.size} onPage={(p) => setParams({ page: p ? String(p) : null })} />
        </>
      )}
      <p className="text-xs text-muted-foreground">Figures © OpenStax (Rice University) and the credited original authors, CC BY-NC-SA 4.0 unless the caption credits otherwise. <ExtLink href="https://openstax.org">openstax.org</ExtLink></p>
    </div>
  );
}

export function FigurePage() {
  const { id } = useParams<{ id: string }>();
  const d = useQuery<any>({ queryKey: [`/api/figures/${id}`] });
  const { user } = useApp();
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(true);
  const img = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  useEffect(() => { if (d.data) { setSpots(d.data.hotspots ?? []); setActive(null); } }, [d.data]);
  const save = useMutation({
    mutationFn: () => apiJson("PUT", `/api/admin/figures/${id}/hotspots`, { hotspots: spots.filter((s) => s.label.trim()) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/figures/${id}`] }); toast({ title: "Hotspots saved" }); setEditing(false); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const f = d.data;
  const onImgClick = (e: React.MouseEvent) => {
    if (!editing || !img.current) return;
    const r = img.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setSpots((s) => [...s, { x, y, label: "", detail: "" }]);
    setActive(spots.length);
  };
  const cur = active != null ? spots[active] : null;
  return (
    <div className="space-y-4">
      <Link href="/figures" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-figures"><ArrowLeft className="h-4 w-4" />Figure library</Link>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden"><CardContent className="p-3">
          <div ref={img} className={`relative mx-auto w-fit bg-white ${editing ? "cursor-crosshair" : ""}`} onClick={onImgClick} data-testid="figure-canvas">
            <img src={f.src} alt={f.alt || f.title} className="block max-h-[75vh] w-auto max-w-full select-none" draggable={false} />
            {spots.map((s, i) => (showAll || active === i) && (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActive(active === i ? null : i); }}
                className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-md ${active === i ? "bg-amber-500 text-black" : "bg-primary text-primary-foreground"}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }} title={s.label} data-testid={`hotspot-${i}`}>{i + 1}</button>
            ))}
          </div>
          {editing && <p className="mt-2 text-center text-xs text-muted-foreground">Click on the image to add a numbered pin, then label it on the right.</p>}
        </CardContent></Card>
        <div className="space-y-3">
          <Card><CardContent className="space-y-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.bookInfo?.title}{f.chapter ? ` · Ch. ${f.chapter_no} ${f.chapter}` : ""}</div>
            <h1 className="text-lg font-semibold leading-snug" data-testid="text-figure-title">{f.title || "Figure"}</h1>
            {f.caption && <p className="text-sm leading-relaxed text-muted-foreground">{f.caption}</p>}
            {f.section && <Link href={`/books/${f.book}/${f.section_id}`} className="text-sm text-primary hover:underline" data-testid="link-figure-section">Read the section: {f.section}</Link>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <BookmarkButton type="figure" refId={String(f.id)} title={f.title || "Figure"} />
              <ReportButton type="figure" refId={String(f.id)} title={f.title} />
            </div>
          </CardContent></Card>
          <Card><CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Hotspots ({spots.length})</div>
              <div className="flex gap-1">
                {spots.length > 0 && !editing && <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} data-testid="button-toggle-pins">{showAll ? "Quiz me (hide)" : "Show all"}</Button>}
                {isAdmin && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-hotspots"><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
              </div>
            </div>
            {!spots.length && !editing && <p className="text-xs text-muted-foreground">No labelled hotspots yet for this figure.{isAdmin ? " Use Edit to add them." : ""}</p>}
            <ol className="space-y-1">
              {spots.map((s, i) => (
                <li key={i}>
                  <button onClick={() => setActive(active === i ? null : i)} className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-sm hover-elevate ${active === i ? "bg-primary/10" : ""}`} data-testid={`button-spot-${i}`}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                    <span>{(showAll || active === i || editing) ? (s.label || <em className="text-muted-foreground">unlabelled</em>) : "?"}</span>
                  </button>
                  {active === i && !editing && s.detail && <p className="ml-9 pb-1 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>}
                </li>
              ))}
            </ol>
            {editing && cur && active != null && (
              <div className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center justify-between text-xs font-medium">Pin {active + 1}<button onClick={() => { setSpots(spots.filter((_, j) => j !== active)); setActive(null); }} className="text-destructive" data-testid="button-delete-spot"><Trash2 className="h-4 w-4" /></button></div>
                <Input placeholder="Label (e.g. Loop of Henle)" value={cur.label} onChange={(e) => setSpots(spots.map((s, j) => j === active ? { ...s, label: e.target.value } : s))} data-testid="input-spot-label" />
                <Textarea rows={3} placeholder="Explanation / clinical relevance (optional)" value={cur.detail} onChange={(e) => setSpots(spots.map((s, j) => j === active ? { ...s, detail: e.target.value } : s))} data-testid="input-spot-detail" />
              </div>
            )}
            {editing && (
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-hotspots"><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setSpots(f.hotspots ?? []); setEditing(false); setActive(null); }} data-testid="button-cancel-hotspots"><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
                <span className="ml-auto self-center text-[11px] text-muted-foreground"><Plus className="inline h-3 w-3" /> click image</span>
              </div>
            )}
          </CardContent></Card>
          <p className="text-[11px] text-muted-foreground">Figure © OpenStax / credited authors, {f.bookInfo?.license}. {f.bookInfo?.url && <ExtLink href={f.bookInfo.url}>Book on openstax.org</ExtLink>}</p>
        </div>
      </div>
    </div>
  );
}
