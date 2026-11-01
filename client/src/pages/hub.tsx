import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Box, FileCode2, GraduationCap, ListChecks, Pill, Rss, Stethoscope, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, EmptyState, ReportButton, useDebounced } from "@/components/common";
import { ArticleText } from "@/components/wiki-article";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";
import { useToast } from "@/hooks/use-toast";

// ───────────── Subjects ─────────────
export function SubjectsPage() {
  const d = useQuery<{ subjects: { id: string; title: string; group: string; blurb: string; questions: number; concepts: number }[] }>({ queryKey: ["/api/subjects"] });
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const groups = [["basic", "Basic sciences"], ["clinical", "Clinical specialties"], ["other", "Public health, ethics & other"]] as const;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Learn" title="Subjects & specialties"
        subtitle="Every discipline of the medical curriculum in one place: the MeSH vocabulary branch, textbook chapters, figures, ICD-10 chapter, patient topics, devices, drugs, 3D models and a practice block for each." />
      {groups.map(([g, label]) => {
        const rows = d.data!.subjects.filter((s) => (g === "other" ? !["basic", "clinical"].includes(s.group) : s.group === g));
        if (!rows.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((s) => (
                <Link key={s.id} href={`/subjects/${s.id}`} data-testid={`card-subject-${s.id}`}>
                  <Card className="h-full hover-elevate"><CardContent className="p-4">
                    <div className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4 text-primary" />{s.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <Badge variant="secondary">{s.concepts.toLocaleString()} concepts</Badge>
                      <Badge variant="secondary">{s.questions.toLocaleString()} questions</Badge>
                    </div>
                  </CardContent></Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SubjectPage() {
  const { id } = useParams<{ id: string }>();
  const d = useQuery<any>({ queryKey: [`/api/subjects/${id}`] });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const practice = useMutation({
    mutationFn: () => apiJson<{ session: { id: number } }>("POST", "/api/quiz/build", { systems: d.data.systems ?? [], disciplines: d.data.disciplines ?? [], mode: "tutor", count: 20 }),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ["/api/quiz/sessions"] }); navigate(`/quiz/${r.session.id}`); },
    onError: (e: Error) => toast({ title: "Could not start practice", description: e.message, variant: "destructive" }),
  });
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const s = d.data;
  const Section = ({ icon: I, title, children }: { icon: any; title: string; children: any }) => (
    <Card><CardContent className="p-4"><h2 className="mb-2 flex items-center gap-2 font-semibold"><I className="h-4 w-4 text-primary" />{title}</h2>{children}</CardContent></Card>
  );
  return (
    <div className="space-y-4">
      <Link href="/subjects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-subjects"><ArrowLeft className="h-4 w-4" />All subjects</Link>
      <PageHeader eyebrow={s.group === "clinical" ? "Clinical specialty" : "Basic science"} title={s.title} subtitle={s.blurb}
        actions={s.questions > 0 && (s.systems?.length || s.disciplines?.length) ? <Button onClick={() => practice.mutate()} disabled={practice.isPending} data-testid="button-practice-subject"><ListChecks className="mr-1 h-4 w-4" />Practice 20 of {s.questions.toLocaleString()} questions</Button> : null} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={FileCode2} title="Vocabulary (MeSH branches)">
          <div className="space-y-3">
            {s.mesh.map((m: any) => (
              <div key={m.tn}>
                <Link href={`/concept/${m.id}`} className="font-medium text-primary hover:underline" data-testid={`link-subject-mesh-${m.tn}`}>{m.name}</Link>
                <span className="ml-1 font-mono text-xs text-muted-foreground">{m.tn} · {m.total.toLocaleString()} terms</span>
                {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                <div className="mt-1 flex flex-wrap gap-1">{m.children.slice(0, 24).map((c: any) => <Link key={c.tn} href={`/concept/${c.id}`} className="rounded border px-1.5 py-0.5 text-xs hover-elevate">{c.name}</Link>)}</div>
              </div>
            ))}
          </div>
        </Section>
        <Section icon={BookOpen} title="Textbook sections">
          {s.sections.length ? (
            <ul className="space-y-1">{s.sections.map((x: any) => <li key={x.id} className="text-sm"><Link href={`/books/${x.book}/${x.id}`} className="text-primary hover:underline" data-testid={`link-subject-section-${x.id}`}>{x.title}</Link> <span className="text-xs text-muted-foreground">· {x.book_title}</span></li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">No matching sections.</p>}
          {s.books.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{s.books.map((b: any) => <Link key={b.slug} href={`/books/${b.slug}`} className="rounded-md border px-2 py-1 text-xs hover-elevate">{b.title}</Link>)}</div>}
        </Section>
      </div>
      {s.figures.length > 0 && (
        <Section icon={FileText} title="Figures">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {s.figures.map((f: any) => <Link key={f.id} href={`/figures/${f.id}`} className="overflow-hidden rounded-md border bg-white" title={f.title} data-testid={`link-subject-figure-${f.id}`}><img src={f.src} alt={f.title} loading="lazy" className="aspect-square w-full object-contain" /></Link>)}
          </div>
          <Link href={`/figures?q=${encodeURIComponent(s.figureQuery || s.title)}`} className="mt-2 inline-block text-sm text-primary hover:underline">More figures</Link>
        </Section>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {s.atlas?.length > 0 && (
          <Section icon={Box} title="3D anatomy">
            <div className="flex flex-wrap gap-1.5">{s.atlas.map((a: string) => <Link key={a} href={`/atlas?system=${a}`} className="rounded-md border px-2 py-1 text-sm capitalize hover-elevate" data-testid={`link-subject-atlas-${a}`}>{a} system</Link>)}</div>
          </Section>
        )}
        {s.icd.length > 0 && (
          <Section icon={FileCode2} title="ICD-10-CM">
            {s.icd.map((c: any) => <Link key={c.n} href={`/icd10?chapter=${c.n}`} className="block text-sm text-primary hover:underline">Ch. {c.n} ({c.start}–{c.end}): {c.title}</Link>)}
          </Section>
        )}
        {s.devices.some((x: any) => x.n) && (
          <Section icon={Stethoscope} title="Medical devices">
            {s.devices.filter((x: any) => x.n).map((x: any) => <Link key={x.specialty} href={`/devices?specialty=${encodeURIComponent(x.specialty)}`} className="block text-sm text-primary hover:underline">{x.specialty} ({x.n.toLocaleString()})</Link>)}
          </Section>
        )}
      </div>
      {s.drugs.length > 0 && (
        <Section icon={Pill} title="Drugs">
          <div className="flex flex-wrap gap-1.5">{s.drugs.map((x: any) => <Link key={x.slug} href={`/drugs/${x.slug}`} className="rounded-md border px-2 py-0.5 text-xs hover-elevate">{x.generic}</Link>)}</div>
        </Section>
      )}
      {s.topics.length > 0 && (
        <Section icon={FileText} title="Patient-level health topics (MedlinePlus)">
          <div className="flex flex-wrap gap-1.5">{s.topics.map((t: any) => <Link key={t.id} href={`/topics/${t.id}`} className="rounded-md border px-2 py-0.5 text-xs hover-elevate">{t.title}</Link>)}</div>
        </Section>
      )}
      {s.pubmed && <Link href={`/research?q=${encodeURIComponent(s.pubmed)}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="link-subject-research"><Rss className="h-4 w-4" />Recent {s.title.toLowerCase()} literature on PubMed</Link>}
    </div>
  );
}

// ───────────── What's new ─────────────
export function UpdatesPage() {
  const [params, setParams] = useHashQuery();
  const job = params.get("job") || "pubmed";
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const d = useQuery<any>({ queryKey: [`/api/updates?job=${job}&q=${encodeURIComponent(dq)}`] });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Stay current" title="What's new"
        subtitle="Newly published items collected by the platform's update jobs from official sources: PubMed, openFDA label changes and shortages, ClinicalTrials.gov and MedlinePlus. Editors run these jobs from the admin panel." />
      {d.data?.feeds && (
        <Tabs value={job} onValueChange={(v) => setParams({ job: v })}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {d.data.feeds.map((f: any) => <TabsTrigger key={f.key} value={f.key} data-testid={`tab-feed-${f.key}`}>{f.title} ({f.n})</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}
      <Input className="max-w-md" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-updates-filter" />
      {d.isLoading ? <ListSkeleton rows={8} /> : d.isError ? <ErrorState error={d.error} onRetry={() => d.refetch()} /> : !d.data.items.length ? (
        <EmptyState title="Nothing collected yet">This feed fills when an editor runs the “{d.data.title}” update job in the admin panel.</EmptyState>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Source: {d.data.source}{d.data.lastRun ? ` · last updated ${new Date(d.data.lastRun).toLocaleString()}` : ""}</p>
          <div className="space-y-2">
            {d.data.items.map((it: any) => (
              <Card key={it.id}><CardContent className="p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {it.url ? <ExtLink href={it.url}>{it.title}</ExtLink> : <span className="font-medium">{it.title}</span>}
                  {it.published && <span className="text-xs text-muted-foreground">{it.published}</span>}
                </div>
                {it.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{it.summary}</p>}
              </CardContent></Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────── Reviewed articles (imported by editors) ─────────────
export function ArticlesPage() {
  const d = useQuery<{ articles: any[] }>({ queryKey: ["/api/articles"] });
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Library" title="Reviewed articles"
        subtitle="Articles imported by editors from openly licensed or public-domain sources (for example U.S. government health agencies), checked and published with their licence and attribution." />
      {d.isLoading ? <ListSkeleton rows={6} /> : d.isError ? <ErrorState error={d.error} onRetry={() => d.refetch()} /> : !d.data!.articles.length ? (
        <EmptyState title="No published articles yet">Editors can import a page from a URL in the admin panel, review it and publish it here.</EmptyState>
      ) : (
        <div className="space-y-2">
          {d.data!.articles.map((a) => (
            <Link key={a.id} href={`/articles/${a.id}`} data-testid={`card-article-${a.id}`}>
              <Card className="hover-elevate"><CardContent className="p-3">
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.subject ? `${a.subject} · ` : ""}{a.license} · {new Date(a.updated_at).toLocaleDateString()}</div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticleViewPage() {
  const { id } = useParams<{ id: string }>();
  const d = useQuery<any>({ queryKey: [`/api/articles/${id}`] });
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const a = d.data;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Reviewed articles</Link>
      <h1 className="text-2xl font-semibold leading-tight" data-testid="text-article-title">{a.title}</h1>
      <div className="text-xs text-muted-foreground">{a.subject ? `${a.subject} · ` : ""}Updated {new Date(a.updated_at).toLocaleDateString()}</div>
      <ArticleText text={a.body} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>Source: <ExtLink href={a.url}>{a.attribution || a.url}</ExtLink> · Licence: {a.license}</span>
        <ReportButton type="article" refId={String(a.id)} title={a.title} />
      </div>
    </div>
  );
}
