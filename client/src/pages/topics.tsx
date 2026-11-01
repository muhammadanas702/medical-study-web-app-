import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, SourceLine, useDebounced, BookmarkButton, ExtLink } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";

type T = { id: string; title: string; url: string; meta_desc: string; groups: string[] };

export function TopicsPage() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q.trim(), 250);
  const group = params.get("group") || "";
  const r = useQuery<{ total: number; rows: T[]; groups: { v: string; n: number }[] }>({ queryKey: ["/api/topics", { q: dq, group }] });
  return (
    <div>
      <PageHeader title="Health topics" subtitle="MedlinePlus summaries from the U.S. National Library of Medicine: plain-language overviews of conditions, tests and treatments, useful for patient-communication and OSCE practice." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter topics" className="pl-9" data-testid="input-topic-filter" />
        </div>
        <Select value={group || "all"} onValueChange={(v) => update({ group: v === "all" ? null : v })}>
          <SelectTrigger data-testid="select-topic-group"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72"><SelectItem value="all">All groups</SelectItem>{r.data?.groups.map((g) => <SelectItem key={g.v} value={g.v}>{g.v} ({g.n})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {r.isLoading ? <ListSkeleton /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data!.rows.length === 0 ? <EmptyState title="No topics match" /> : (
        <>
          <div className="mb-2 text-xs text-muted-foreground tabular">{r.data!.total} topics{r.data!.total > r.data!.rows.length ? `, showing ${r.data!.rows.length}` : ""}</div>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="list-topics">
            {r.data!.rows.map((t) => (
              <Link key={t.id} href={`/topics/${t.id}`} className="rounded-lg border bg-card p-3 hover-elevate" data-testid={`link-topic-${t.id}`}>
                <div className="text-sm font-medium">{t.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{t.meta_desc}</div>
              </Link>
            ))}
          </div>
        </>
      )}
      <SourceLine name="MedlinePlus Health Topics XML, U.S. National Library of Medicine" url="https://medlineplus.gov/xml.html" />
    </div>
  );
}

type TD = T & { summary: string; also_called: string[]; mesh: { id: string; name: string }[]; institute: string; created: string; source: { source: string; url: string; file: string } };

/** MedlinePlus summaries contain a small, known set of tags; keep only safe structural ones. */
function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["P", "UL", "OL", "LI", "H3", "H4", "STRONG", "EM", "B", "I", "BR", "A", "SPAN"]);
  const walk = (el: Element) => {
    for (const ch of Array.from(el.children)) {
      if (!allowed.has(ch.tagName)) { ch.replaceWith(...Array.from(ch.childNodes)); continue; }
      for (const a of Array.from(ch.attributes)) if (!(ch.tagName === "A" && a.name === "href")) ch.removeAttribute(a.name);
      if (ch.tagName === "A") {
        const href = ch.getAttribute("href") || "";
        if (!/^https?:\/\//.test(href)) ch.removeAttribute("href");
        ch.setAttribute("target", "_blank"); ch.setAttribute("rel", "noreferrer");
      }
      walk(ch);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const r = useQuery<TD>({ queryKey: ["/api/topics", id] });
  if (r.isLoading) return <Skeleton className="h-80" />;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const t = r.data!;
  return (
    <div>
      <PageHeader eyebrow={t.groups.join(" · ")} title={t.title} subtitle={t.also_called.length ? `Also called: ${t.also_called.join(", ")}` : undefined} actions={<BookmarkButton type="topic" refId={t.id} title={t.title} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="pt-4">
          <div className="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc" data-testid="text-topic-summary" dangerouslySetInnerHTML={{ __html: sanitize(t.summary) }} />
        </CardContent></Card>
        <div className="space-y-3">
          {t.mesh.length > 0 && <Card><CardContent className="pt-4 text-sm"><div className="mb-2 text-xs font-medium text-muted-foreground">MeSH concepts</div><div className="flex flex-wrap gap-1.5">{t.mesh.map((m) => <Link key={m.id} href={`/concept/${m.id}`}><Badge className="cursor-pointer font-normal">{m.name}</Badge></Link>)}</div></CardContent></Card>}
          <Card><CardContent className="space-y-1 pt-4 text-sm">
            {t.institute && <div><span className="text-muted-foreground">Primary NIH institute:</span> {t.institute}</div>}
            <div><ExtLink href={t.url}>Read on MedlinePlus</ExtLink></div>
          </CardContent></Card>
        </div>
      </div>
      <SourceLine name={t.source.source} url={t.url} date={`Topic created ${t.created}`} note={t.source.file} />
    </div>
  );
}
