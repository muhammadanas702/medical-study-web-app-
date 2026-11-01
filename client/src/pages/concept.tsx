import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Box, Pill, BookOpenText, ListChecks, FileCode2, Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ErrorState, SourceLine, BookmarkButton, AddCardButton, ExtLink } from "@/components/common";
import { MESH_CATS } from "@/lib/meta";

type Ref = { id: string; name: string };
type C = {
  id: string; name: string; scopeNote: string | null; cats: string[]; entryTerms: string[]; introduced: string; updated: string;
  trees: { tn: string; path: { tn: string; id: string | null; name: string }[]; children: { tn: string; id: string; name: string; nchild: number }[] }[];
  pharmActions: Ref[]; seeAlso: Ref[]; paMembers: Ref[];
  topics: { id: string; title: string; url: string; meta_desc: string }[];
  drugs: { slug: string; generic: string; brands: string[] }[];
  parts3d: { fj: string; name: string; system: string }[];
  models: { id: string; title: string }[];
  questionCount: number;
  icd10: { code: string; display: string; title: string }[];
  source: { name: string; url: string };
};

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Pill; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm">{Icon && <Icon className="h-4 w-4 text-primary" />}{title}</CardTitle></CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export default function ConceptPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const r = useQuery<C>({ queryKey: ["/api/concepts", id] });
  if (r.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const c = r.data!;
  const systems = Array.from(new Set(c.parts3d.map((p) => p.system)));

  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex flex-wrap gap-1.5">{c.cats.filter((x) => MESH_CATS[x]).map((x) => <Badge key={x} variant="secondary">{MESH_CATS[x].label}</Badge>)}<span className="font-mono normal-case">{c.id}</span></span>}
        title={c.name}
        actions={
          <>
            <BookmarkButton type="concept" refId={c.id} title={c.name} />
            <AddCardButton front={`Define: ${c.name}`} back={c.scopeNote || c.name} deck={c.cats[0] && MESH_CATS[c.cats[0]] ? MESH_CATS[c.cats[0]].label : "Concepts"} sourceType="concept" sourceId={c.id} />
            {c.questionCount > 0 && (
              <Button size="sm" onClick={() => navigate(`/qbank?concept=${c.id}`)} data-testid="button-practice-concept"><ListChecks className="h-4 w-4" /> Practice ({c.questionCount})</Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Definition (MeSH scope note)">
            {c.scopeNote ? <p className="leading-relaxed" data-testid="text-scope-note">{c.scopeNote}</p> : <p className="text-muted-foreground">NLM has not published a scope note for this heading.</p>}
            {c.entryTerms.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Synonyms and entry terms</div>
                <div className="flex flex-wrap gap-1.5">{c.entryTerms.slice(0, 40).map((t) => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}</div>
              </div>
            )}
          </Section>

          <Section title="Position in the MeSH hierarchy">
            <div className="space-y-4">
              {c.trees.map((t) => (
                <div key={t.tn}>
                  <div className="flex flex-wrap items-center gap-1 text-[13px]">
                    {t.path.map((p, i) => (
                      <span key={p.tn} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        {p.id && p.id !== c.id ? <Link href={`/concept/${p.id}`} className="text-primary hover:underline">{p.name}</Link> : <span className={p.id === c.id ? "font-medium" : "text-muted-foreground"}>{p.name}</span>}
                      </span>
                    ))}
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">{t.tn}</span>
                  </div>
                  {t.children.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-3">
                      {t.children.slice(0, 40).map((ch) => <Link key={ch.tn} href={`/concept/${ch.id}`}><Badge variant="secondary" className="cursor-pointer font-normal hover-elevate">{ch.name}</Badge></Link>)}
                      {t.children.length > 40 && <Link href={`/browse?tn=${t.tn}`} className="text-xs text-primary">+{t.children.length - 40} more</Link>}
                    </div>
                  )}
                </div>
              ))}
              {c.trees.length === 0 && <p className="text-muted-foreground">No tree location.</p>}
            </div>
          </Section>

          {(c.pharmActions.length > 0 || c.paMembers.length > 0) && (
            <Section title="Pharmacologic actions (MeSH)" icon={Pill}>
              {c.pharmActions.length > 0 && <div className="flex flex-wrap gap-1.5">{c.pharmActions.map((p) => <Link key={p.id} href={`/concept/${p.id}`}><Badge className="cursor-pointer">{p.name}</Badge></Link>)}</div>}
              {c.paMembers.length > 0 && (
                <>
                  <div className="mb-1.5 mt-2 text-xs text-muted-foreground">{c.paMembers.length} substances have this action</div>
                  <div className="flex max-h-56 flex-wrap gap-1.5 overflow-auto">{c.paMembers.map((p) => <Link key={p.id} href={`/concept/${p.id}`}><Badge variant="outline" className="cursor-pointer font-normal">{p.name}</Badge></Link>)}</div>
                </>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-4">
          {c.drugs.length > 0 && (
            <Section title="FDA drug labels" icon={Pill}>
              <ul className="space-y-1.5">{c.drugs.map((d) => <li key={d.slug}><Link href={`/drugs/${d.slug}`} className="text-primary hover:underline">{d.generic}</Link>{d.brands.length > 0 && <span className="text-muted-foreground"> · {d.brands.slice(0, 3).join(", ")}</span>}</li>)}</ul>
            </Section>
          )}
          {(c.parts3d.length > 0 || c.models.length > 0) && (
            <Section title="3D models" icon={Box}>
              {systems.map((s) => (
                <Button key={s} asChild variant="outline" size="sm" className="mb-2 mr-2"><Link href={`/atlas?system=${s}&focus=${c.parts3d.filter((p) => p.system === s).map((p) => p.fj).join(",")}`} data-testid={`link-atlas-${s}`}><Box className="h-4 w-4" /> View in {s} atlas</Link></Button>
              ))}
              {c.models.map((m) => <Button key={m.id} asChild variant="outline" size="sm" className="mb-2 mr-2"><Link href={`/pathogens?id=${m.id}`}><Bug className="h-4 w-4" /> {m.title}</Link></Button>)}
            </Section>
          )}
          {c.topics.length > 0 && (
            <Section title="Patient-level summary (MedlinePlus)" icon={BookOpenText}>
              {c.topics.map((t) => <div key={t.id} className="mb-2"><Link href={`/topics/${t.id}`} className="font-medium text-primary hover:underline">{t.title}</Link><p className="line-clamp-3 text-muted-foreground">{t.meta_desc}</p></div>)}
            </Section>
          )}
          {c.icd10.length > 0 && (
            <Section title="Related ICD-10-CM codes" icon={FileCode2}>
              <p className="mb-2 text-xs text-muted-foreground">Text matches on the code title, not an official MeSH-to-ICD crosswalk. Verify before coding.</p>
              <ul className="space-y-1">{c.icd10.map((i) => <li key={i.code} className="flex gap-2"><Link href={`/icd10/${i.code}`} className="w-16 shrink-0 font-mono text-primary">{i.display}</Link><span>{i.title}</span></li>)}</ul>
            </Section>
          )}
          {c.seeAlso.length > 0 && (
            <Section title="See also">
              <div className="flex flex-wrap gap-1.5">{c.seeAlso.map((s) => <Link key={s.id} href={`/concept/${s.id}`}><Badge variant="outline" className="cursor-pointer font-normal">{s.name}</Badge></Link>)}</div>
            </Section>
          )}
          <Section title="Further reading">
            <ul className="space-y-1.5">
              <li><Link href={`/research?q=${encodeURIComponent(c.name)}`} className="text-primary hover:underline">PubMed articles on {c.name}</Link></li>
              {c.cats.includes("C") && <li><Link href={`/trials?q=${encodeURIComponent(c.name)}`} className="text-primary hover:underline">Clinical trials for {c.name}</Link></li>}
              <li><ExtLink href={c.source.url}>MeSH record {c.id}</ExtLink></li>
            </ul>
          </Section>
        </div>
      </div>
      <SourceLine name={c.source.name} url={c.source.url} date={`Heading introduced ${c.introduced || "—"}${c.updated ? `, revised ${c.updated}` : ""}`} note="Public domain" />
    </div>
  );
}
