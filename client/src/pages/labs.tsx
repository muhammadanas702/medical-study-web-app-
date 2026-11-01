import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, SourceLine } from "@/components/common";
import { fmtDate } from "@/lib/meta";

type Lab = { id: number; section: string; subsection: string | null; test: string; conventional: string; si: string };

export default function Labs() {
  const r = useQuery<{ rows: Lab[]; source: { source: string; url: string; retrieved: string } }>({ queryKey: ["/api/labs"] });
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const rows = (r.data?.rows || []).filter((x) => !q || `${x.test} ${x.section} ${x.subsection}`.toLowerCase().includes(q.toLowerCase()));
    const m = new Map<string, Lab[]>();
    for (const x of rows) m.set(x.section, [...(m.get(x.section) || []), x]);
    return Array.from(m);
  }, [r.data, q]);
  return (
    <div>
      <PageHeader title="Laboratory reference values" subtitle="The reference ranges provided on NBME and USMLE examinations, in conventional and SI units. Exam questions in this app use these values." />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tests (e.g. “calcium”, “TSH”)" className="pl-9" data-testid="input-lab-filter" />
      </div>
      {r.isLoading ? <ListSkeleton /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : groups.length === 0 ? <EmptyState title="No tests match" /> : (
        <div className="space-y-5">
          {groups.map(([section, rows]) => (
            <section key={section}>
              <h2 className="mb-2 text-sm font-semibold">{section}</h2>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[45%]">Test</TableHead><TableHead>Conventional units</TableHead><TableHead>SI units</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((x, i) => (
                      <TableRow key={x.id} data-testid={`row-lab-${x.id}`}>
                        <TableCell className="text-sm">
                          {x.subsection && (i === 0 || rows[i - 1].subsection !== x.subsection) && <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{x.subsection}</div>}
                          {x.test}
                        </TableCell>
                        <TableCell className="text-sm tabular">{x.conventional}</TableCell>
                        <TableCell className="text-sm tabular">{x.si}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}
      {r.data && <SourceLine name={r.data.source.source} url={r.data.source.url} date={`Retrieved ${fmtDate(r.data.source.retrieved)}`} note="Reference ranges vary by laboratory; use local ranges clinically" />}
    </div>
  );
}
