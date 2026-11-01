import { assetUrl } from "@/lib/queryClient";
import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Atom, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, EmptyState, Pager, BookmarkButton, ReportButton, useDebounced } from "@/components/common";
import { MolViewer } from "@/components/mol-viewer";
import { useHashQuery } from "@/lib/hash-query";

export function Formula({ f }: { f: string | null }) {
  if (!f) return null;
  return <span className="font-mono">{f.split(/(\d+)/).map((p, i) => (/^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>))}</span>;
}

export function MoleculesPage() {
  const [params, setParams] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q, 300);
  const page = Number(params.get("page") || 0);
  useEffect(() => { if ((params.get("q") || "") !== dq) setParams({ q: dq || null, page: null }); /* eslint-disable-next-line */ }, [dq]);
  const d = useQuery<any>({ queryKey: [`/api/compounds?q=${encodeURIComponent(dq)}&page=${page}`] });
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="3D models" title="Drug molecules"
        subtitle="The active ingredient of every FDA-labelled drug matched to PubChem: formula, molecular weight, IUPAC name, SMILES, drug-likeness properties, an expert description, and an interactive 3D conformer." />
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, formula or IUPAC — e.g. metformin, C9H8O4" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-molecule-search" />
      </div>
      {d.isLoading ? <ListSkeleton rows={8} /> : d.isError ? <ErrorState error={d.error} onRetry={() => d.refetch()} /> : !d.data.available ? (
        <EmptyState title="Molecule data not built">Run <code>python3 etl/pubchem.py</code> to fetch compound data from PubChem.</EmptyState>
      ) : !d.data.rows.length ? <EmptyState title="No molecules match" /> : (
        <>
          <div className="text-sm text-muted-foreground">{d.data.total.toLocaleString()} compounds</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {d.data.rows.map((c: any) => (
              <Link key={c.cid} href={`/molecules/${c.cid}`} data-testid={`card-molecule-${c.cid}`}>
                <Card className="h-full hover-elevate"><CardContent className="flex gap-3 p-3">
                  {c.hasSvg ? <img src={assetUrl(`/api/compounds/${c.cid}/svg`)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded bg-white object-contain" />
                    : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted text-center text-[10px] leading-tight text-muted-foreground"><Atom className="mb-0.5 h-4 w-4" /></div>}
                  <div className="min-w-0">
                    <div className="truncate font-medium capitalize">{c.name || c.title || `CID ${c.cid}`}</div>
                    {c.name && c.title && c.title.toLowerCase() !== c.name.toLowerCase() && <div className="truncate text-xs text-muted-foreground" title={c.title}>{c.title}</div>}
                    <div className="text-sm"><Formula f={c.formula} /></div>
                    <div className="text-xs text-muted-foreground">{c.mw ? `${Number(c.mw).toFixed(2)} g/mol` : ""}{c.ndrugs ? ` · ${c.ndrugs} product${c.ndrugs === 1 ? "" : "s"}` : ""}</div>
                  </div>
                </CardContent></Card>
              </Link>
            ))}
          </div>
          <Pager page={page} total={d.data.total} size={d.data.size} onPage={(p) => setParams({ page: p ? String(p) : null })} />
        </>
      )}
      <p className="text-xs text-muted-foreground">Data: <ExtLink href="https://pubchem.ncbi.nlm.nih.gov">PubChem</ExtLink> (NCBI, U.S. National Library of Medicine), public domain; descriptions keep their original source attribution. Biologics such as antibodies and vaccines have no small-molecule structure.</p>
    </div>
  );
}

const PROP: [string, string, (v: any) => string][] = [
  ["mw", "Molecular weight", (v) => `${Number(v).toFixed(2)} g/mol`],
  ["exact_mass", "Exact mass", (v) => `${Number(v).toFixed(4)} Da`],
  ["xlogp", "XLogP3 (lipophilicity)", (v) => String(v)],
  ["tpsa", "Topological polar surface area", (v) => `${v} Å²`],
  ["hbd", "H-bond donors", String],
  ["hba", "H-bond acceptors", String],
  ["rotb", "Rotatable bonds", String],
  ["heavy_atoms", "Heavy atoms", String],
  ["charge", "Formal charge", String],
];

export function PropsTable({ c }: { c: any }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {PROP.filter(([k]) => c[k] != null).map(([k, l, f]) => (<Fragment key={k}><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{f(c[k])}</span></Fragment>))}
    </div>
  );
}

export function lipinski(c: any) {
  const v = [c.mw > 500, c.xlogp != null && c.xlogp > 5, c.hbd > 5, c.hba > 10].filter(Boolean).length;
  return v;
}

