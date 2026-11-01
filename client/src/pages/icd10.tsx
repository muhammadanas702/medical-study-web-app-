import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, SourceLine, useDebounced, BookmarkButton } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";

type Ch = { n: number; start: string; end: string; title: string; billable: number };
type Row = { code: string; display: string; title: string; billable: number; chapter: number; nchild?: number };
type Src = { source: string; url: string; effective: string; codes: number };

function CodeRow({ r }: { r: Row }) {
  return (
    <Link href={`/icd10/${r.code}`} className="flex items-baseline gap-3 px-4 py-2.5 hover-elevate" data-testid={`link-icd-${r.code}`}>
      <span className="w-20 shrink-0 font-mono text-sm font-medium text-primary">{r.display}</span>
      <span className="flex-1 text-sm">{r.title}</span>
      {r.billable ? <Badge variant="secondary" className="shrink-0 font-normal">Billable</Badge> : r.nchild ? <span className="shrink-0 text-xs text-muted-foreground">{r.nchild} sub</span> : null}
    </Link>
  );
}

export function Icd10Page() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q.trim(), 300);
  const chapter = Number(params.get("chapter") || 0);
  useEffect(() => {
    if (dq !== (params.get("q") || "")) update({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const r = useQuery<{ chapters: Ch[]; rows: Row[]; source: Src }>({ queryKey: ["/api/icd10", { q: dq, chapter: dq ? "" : chapter || "" }] });
  const ch = r.data?.chapters.find((c) => c.n === chapter);
  return (
    <div>
      <PageHeader title="ICD-10-CM diagnosis codes" subtitle="The complete U.S. clinical modification code set for FY2027 (effective October 1, 2026). Search by code or description, or browse by chapter." />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or description, e.g. “E11.65” or “community acquired pneumonia”" className="pl-9" data-testid="input-icd-search" />
      </div>
      {r.isLoading ? <ListSkeleton rows={10} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : dq ? (
        r.data!.rows.length === 0 ? <EmptyState title="No codes match" /> : <div className="divide-y rounded-lg border bg-card" data-testid="list-icd-results">{r.data!.rows.map((x) => <CodeRow key={x.code} r={x} />)}</div>
      ) : chapter && ch ? (
        <>
          <button onClick={() => update({ chapter: null }, false)} className="mb-3 text-sm text-primary hover:underline" data-testid="button-all-chapters">All chapters</button>
          <div className="mb-2 text-sm font-medium">Chapter {ch.n}: {ch.title} <span className="font-mono text-xs text-muted-foreground">({ch.start}–{ch.end})</span></div>
          <div className="divide-y rounded-lg border bg-card" data-testid="list-icd-categories">{r.data!.rows.map((x) => <CodeRow key={x.code} r={x} />)}</div>
        </>
      ) : (
        <div className="divide-y rounded-lg border bg-card" data-testid="list-icd-chapters">
          {r.data!.chapters.map((c) => (
            <button key={c.n} onClick={() => update({ chapter: c.n }, false)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover-elevate" data-testid={`button-chapter-${c.n}`}>
              <span className="w-8 text-sm tabular text-muted-foreground">{c.n}</span>
              <span className="w-24 shrink-0 font-mono text-xs text-primary">{c.start}–{c.end}</span>
              <span className="flex-1 text-sm">{c.title}</span>
              <span className="hidden text-xs text-muted-foreground tabular sm:inline">{c.billable.toLocaleString()} billable</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      {r.data && <SourceLine name={r.data.source.source} url={r.data.source.url} date={r.data.source.effective} note={`${r.data.source.codes.toLocaleString()} codes · Public domain`} />}
    </div>
  );
}

export function Icd10CodePage() {
  const { code } = useParams<{ code: string }>();
  const r = useQuery<Row & { short: string; parent: string | null; ancestors: Row[]; children: Row[]; chapterInfo: Ch; source: Src }>({ queryKey: ["/api/icd10", code] });
  if (r.isLoading) return <Skeleton className="h-60" />;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const d = r.data!;
  return (
    <div>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        <Link href="/icd10" className="text-primary hover:underline">ICD-10-CM</Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <Link href={`/icd10?chapter=${d.chapterInfo.n}`} className="text-primary hover:underline">Ch. {d.chapterInfo.n}</Link>
        {d.ancestors.map((a) => <span key={a.code} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /><Link href={`/icd10/${a.code}`} className="font-mono text-primary hover:underline">{a.display}</Link></span>)}
      </nav>
      <PageHeader
        eyebrow={<span className="font-mono text-base normal-case tracking-normal text-primary">{d.display}</span>}
        title={d.title}
        subtitle={d.chapterInfo.title}
        actions={<><Badge variant={d.billable ? "default" : "secondary"}>{d.billable ? "Billable / valid for submission" : "Header — not billable"}</Badge><BookmarkButton type="icd10" refId={d.code} title={`${d.display} ${d.title}`} /></>}
      />
      {d.ancestors.length > 0 && (
        <Card className="mb-4"><CardContent className="space-y-1 pt-4 text-sm">
          {d.ancestors.map((a, i) => <div key={a.code} style={{ paddingLeft: i * 14 }}><span className="mr-2 font-mono text-muted-foreground">{a.display}</span>{a.title}</div>)}
          <div style={{ paddingLeft: d.ancestors.length * 14 }} className="font-medium"><span className="mr-2 font-mono text-primary">{d.display}</span>{d.title}</div>
        </CardContent></Card>
      )}
      {d.children.length > 0 ? (
        <>
          <h2 className="mb-2 text-sm font-medium">More specific codes ({d.children.length})</h2>
          <div className="divide-y rounded-lg border bg-card" data-testid="list-icd-children">{d.children.map((x) => <CodeRow key={x.code} r={x} />)}</div>
        </>
      ) : <p className="text-sm text-muted-foreground">This is the most specific code in its branch.</p>}
      <p className="mt-4 text-xs text-muted-foreground">Code descriptions only. Instructional notes (includes, excludes1/excludes2, code-first, use-additional-code) are in the official tabular list and guidelines from CMS/NCHS.</p>
      <SourceLine name={d.source.source} url={d.source.url} date={d.source.effective} />
    </div>
  );
}
