import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, Pager, SourceLine, useDebounced } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";
import { stripClass } from "@/lib/meta";

type Row = { slug: string; generic: string; brands: string[]; epc: string[]; routes: string[]; boxed: boolean; mesh_id: string | null };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Drugs() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q.trim(), 300);
  const letter = params.get("letter") || "";
  const boxed = params.get("boxed") === "1";
  const page = Number(params.get("page") || 0);
  useEffect(() => {
    if (dq !== (params.get("q") || "")) update({ q: dq, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const r = useQuery<{ total: number; page: number; size: number; rows: Row[] }>({
    queryKey: ["/api/drugs", { q: dq, letter: dq ? "" : letter, boxed: boxed ? "1" : "", page }],
  });

  return (
    <div>
      <PageHeader
        title="Drugs"
        subtitle="Current FDA prescribing information for human prescription drugs: indications, dosing, boxed warnings, contraindications, mechanism, pharmacokinetics and every marketed NDC product. One record per active ingredient."
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by generic, brand, class or indication (e.g. “SGLT2”, “Eliquis”, “heart failure”)" className="pl-9" data-testid="input-drug-search" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="boxed" checked={boxed} onCheckedChange={(v) => update({ boxed: v ? "1" : null, page: null })} data-testid="switch-boxed" />
          <Label htmlFor="boxed" className="text-sm">Boxed warning only</Label>
        </div>
      </div>
      {!dq && (
        <div className="mb-4 flex flex-wrap gap-1" data-testid="nav-letters">
          <button onClick={() => update({ letter: null, page: null })} className={`rounded px-2 py-1 text-xs ${!letter ? "bg-primary text-primary-foreground" : "hover-elevate"}`} data-testid="button-letter-all">All</button>
          {LETTERS.map((l) => (
            <button key={l} onClick={() => update({ letter: l, page: null })} className={`w-7 rounded py-1 text-xs ${letter === l ? "bg-primary text-primary-foreground" : "hover-elevate"}`} data-testid={`button-letter-${l}`}>{l}</button>
          ))}
        </div>
      )}
      {r.isLoading ? <ListSkeleton rows={10} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data!.rows.length === 0 ? (
        <EmptyState title="No drugs match">Try the generic name, a brand, or a class such as “beta blocker”.</EmptyState>
      ) : (
        <>
          <div className="divide-y rounded-lg border bg-card" data-testid="list-drugs">
            {r.data!.rows.map((d) => (
              <Link key={d.slug} href={`/drugs/${d.slug}`} className="flex flex-col gap-1 px-4 py-3 hover-elevate sm:flex-row sm:items-center sm:gap-4" data-testid={`link-drug-${d.slug}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.generic}</span>
                    {d.boxed && <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive"><AlertTriangle className="h-3 w-3" /> Boxed warning</Badge>}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{d.brands.length ? d.brands.slice(0, 5).join(", ") : "Generic label"}</div>
                </div>
                <div className="flex flex-wrap gap-1 sm:max-w-[45%] sm:justify-end">
                  {d.epc.slice(0, 2).map((e) => <Badge key={e} variant="secondary" className="font-normal">{stripClass(e)}</Badge>)}
                </div>
              </Link>
            ))}
          </div>
          <Pager page={page} total={r.data!.total} size={r.data!.size} onPage={(p) => update({ page: p || null }, false)} />
        </>
      )}
      <SourceLine name="openFDA drug labeling (Structured Product Labeling) and NDC directory, U.S. FDA" url="https://open.fda.gov/apis/drug/label/" note="Public domain" />
    </div>
  );
}
