import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Box, Bug, Image as ImageIcon, Layers, ListChecks, Pill, FileCode2, Network, FlaskConical, Stethoscope, BookOpenText, Flame, Library, Images, Atom, GraduationCap, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Stat } from "@/components/common";
import { useApp } from "@/lib/app-context";

type Stats = { counts: Record<string, any> };
type Analytics = { total: number; pct: number | null; firstTryPct: number | null; unique: number; bank: number; streak: number; avgSec: number | null; bySystem: { key: string; answered: number; pct: number }[] };

export default function Dashboard() {
  const { user } = useApp();
  const stats = useQuery<Stats>({ queryKey: ["/api/stats"] });
  const an = useQuery<Analytics>({ queryKey: ["/api/analytics"] });
  const due = useQuery<{ cards: unknown[] }>({ queryKey: ["/api/cards/due"] });
  const c = stats.data?.counts;
  const weakest = (an.data?.bySystem || []).filter((s) => s.answered >= 3).sort((a, b) => a.pct - b.pct).slice(0, 3);

  const library = [
    { href: "/subjects", icon: GraduationCap, label: "Subjects & specialties", n: 30, hint: "Basic sciences and clinical specialties" },
    { href: "/books", icon: Library, label: "Open textbooks", n: c?.books, hint: `${c?.bookSections?.toLocaleString() ?? "…"} sections · OpenStax` },
    { href: "/figures", icon: Images, label: "Textbook figures", n: c?.figures, hint: "Searchable, with hotspot annotations" },
    { href: "/browse", icon: Network, label: "MeSH concepts", n: c?.concepts, hint: "Anatomy, organisms, diseases, drugs, procedures" },
    { href: "/drugs", icon: Pill, label: "FDA drug labels", n: c?.drugs, hint: `${c ? c.ndc.toLocaleString() : "…"} NDC products` },
    { href: "/icd10", icon: FileCode2, label: "ICD-10-CM codes", n: c?.icd10, hint: "FY2027 code set" },
    { href: "/devices", icon: Stethoscope, label: "Device types", n: c?.devices, hint: "FDA classification" },
    { href: "/topics", icon: BookOpenText, label: "Health topics", n: c?.topics, hint: "MedlinePlus summaries" },
    { href: "/labs", icon: FlaskConical, label: "Lab values", n: c?.labs, hint: "NBME reference ranges" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={user ? `Welcome back, ${user.name.split(" ")[0]}` : "Your study desk"}
        subtitle="Practice USMLE-style questions, review flashcards on schedule, and look up anything in a library built from NLM, FDA and CMS data."
        actions={
          <>
            <Button asChild data-testid="button-start-qbank"><Link href="/qbank"><ListChecks className="h-4 w-4" /> Start a block</Link></Button>
            <Button asChild variant="outline" data-testid="button-review-cards"><Link href="/flashcards"><Layers className="h-4 w-4" /> Review cards</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {an.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Stat label="Questions answered" value={(an.data?.total ?? 0).toLocaleString()} hint={`${an.data?.unique ?? 0} unique of ${(an.data?.bank ?? 0).toLocaleString()}`} testId="text-answered" />
            <Stat label="First-attempt accuracy" value={an.data?.firstTryPct == null ? "—" : `${an.data.firstTryPct}%`} hint="Comparable to a first pass" testId="text-accuracy" />
            <Stat label="Cards due now" value={due.data ? due.data.cards.length : "…"} hint="Spaced repetition (SM-2)" testId="text-due" />
            <Stat label="Study streak" value={<span className="inline-flex items-center gap-1.5"><Flame className="h-4 w-4 text-chart-2" />{an.data?.streak ?? 0} d</span>} hint={an.data?.avgSec ? `${an.data.avgSec}s avg per question` : "Answer a question today"} testId="text-streak" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Progress through the bank</CardTitle></CardHeader>
          <CardContent>
            {an.data && an.data.total > 0 ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span>Unique questions seen</span><span className="tabular text-muted-foreground">{an.data.unique} / {an.data.bank.toLocaleString()}</span></div>
                  <Progress value={(an.data.unique / Math.max(1, an.data.bank)) * 100} />
                </div>
                {weakest.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm font-medium">Weakest systems</div>
                    <div className="space-y-2">
                      {weakest.map((w) => (
                        <div key={w.key} className="flex items-center gap-3 text-sm">
                          <span className="w-44 truncate">{w.key}</span>
                          <Progress value={w.pct} className="h-2 flex-1" />
                          <span className="w-12 text-right tabular">{w.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Link href="/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" data-testid="link-analytics">Open performance analytics <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No answers yet. Build a 10-question tutor block to get immediate explanations after each question; your accuracy by system and discipline will appear here.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Visual learning</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {[
              { href: "/atlas", icon: Box, label: "3D anatomy atlas", hint: `${c?.anatomyParts?.toLocaleString() ?? "…"} structures, ${c?.anatomyDescribed?.toLocaleString() ?? "…"} with descriptions` },
              { href: "/organs", icon: HeartPulse, label: "3D organ library", hint: `${c?.organModels ?? "…"} organs, ${c?.organStructures?.toLocaleString() ?? "…"} labelled parts` },
              { href: "/pathogens", icon: Bug, label: "Pathogen library", hint: `${c?.pathogens ?? "…"} organisms with 3D models and fact sheets` },
              { href: "/equipment", icon: Stethoscope, label: "3D devices & lab equipment", hint: "Clinical devices, lab apparatus, NIH open hardware" },
              { href: "/molecules", icon: Atom, label: "3D drug molecules", hint: `${c?.compounds?.toLocaleString() ?? "…"} PubChem compounds` },
              { href: "/diagrams", icon: ImageIcon, label: "High-yield diagrams", hint: "13 diagrams with hotspots and test-me mode" },
            ].map((x) => (
              <Link key={x.href} href={x.href} className="flex items-center gap-3 rounded-md p-2 hover-elevate" data-testid={`link-visual-${x.href.slice(1)}`}>
                <x.icon className="h-5 w-5 text-primary" />
                <div className="min-w-0"><div className="text-sm font-medium">{x.label}</div><div className="text-xs text-muted-foreground">{x.hint}</div></div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold">Reference library</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {library.map((x) => (
          <Link key={x.href} href={x.href} className="flex items-center gap-3 rounded-lg border bg-card p-4 hover-elevate" data-testid={`link-library-${x.href.slice(1)}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><x.icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{x.label}</div>
              <div className="text-xs text-muted-foreground"><span className="tabular font-medium text-foreground">{x.n == null ? "…" : x.n.toLocaleString()}</span> · {x.hint}</div>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Content is drawn from public-domain and openly licensed sources (MeSH 2026, MedlinePlus, openFDA, CMS ICD-10-CM FY2027, NBME lab values, BodyParts3D, NIH 3D, OpenStax, PubChem, Wikipedia). See <Link href="/sources" className="underline">Sources & methods</Link> for versions and licenses.
      </p>
    </div>
  );
}