export function MoleculePage() {
  const { cid } = useParams<{ cid: string }>();
  const d = useQuery<any>({ queryKey: [`/api/compounds/${cid}`] });
  if (d.isLoading) return <ListSkeleton rows={10} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const c = d.data;
  const lv = lipinski(c);
  return (
    <div className="space-y-4">
      <Link href="/molecules" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-molecules"><ArrowLeft className="h-4 w-4" />Drug molecules</Link>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1"><Atom className="h-3.5 w-3.5" />PubChem CID {c.cid}</span>} title={c.title || `CID ${c.cid}`}
        subtitle={<span className="text-base"><Formula f={c.formula} /></span>}
        actions={<div className="flex gap-1.5"><BookmarkButton type="molecule" refId={String(c.cid)} title={c.title} /><ReportButton type="molecule" refId={String(c.cid)} title={c.title} variant="outline" /></div>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card><CardContent className="space-y-3 p-3"><MolViewer cid={c.cid} height={440} />
          {c.hasSvg && <div className="flex items-center gap-3 rounded-md border p-2"><img src={assetUrl(`/api/compounds/${c.cid}/svg`)} alt={`2D structure of ${c.title}`} className="h-40 w-40 rounded bg-white object-contain" data-testid="img-structure-2d" /><p className="text-xs text-muted-foreground">2D skeletal formula drawn from the PubChem SMILES with RDKit. Rotate the 3D conformer above to see the spatial arrangement.</p></div>}
        </CardContent></Card>
        <div className="space-y-3">
          <Card><CardContent className="space-y-3 p-4">
            <PropsTable c={c} />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={lv <= 1 ? "secondary" : "outline"}>Lipinski rule-of-five violations: {lv}</Badge>
            </div>
            {c.iupac && <div className="text-xs"><div className="text-muted-foreground">IUPAC name</div><div className="break-words font-mono">{c.iupac}</div></div>}
            {c.smiles && <div className="text-xs"><div className="text-muted-foreground">SMILES</div><div className="break-all font-mono">{c.smiles}</div></div>}
            {c.inchikey && <div className="text-xs"><div className="text-muted-foreground">InChIKey</div><div className="break-all font-mono">{c.inchikey}</div></div>}
            <ExtLink href={c.url}>Full record on PubChem</ExtLink>
          </CardContent></Card>
        </div>
      </div>
      {c.descriptions?.length > 0 && (
        <Card><CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Description</h2>
          {c.descriptions.map((x: any, i: number) => (
            <div key={i} className="text-sm leading-relaxed">
              <p>{x.text}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Source: {x.url ? <ExtLink href={x.url}>{x.source}</ExtLink> : x.source}</p>
            </div>
          ))}
        </CardContent></Card>
      )}
      {c.drugs?.length > 0 && (
        <Card><CardContent className="p-4">
          <h2 className="mb-2 font-semibold">FDA-labelled products containing this ingredient ({c.drugs.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {c.drugs.map((dr: any) => <Link key={dr.slug} href={`/drugs/${dr.slug}`} className="rounded-md border px-2 py-1 text-sm hover-elevate" data-testid={`link-mol-drug-${dr.slug}`}>{dr.generic}{dr.brands?.length ? <span className="text-muted-foreground"> · {dr.brands.slice(0, 2).join(", ")}</span> : null}</Link>)}
          </div>
        </CardContent></Card>
      )}
      <p className="text-xs text-muted-foreground">Structure and properties: PubChem (NCBI), public domain. 3D conformers are computed by PubChem (MMFF94s) and represent one low-energy shape, not necessarily the receptor-bound pose.</p>
    </div>
  );
}

/** Molecule section embedded on a drug page. */
export function DrugMolecules({ slug }: { slug: string }) {
  const d = useQuery<{ compounds: any[] }>({ queryKey: [`/api/drugs/${slug}/compounds`] });
  const [i, setI] = useState(0);
  const list = (d.data?.compounds ?? []).filter((c) => c.cid);
  if (!list.length) return null;
  const c = list[Math.min(i, list.length - 1)];
  return (
    <Card data-testid="section-drug-molecule"><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Molecular structure</h2>
        {list.length > 1 && <div className="flex flex-wrap gap-1">{list.map((x, j) => <button key={x.cid} onClick={() => setI(j)} className={`rounded-md border px-2 py-0.5 text-xs ${j === i ? "bg-primary text-primary-foreground" : "hover-elevate"}`} data-testid={`button-ingredient-${x.cid}`}>{x.ingredient}</button>)}</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <MolViewer key={c.cid} cid={c.cid} height={320} />
        <div className="space-y-2">
          <div className="font-medium">{c.title || c.ingredient} <span className="text-sm"><Formula f={c.formula} /></span></div>
          <PropsTable c={c} />
          {c.descriptions?.[0] && <p className="text-xs leading-relaxed text-muted-foreground">{c.descriptions[0].text.slice(0, 400)}{c.descriptions[0].text.length > 400 ? "…" : ""} ({c.descriptions[0].source})</p>}
          <Link href={`/molecules/${c.cid}`} className="text-sm text-primary hover:underline" data-testid="link-molecule-detail">Full molecule page</Link>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">PubChem CID {c.cid} (NCBI, public domain), matched from the label's active ingredient "{c.ingredient}".</p>
    </CardContent></Card>
  );
}
