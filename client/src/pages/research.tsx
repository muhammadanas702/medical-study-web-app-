import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, Pager, SourceLine, BookmarkButton, ExtLink } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";

type Art = { pmid: string; title: string; journal: string; pubdate: string; authors: string[]; types: string[]; doi?: string; pmc?: string };
const TYPES = [
  { v: "", l: "All article types" }, { v: "Review", l: "Reviews" }, { v: "Systematic Review", l: "Systematic reviews" }, { v: "Meta-Analysis", l: "Meta-analyses" },
  { v: "Randomized Controlled Trial", l: "Randomized controlled trials" }, { v: "Practice Guideline", l: "Practice guidelines" }, { v: "Case Reports", l: "Case reports" },
];

function decodeTitle(t: string) {
  const el = document.createElement("textarea");
  el.innerHTML = t;
  return el.value.replace(/<[^>]+>/g, "");
}

export function ResearchPage() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const term = params.get("q") || "";
  const types = params.get("types") || "";
  const years = params.get("years") || "";
  const page = Number(params.get("page") || 0);
  useEffect(() => setQ(params.get("q") || ""), [params]);
  const r = useQuery<{ total: number; items: Art[] }>({ queryKey: ["/api/pubmed", { q: term, types, years, page }], enabled: !!term });
  return (
    <div>
      <PageHeader title="PubMed literature" subtitle="Live search of more than 38 million citations in PubMed (NCBI). Filter to reviews, meta-analyses, RCTs or guidelines to get to the evidence quickly." />
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim(), page: null }, false); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. SGLT2 inhibitors heart failure" className="pl-9" data-testid="input-pubmed" />
        </div>
        <Button type="submit" data-testid="button-pubmed-search">Search</Button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={types || "any"} onValueChange={(v) => update({ types: v === "any" ? null : v, page: null })}>
          <SelectTrigger className="w-60" data-testid="select-pubmed-type"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.l} value={t.v || "any"}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={years || "any"} onValueChange={(v) => update({ years: v === "any" ? null : v, page: null })}>
          <SelectTrigger className="w-44" data-testid="select-pubmed-years"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="any">Any year</SelectItem><SelectItem value="1">Past year</SelectItem><SelectItem value="5">Past 5 years</SelectItem><SelectItem value="10">Past 10 years</SelectItem></SelectContent>
        </Select>
      </div>
      {!term ? <EmptyState title="Search the biomedical literature">Results come straight from NCBI E-utilities, ranked by relevance.</EmptyState> : r.isLoading ? <ListSkeleton rows={8} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data!.items.length === 0 ? <EmptyState title="No articles found" /> : (
        <>
          <div className="mb-2 text-xs text-muted-foreground tabular">{r.data!.total.toLocaleString()} results</div>
          <div className="divide-y rounded-lg border bg-card" data-testid="list-pubmed">
            {r.data!.items.map((a) => (
              <Link key={a.pmid} href={`/research/${a.pmid}`} className="block px-4 py-3 hover-elevate" data-testid={`link-article-${a.pmid}`}>
                <div className="text-sm font-medium leading-snug">{decodeTitle(a.title || "")}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{a.authors.slice(0, 3).join(", ")}{a.authors.length > 3 ? " et al." : ""} · <span className="italic-none">{a.journal}</span> · {a.pubdate}</div>
                <div className="mt-1 flex flex-wrap gap-1">{a.types.filter((t) => t !== "Journal Article").slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>)}{a.pmc && <Badge variant="outline" className="text-[10px] font-normal">Free full text</Badge>}</div>
              </Link>
            ))}
          </div>
          <Pager page={page} total={Math.min(r.data!.total, 1000)} size={20} onPage={(p) => update({ page: p || null }, false)} />
        </>
      )}
      <SourceLine name="PubMed, National Center for Biotechnology Information (NCBI E-utilities)" url="https://pubmed.ncbi.nlm.nih.gov/" note="Queried live" />
    </div>
  );
}

type ArtD = { pmid: string; title: string; abstract: { label: string | null; text: string }[]; mesh: { id: string; name: string }[]; journal: string; year: string; authors: string[]; doi: string | null; pmc: string | null; types: string[]; url: string };

