import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ListChecks, PackageSearch } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, ErrorState, SourceLine, BookmarkButton, AddCardButton, LabelText, ExtLink } from "@/components/common";
import { fmtDate, stripClass } from "@/lib/meta";

type D = {
  slug: string; generic: string; brands: string[]; routes: string[]; epc: string[]; moa: string[]; pe: string[]; cs: string[];
  manufacturer: string; effective: string; setId: string;
  sections: { key: string; label: string; text: string }[];
  products: { product_ndc: string; brand: string; generic: string; labeler: string; dosage_form: string; route: string; strength: string; dea: string | null; marketing: string }[];
  productTotal: number;
  shortages: { generic: string; presentation: string; company: string; status: string; availability: string; updated: string; reason: string }[];
  mesh: { id: string; name: string; scopeNote: string; pharmActions: { id: string; name: string }[] } | null;
  questionCount: number;
  source: { name: string; url: string; effective: string };
};

const OPEN_BY_DEFAULT = ["boxed_warning", "indications_and_usage", "mechanism_of_action", "contraindications"];

export default function DrugPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");
  const [boxedOpen, setBoxedOpen] = useState(false);
  const r = useQuery<D>({ queryKey: ["/api/drugs", slug] });
  if (r.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const d = r.data!;
  const boxed = d.sections.find((s) => s.key === "boxed_warning");
  const ind = d.sections.find((s) => s.key === "indications_and_usage");
  const products = d.products.filter((p) => !filter || `${p.brand} ${p.labeler} ${p.strength} ${p.dosage_form} ${p.product_ndc}`.toLowerCase().includes(filter.toLowerCase()));
  const classes = [...d.epc, ...d.moa, ...d.pe, ...d.cs];
  const currentShort = d.shortages.filter((s) => s.status === "Current");

  return (
    <div>
      <PageHeader
        eyebrow="FDA prescribing information"
        title={d.generic}
        subtitle={d.brands.length ? `Brand names: ${d.brands.join(", ")}` : undefined}
        actions={
          <>
            <BookmarkButton type="drug" refId={d.slug} title={d.generic} />
            <AddCardButton
              front={`${d.generic}: class, mechanism and key indication?`}
              back={[d.epc.length ? `Class: ${d.epc.map(stripClass).join(", ")}` : "", d.moa.length ? `Mechanism: ${d.moa.map(stripClass).join(", ")}` : "", ind ? `Indication: ${ind.text.replace(/^\s*\d*\s*INDICATIONS (AND|&) USAGE\s*/i, "").slice(0, 300)}` : ""].filter(Boolean).join("\n")}
              deck="Pharmacology" sourceType="drug" sourceId={d.slug}
            />
            {d.questionCount > 0 && <Button size="sm" onClick={() => navigate(`/qbank?concept=${[d.slug, d.mesh?.id].filter(Boolean).join(",")}`)} data-testid="button-practice-drug"><ListChecks className="h-4 w-4" /> Practice ({d.questionCount})</Button>}
          </>
        }
      />

      {boxed && (
        <div className="mb-4 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4" data-testid="box-boxed-warning">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Boxed warning</div>
          <LabelText text={boxedOpen || boxed.text.length <= 700 ? boxed.text : boxed.text.slice(0, 650).replace(/\s+\S*$/, "") + " …"} />
          {boxed.text.length > 700 && (
            <button className="mt-2 text-sm font-medium text-destructive hover:underline" onClick={() => setBoxedOpen(!boxedOpen)} data-testid="button-boxed-toggle">
              {boxedOpen ? "Show less" : "Read the full boxed warning"}
            </button>
          )}
        </div>
      )}
      {currentShort.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="box-shortage">
          <span className="font-medium">Current FDA shortage:</span> {currentShort.length} presentation{currentShort.length > 1 ? "s" : ""} listed. See the Shortages tab.
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Pharmacologic class (FDA)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">{classes.length ? classes.map((c) => <Badge key={c} variant={c.endsWith("[EPC]") ? "default" : "secondary"} className="font-normal">{stripClass(c)}<span className="ml-1 opacity-60">{c.match(/\[(\w+)\]$/)?.[1]}</span></Badge>) : <span className="text-sm text-muted-foreground">Not assigned on the label</span>}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Routes</CardTitle></CardHeader>
          <CardContent className="text-sm">{d.routes.join(", ") || "—"}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">Label version</CardTitle></CardHeader>
          <CardContent className="text-sm">{d.manufacturer || "—"}<div className="text-xs text-muted-foreground">Effective {fmtDate(d.effective)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="label">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="label" data-testid="tab-label">Label sections ({d.sections.length})</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Products ({d.productTotal})</TabsTrigger>
          <TabsTrigger value="shortages" data-testid="tab-shortages">Shortages ({d.shortages.length})</TabsTrigger>
          {d.mesh && <TabsTrigger value="mesh" data-testid="tab-mesh">MeSH</TabsTrigger>}
        </TabsList>
        <TabsContent value="label">
          <Accordion type="multiple" defaultValue={OPEN_BY_DEFAULT.filter((k) => k !== "boxed_warning")} className="rounded-lg border bg-card px-4">
            {d.sections.filter((s) => s.key !== "boxed_warning").map((s) => (
              <AccordionItem key={s.key} value={s.key}>
                <AccordionTrigger className="text-sm font-medium" data-testid={`accordion-${s.key}`}>{s.label}</AccordionTrigger>
                <AccordionContent><LabelText text={s.text} /></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
        <TabsContent value="products">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by brand, labeler, strength or NDC" className="max-w-sm" data-testid="input-product-filter" />
            {d.productTotal > d.products.length && <span className="text-xs text-muted-foreground">Showing first {d.products.length} of {d.productTotal}</span>}
          </div>
          {products.length === 0 ? <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground"><PackageSearch className="h-4 w-4" /> No listed products match.</div> : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>NDC</TableHead><TableHead>Brand</TableHead><TableHead>Strength</TableHead><TableHead>Form / route</TableHead><TableHead>Labeler</TableHead><TableHead>Application</TableHead></TableRow></TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.product_ndc + p.strength}>
                      <TableCell className="font-mono text-xs">{p.product_ndc}</TableCell>
                      <TableCell className="text-sm">{p.brand}{p.dea && <Badge variant="outline" className="ml-1 text-[10px]">DEA {p.dea}</Badge>}</TableCell>
                      <TableCell className="text-xs">{p.strength}</TableCell>
                      <TableCell className="text-xs">{p.dosage_form}<div className="text-muted-foreground">{p.route}</div></TableCell>
                      <TableCell className="text-xs">{p.labeler}</TableCell>
                      <TableCell className="text-xs">{p.marketing}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <SourceLine name="FDA National Drug Code Directory (openFDA)" url="https://open.fda.gov/apis/drug/ndc/" />
        </TabsContent>
        <TabsContent value="shortages">
          {d.shortages.length === 0 ? <div className="rounded-lg border p-6 text-sm text-muted-foreground">No shortage records for this ingredient in the FDA drug shortage database.</div> : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Presentation</TableHead><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.shortages.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{s.presentation}</TableCell>
                      <TableCell className="text-xs">{s.company}</TableCell>
                      <TableCell><Badge variant={s.status === "Current" ? "destructive" : "secondary"} className="font-normal">{s.status}</Badge><div className="mt-1 text-[11px] text-muted-foreground">{s.availability}</div></TableCell>
                      <TableCell className="text-xs">{fmtDate(s.updated)}</TableCell>
                      <TableCell className="max-w-xs text-xs">{s.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <SourceLine name="FDA Drug Shortages (openFDA)" url="https://open.fda.gov/apis/drug/drugshortages/" />
        </TabsContent>
        {d.mesh && (
          <TabsContent value="mesh">
            <Card><CardContent className="space-y-3 pt-4 text-sm">
              <div><Link href={`/concept/${d.mesh.id}`} className="font-medium text-primary hover:underline">{d.mesh.name}</Link> <span className="font-mono text-xs text-muted-foreground">{d.mesh.id}</span></div>
              <p className="leading-relaxed">{d.mesh.scopeNote}</p>
              {d.mesh.pharmActions.length > 0 && <div className="flex flex-wrap gap-1.5">{d.mesh.pharmActions.map((p) => <Link key={p.id} href={`/concept/${p.id}`}><Badge className="cursor-pointer font-normal">{p.name}</Badge></Link>)}</div>}
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
      <p className="mt-4 text-xs text-muted-foreground">Text is reproduced from the FDA-approved labeling for one representative product. Formulations differ; always confirm with the current label for the specific product.</p>
      <SourceLine name={d.source.name} url={d.source.url} date={`Label effective ${fmtDate(d.effective)}`} note={d.setId ? `DailyMed set ID ${d.setId}` : undefined} />
      {d.setId && <div className="mt-2 text-xs"><ExtLink href={d.source.url}>Open the full label on DailyMed</ExtLink></div>}
    </div>
  );
}
