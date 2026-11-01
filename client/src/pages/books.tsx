import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, ImageIcon, ListChecks, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, EmptyState, BookHtml, BookmarkButton, ReportButton, useDebounced } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Book = { slug: string; title: string; subject: string; license: string; license_url: string; url: string; sections: number; figures: number; questions: number; updated: string };
type TocRow = { id: number; unit: string | null; chapter: string; chapter_no: number; ord: number; title: string; words: number; nfig: number; nq: number };

const LIC = "CC BY-NC-SA 4.0";

export function BooksPage() {
  const books = useQuery<{ books: Book[]; source: any }>({ queryKey: ["/api/books"] });
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const hits = useQuery<{ rows: any[] }>({ queryKey: [`/api/books/search?q=${encodeURIComponent(dq)}`], enabled: dq.trim().length > 1 });
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Learn" title="Open textbooks"
        subtitle="Complete, peer-reviewed OpenStax textbooks: every chapter, section, figure and end-of-chapter review question, searchable and linked to the question bank. Copyrighted commercial textbooks (Robbins, Guyton, First Aid and others) cannot be redistributed and are not included." />
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search all textbooks — e.g. nephron loop of Henle, beta blockers, cell cycle" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-book-search" />
      </div>
      {dq.trim().length > 1 ? (
        hits.isLoading ? <ListSkeleton rows={6} /> : hits.isError ? <ErrorState error={hits.error} /> : !hits.data?.rows.length ? <EmptyState title="No sections match" /> : (
          <div className="space-y-2" data-testid="list-book-hits">
            {hits.data.rows.map((r) => (
              <Card key={r.id}><CardContent className="p-3">
                <Link href={`/books/${r.book}/${r.id}`} className="font-medium text-primary hover:underline" data-testid={`link-hit-${r.id}`}>{r.title}</Link>
                <div className="text-xs text-muted-foreground">{r.book_title} · {r.chapter}</div>
                <p className="mt-1 text-sm text-muted-foreground [&_mark]:rounded [&_mark]:bg-yellow-200/70 [&_mark]:px-0.5 dark:[&_mark]:bg-yellow-500/30" dangerouslySetInnerHTML={{ __html: r.snip }} />
              </CardContent></Card>
            ))}
          </div>
        )
      ) : books.isLoading ? <ListSkeleton rows={6} /> : books.isError ? <ErrorState error={books.error} onRetry={() => books.refetch()} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {books.data!.books.map((b) => (
            <Link key={b.slug} href={`/books/${b.slug}`} data-testid={`card-book-${b.slug}`}>
              <Card className="h-full hover-elevate"><CardContent className="space-y-2 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" /></div>
                  <div><div className="font-semibold leading-snug">{b.title}</div><div className="text-xs text-muted-foreground">{b.subject}</div></div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="secondary">{b.sections} sections</Badge>
                  <Badge variant="secondary">{b.figures.toLocaleString()} figures</Badge>
                  {b.questions > 0 && <Badge variant="secondary">{b.questions} questions</Badge>}
                </div>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Content © OpenStax, Rice University, licensed <ExtLink href="https://creativecommons.org/licenses/by-nc-sa/4.0/">{LIC}</ExtLink>. Source: <ExtLink href="https://openstax.org">openstax.org</ExtLink>. Text is shown unmodified apart from formatting; questions are the books' own review questions.</p>
    </div>
  );
}

export function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const d = useQuery<{ book: Book; toc: TocRow[] }>({ queryKey: [`/api/books/${slug}`] });
  const [q, setQ] = useState("");
  const chapters = useMemo(() => {
    const m = new Map<string, { no: number; title: string; unit: string | null; rows: TocRow[] }>();
    for (const r of d.data?.toc ?? []) {
      if (q && !r.title.toLowerCase().includes(q.toLowerCase()) && !r.chapter.toLowerCase().includes(q.toLowerCase())) continue;
      const k = `${r.chapter_no}|${r.chapter}`;
      if (!m.has(k)) m.set(k, { no: r.chapter_no, title: r.chapter, unit: r.unit, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return Array.from(m.values());
  }, [d.data, q]);
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const b = d.data.book;
  return (
    <div className="space-y-5">
      <Link href="/books" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-books"><ArrowLeft className="h-4 w-4" />All textbooks</Link>
      <PageHeader eyebrow={b.subject} title={b.title} subtitle={<>{b.sections} sections · {b.figures.toLocaleString()} figures · {b.questions} review questions. <ExtLink href={b.url}>Read on openstax.org</ExtLink></>} />
      <Input className="max-w-md" placeholder="Filter chapters and sections…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-toc-filter" />
      <div className="space-y-3">
        {chapters.map((c) => (
          <Card key={`${c.no}-${c.title}`}><CardContent className="p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chapter {c.no}</span>
              <h3 className="font-semibold">{c.title}</h3>
              {c.unit && <span className="text-xs text-muted-foreground">· {c.unit}</span>}
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {c.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/books/${slug}/${r.id}`} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover-elevate" data-testid={`link-section-${r.id}`}>
                    <span>{r.title}</span>
                    <span className="flex shrink-0 gap-1.5 text-[11px] text-muted-foreground">
                      {r.nfig > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3 w-3" />{r.nfig}</span>}
                      {r.nq > 0 && <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3 w-3" />{r.nq}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">© OpenStax, {b.license} (<ExtLink href={b.license_url}>licence</ExtLink>).</p>
    </div>
  );
}

export function BookSectionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const d = useQuery<any>({ queryKey: [`/api/books/${slug}/${id}`] });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const practice = useMutation({
    mutationFn: (ids: string[]) => apiJson<{ session: { id: number } }>("POST", "/api/quiz/build", { ids, mode: "tutor", count: Math.min(100, ids.length) }),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ["/api/quiz/sessions"] }); navigate(`/quiz/${r.session.id}`); },
    onError: (e: Error) => toast({ title: "Could not start practice", description: e.message, variant: "destructive" }),
  });
  if (d.isLoading) return <ListSkeleton rows={12} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const { section: s, book: b, prev, next, questionIds } = d.data;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/books/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-book"><ArrowLeft className="h-4 w-4" />{b.title}</Link>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chapter {s.chapter_no} · {s.chapter}</div>
        <h1 className="mt-1 text-2xl font-semibold leading-tight" data-testid="text-section-title">{s.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{Math.max(1, Math.round(s.words / 220))} min read</Badge>
          <BookmarkButton type="book" refId={`${slug}/${s.id}`} title={`${s.title} (${b.title})`} />
          {questionIds.length > 0 && (
            <Button size="sm" onClick={() => practice.mutate(questionIds)} disabled={practice.isPending} data-testid="button-practice-section"><ListChecks className="mr-1 h-4 w-4" />Practice {questionIds.length} question{questionIds.length === 1 ? "" : "s"}</Button>
          )}
        </div>
      </div>
      {s.abstract && <div className="rounded-lg border bg-muted/40 p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learning objectives</div><BookHtml html={s.abstract} /></div>}
      <BookHtml html={s.html} className="text-[15px]" />
      <div className="flex items-center justify-between gap-2 border-t pt-4">
        {prev ? <Link href={`/books/${slug}/${prev.id}`} className="inline-flex max-w-[45%] items-center gap-1 text-sm text-primary hover:underline" data-testid="link-prev-section"><ArrowLeft className="h-4 w-4 shrink-0" /><span className="truncate">{prev.title}</span></Link> : <span />}
        {next ? <Link href={`/books/${slug}/${next.id}`} className="inline-flex max-w-[45%] items-center gap-1 text-right text-sm text-primary hover:underline" data-testid="link-next-section"><span className="truncate">{next.title}</span><ArrowRight className="h-4 w-4 shrink-0" /></Link> : <span />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© OpenStax, <ExtLink href={b.license_url}>{b.license}</ExtLink>. <ExtLink href={b.url}>Original book</ExtLink>.</span>
        <ReportButton type="book" refId={`${slug}/${s.id}`} title={s.title} />
      </div>
    </div>
  );
}
