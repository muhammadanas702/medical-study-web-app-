import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderTree } from "lucide-react";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, SourceLine } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";
import { MESH_CATS } from "@/lib/meta";

type Node = { tn: string; id: string | null; name: string; nchild: number; snippet?: string };
type TreeR = { node: (Node & { depth: number }) | null; path: Node[]; children: Node[] };

export default function Browse() {
  const [params, update] = useHashQuery();
  const parent = params.get("tn") || "";
  const r = useQuery<TreeR>({ queryKey: ["/api/tree", { parent }] });

  return (
    <div>
      <PageHeader
        title="MeSH concept browser"
        subtitle="All 2026 Medical Subject Headings descriptors in categories A–G, arranged in NLM's official hierarchy. Open any term for its definition, synonyms, related drugs, 3D structures and practice questions."
      />
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
        <button className="text-primary hover:underline" onClick={() => update({ tn: null }, false)} data-testid="button-crumb-root">All categories</button>
        {r.data?.path.map((p) => (
          <span key={p.tn} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            {p.tn === parent ? <span className="font-medium">{p.name}</span> : (
              <button className="text-primary hover:underline" onClick={() => update({ tn: p.tn }, false)} data-testid={`button-crumb-${p.tn}`}>{p.name}</button>
            )}
          </span>
        ))}
      </nav>

      {r.isLoading ? <ListSkeleton rows={8} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : !parent ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="list-categories">
          {r.data!.children.map((c) => {
            const m = MESH_CATS[c.tn];
            const Icon = m?.icon ?? FolderTree;
            return (
              <button key={c.tn} onClick={() => update({ tn: c.tn }, false)} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left hover-elevate" data-testid={`button-category-${c.tn}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></div>
                <div>
                  <div className="font-medium">{m?.label ?? c.name}</div>
                  <div className="text-xs text-muted-foreground">{m?.desc}</div>
                  <div className="mt-1 text-xs text-muted-foreground tabular">{c.nchild} top-level branches</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          {r.data!.node?.id && (
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <div className="font-medium">{r.data!.node.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{r.data!.node.tn}</div>
              </div>
              <Link href={`/concept/${r.data!.node.id}`} className="text-sm text-primary hover:underline" data-testid="link-open-concept">Open concept</Link>
            </div>
          )}
          {r.data!.children.length === 0 ? (
            <div className="p-4"><EmptyState title="No narrower terms">This is the most specific heading in this branch.</EmptyState></div>
          ) : (
            <div className="divide-y" data-testid="list-tree-children">
              {r.data!.children.map((c) => (
                <div key={c.tn} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    {c.id ? (
                      <Link href={`/concept/${c.id}`} className="font-medium hover:text-primary hover:underline" data-testid={`link-concept-${c.tn}`}>{c.name}</Link>
                    ) : <span className="font-medium">{c.name}</span>}
                    {c.snippet && <p className="line-clamp-1 text-xs text-muted-foreground">{c.snippet}</p>}
                  </div>
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{c.tn}</span>
                  {c.nchild > 0 && (
                    <button onClick={() => update({ tn: c.tn }, false)} className="flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-primary hover-elevate" data-testid={`button-expand-${c.tn}`}>
                      {c.nchild} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <SourceLine name="Medical Subject Headings (MeSH) 2026, U.S. National Library of Medicine" url="https://www.nlm.nih.gov/mesh/meshhome.html" note="Public domain" />
    </div>
  );
}
