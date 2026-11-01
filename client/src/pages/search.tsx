import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Pill, FileCode2, Stethoscope, BookOpenText, Network } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, useDebounced } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";
import { MESH_CATS, stripClass, DEVICE_CLASS } from "@/lib/meta";

type R = {
  q: string;
  concepts: { id: string; name: string; cats: string; snippet: string }[];
  drugs: { slug: string; generic: string; brands: string[]; epc: string[] }[];
  icd10: { code: string; display: string; title: string; billable: number }[];
  devices: { code: string; name: string; class: string; specialty: string }[];
  topics: { id: string; title: string; meta_desc: string }[];
};

function Group({ title, icon: Icon, count, children }: { title: string; icon: typeof Pill; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {title} <span className="text-muted-foreground">({count})</span>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export default function SearchPage() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  useEffect(() => setQ(params.get("q") || ""), [params]);
  const dq = useDebounced(q.trim(), 250);
  useEffect(() => {
    if (dq !== (params.get("q") || "")) update({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const r = useQuery<R>({ queryKey: ["/api/search", { q: dq }], enabled: dq.length >= 2 });
  const d = r.data;
  const total = d ? d.concepts.length + d.drugs.length + d.icd10.length + d.devices.length + d.topics.length : 0;

  return (
    <div>
      <PageHeader title="Search everything" subtitle="One search across MeSH concepts, FDA drug labels, ICD-10-CM codes, FDA device types and MedlinePlus topics. Matches names, synonyms and definitions." />
      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. nephrotic syndrome, metoprolol, E11.9, pacemaker, Plasmodium" className="h-11 pl-9 text-base" data-testid="input-search" />
      </div>
      {dq.length < 2 ? (
        <EmptyState title="Type at least two characters">Try a disease (“Kawasaki”), a drug (“warfarin”), an organism (“Listeria”), an ICD-10 code (“I21.4”) or a device (“defibrillator”).</EmptyState>
      ) : r.isLoading ? (
        <ListSkeleton />
      ) : r.isError ? (
        <ErrorState error={r.error} onRetry={() => r.refetch()} />
      ) : total === 0 ? (
        <EmptyState title={`No results for “${dq}”`}>Check the spelling or try a broader term. Abbreviations such as “MI” or “COPD” are matched through MeSH entry terms.</EmptyState>
      ) : (
        <div className="space-y-4" data-testid="list-search-results">
          <Group title="MeSH concepts" icon={Network} count={d!.concepts.length}>
            {d!.concepts.map((c) => (
              <Link key={c.id} href={`/concept/${c.id}`} className="block px-4 py-3 hover-elevate" data-testid={`link-concept-${c.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.cats.split("").filter((x) => MESH_CATS[x]).map((x) => <Badge key={x} variant="secondary" className="text-[11px]">{MESH_CATS[x].short}</Badge>)}
                </div>
                {c.snippet && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{c.snippet}</p>}
              </Link>
            ))}
          </Group>
          <Group title="Drugs" icon={Pill} count={d!.drugs.length}>
            {d!.drugs.map((x) => (
              <Link key={x.slug} href={`/drugs/${x.slug}`} className="block px-4 py-3 hover-elevate" data-testid={`link-drug-${x.slug}`}>
                <div className="font-medium">{x.generic}</div>
                <div className="text-sm text-muted-foreground">{[x.epc.map(stripClass).join(", "), x.brands.slice(0, 4).join(", ")].filter(Boolean).join(" · ") || "FDA label"}</div>
              </Link>
            ))}
          </Group>
          <Group title="ICD-10-CM" icon={FileCode2} count={d!.icd10.length}>
            {d!.icd10.map((x) => (
              <Link key={x.code} href={`/icd10/${x.code}`} className="flex items-baseline gap-3 px-4 py-2.5 hover-elevate" data-testid={`link-icd-${x.code}`}>
                <span className="w-20 shrink-0 font-mono text-sm font-medium text-primary">{x.display}</span>
                <span className="text-sm">{x.title}</span>
              </Link>
            ))}
          </Group>
          <Group title="Medical devices" icon={Stethoscope} count={d!.devices.length}>
            {d!.devices.map((x) => (
              <Link key={x.code} href={`/devices/${x.code}`} className="block px-4 py-2.5 hover-elevate" data-testid={`link-device-${x.code}`}>
                <div className="text-sm font-medium">{x.name}</div>
                <div className="text-xs text-muted-foreground">{x.specialty} · {DEVICE_CLASS[x.class] ?? `Class ${x.class}`}</div>
              </Link>
            ))}
          </Group>
          <Group title="MedlinePlus health topics" icon={BookOpenText} count={d!.topics.length}>
            {d!.topics.map((x) => (
              <Link key={x.id} href={`/topics/${x.id}`} className="block px-4 py-2.5 hover-elevate" data-testid={`link-topic-${x.id}`}>
                <div className="text-sm font-medium">{x.title}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{x.meta_desc}</div>
              </Link>
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