export function ArticlePage() {
  const { pmid } = useParams<{ pmid: string }>();
  const r = useQuery<ArtD>({ queryKey: ["/api/pubmed", pmid] });
  if (r.isLoading) return <div className="space-y-3"><Skeleton className="h-8" /><Skeleton className="h-64" /></div>;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const a = r.data!;
  return (
    <div>
      <PageHeader eyebrow={`${a.journal} · ${a.year} · PMID ${a.pmid}`} title={a.title} subtitle={a.authors.slice(0, 8).join(", ") + (a.authors.length > 8 ? " et al." : "")}
        actions={<><BookmarkButton type="article" refId={a.pmid} title={a.title} /><Button asChild size="sm" variant="outline"><a href={a.url} target="_blank" rel="noreferrer" data-testid="link-pubmed"><ExternalLink className="h-4 w-4" /> PubMed</a></Button>{a.pmc && <Button asChild size="sm"><a href={`https://pmc.ncbi.nlm.nih.gov/articles/${a.pmc}/`} target="_blank" rel="noreferrer" data-testid="link-pmc"><FileText className="h-4 w-4" /> Full text (PMC)</a></Button>}</>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="space-y-3 pt-4 text-sm leading-relaxed" data-testid="text-abstract">
          {a.abstract.length === 0 ? <p className="text-muted-foreground">No abstract available.</p> : a.abstract.map((p, i) => <p key={i}>{p.label && <span className="font-semibold">{p.label}. </span>}{p.text}</p>)}
        </CardContent></Card>
        <div className="space-y-3">
          {a.types.length > 0 && <Card><CardContent className="pt-4"><div className="mb-2 text-xs font-medium text-muted-foreground">Publication type</div><div className="flex flex-wrap gap-1">{a.types.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}</div></CardContent></Card>}
          {a.mesh.length > 0 && <Card><CardContent className="pt-4"><div className="mb-2 text-xs font-medium text-muted-foreground">MeSH terms</div><div className="flex flex-wrap gap-1">{a.mesh.map((m) => <Link key={m.id} href={`/concept/${m.id}`}><Badge variant="outline" className="cursor-pointer font-normal">{m.name}</Badge></Link>)}</div></CardContent></Card>}
          {a.doi && <div className="text-sm"><ExtLink href={`https://doi.org/${a.doi}`}>doi:{a.doi}</ExtLink></div>}
        </div>
      </div>
      <SourceLine name="PubMed (NCBI)" url={a.url} />
    </div>
  );
}

type Trial = { nctId: string; title: string; status: string; phases: string[]; type: string; conditions: string[]; interventions: string[]; sponsor: string; start: string; enrollment: number; summary: string };
const STATUSES = ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "TERMINATED", "WITHDRAWN"];

export function TrialsPage() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const term = params.get("q") || "";
  const status = params.get("status") || "";
  const [tokens, setTokens] = useState<string[]>([""]);
  useEffect(() => { setTokens([""]); setQ(params.get("q") || ""); }, [term, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const token = tokens[tokens.length - 1];
  const r = useQuery<{ total: number; items: Trial[]; nextToken: string | null }>({ queryKey: ["/api/trials", { q: term, status, token }], enabled: !!term });
  return (
    <div>
      <PageHeader title="Clinical trials" subtitle="Live search of ClinicalTrials.gov (U.S. National Library of Medicine): see what is being tested for a condition, the phase, the intervention and who is running it." />
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }, false); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Condition, intervention or NCT number" className="pl-9" data-testid="input-trials" />
        </div>
        <Button type="submit" data-testid="button-trials-search">Search</Button>
      </form>
      <Select value={status || "any"} onValueChange={(v) => update({ status: v === "any" ? null : v })}>
        <SelectTrigger className="mb-4 w-60" data-testid="select-trial-status"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="any">Any status</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</SelectItem>)}</SelectContent>
      </Select>
      {!term ? <EmptyState title="Search registered studies" /> : r.isLoading ? <ListSkeleton rows={6} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data!.items.length === 0 ? <EmptyState title="No studies found" /> : (
        <>
          <div className="mb-2 text-xs text-muted-foreground tabular">{r.data!.total?.toLocaleString()} studies · page {tokens.length}</div>
          <div className="space-y-2" data-testid="list-trials">
            {r.data!.items.map((t) => (
              <Card key={t.nctId}><CardContent className="pt-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a href={`https://clinicaltrials.gov/study/${t.nctId}`} target="_blank" rel="noreferrer" className="flex-1 font-medium leading-snug hover:text-primary" data-testid={`link-trial-${t.nctId}`}>{t.title}</a>
                  <Badge variant={t.status === "RECRUITING" ? "default" : "secondary"} className="font-normal">{t.status?.replace(/_/g, " ").toLowerCase()}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t.nctId} · {t.type?.toLowerCase()} · {t.phases.filter((p) => p !== "NA").join(", ") || "phase n/a"} · {t.sponsor} · start {t.start || "—"}{t.enrollment ? ` · n=${t.enrollment}` : ""}</div>
                {t.conditions.length > 0 && <div className="mt-2 text-xs"><span className="text-muted-foreground">Conditions:</span> {t.conditions.slice(0, 5).join("; ")}</div>}
                {t.interventions.length > 0 && <div className="text-xs"><span className="text-muted-foreground">Interventions:</span> {t.interventions.join("; ")}</div>}
                {t.summary && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{t.summary}</p>}
              </CardContent></Card>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" size="sm" disabled={tokens.length <= 1} onClick={() => setTokens((t) => t.slice(0, -1))} data-testid="button-trials-prev">Previous</Button>
            <Button variant="outline" size="sm" disabled={!r.data!.nextToken} onClick={() => setTokens((t) => [...t, r.data!.nextToken!])} data-testid="button-trials-next">Next</Button>
          </div>
        </>
      )}
      <SourceLine name="ClinicalTrials.gov API v2, U.S. National Library of Medicine" url="https://clinicaltrials.gov/data-api/api" note="Queried live" />
    </div>
  );
}
