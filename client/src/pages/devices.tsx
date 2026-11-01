import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, Pager, SourceLine, useDebounced, BookmarkButton } from "@/components/common";
import { useHashQuery } from "@/lib/hash-query";
import { DEVICE_CLASS, fmtDate } from "@/lib/meta";

type Dev = { code: string; name: string; class: string; panel: string; specialty: string; regulation: string; definition: string | null; implant: number; life_sustain: number; submission: string };
type Src = { source: string; url: string; export_date: string };

function ClassBadge({ c }: { c: string }) {
  const tone = c === "3" ? "border-destructive/40 text-destructive" : c === "2" ? "border-warning/50 text-warning" : "";
  return <Badge variant="outline" className={`font-normal ${tone}`}>Class {c}</Badge>;
}

export function DevicesPage() {
  const [params, update] = useHashQuery();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q.trim(), 300);
  const cls = params.get("cls") || "";
  const specialty = params.get("specialty") || "";
  const page = Number(params.get("page") || 0);
  useEffect(() => {
    if (dq !== (params.get("q") || "")) update({ q: dq, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  const r = useQuery<{ total: number; size: number; rows: Dev[]; specialties: { v: string; n: number }[]; source: Src }>({ queryKey: ["/api/devices", { q: dq, cls, specialty, page }] });
  return (
    <div>
      <PageHeader title="Medical devices & equipment" subtitle="Every FDA device type with its risk class, review panel, regulation number and premarket pathway: from stethoscopes and sutures to ventilators, pacemakers and imaging systems." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search device types (e.g. “defibrillator”, “endotracheal tube”)" className="pl-9" data-testid="input-device-search" />
        </div>
        <Select value={cls || "all"} onValueChange={(v) => update({ cls: v === "all" ? null : v, page: null })}>
          <SelectTrigger data-testid="select-device-class"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All classes</SelectItem><SelectItem value="1">Class I</SelectItem><SelectItem value="2">Class II</SelectItem><SelectItem value="3">Class III</SelectItem><SelectItem value="U">Unclassified</SelectItem></SelectContent>
        </Select>
        <Select value={specialty || "all"} onValueChange={(v) => update({ specialty: v === "all" ? null : v, page: null })}>
          <SelectTrigger data-testid="select-device-specialty"><SelectValue placeholder="Specialty" /></SelectTrigger>
          <SelectContent className="max-h-72"><SelectItem value="all">All specialties</SelectItem>{r.data?.specialties.map((s) => <SelectItem key={s.v} value={s.v}>{s.v} ({s.n})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {r.isLoading ? <ListSkeleton rows={10} /> : r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : r.data!.rows.length === 0 ? <EmptyState title="No device types match" /> : (
        <>
          <div className="divide-y rounded-lg border bg-card" data-testid="list-devices">
            {r.data!.rows.map((d) => (
              <Link key={d.code} href={`/devices/${d.code}`} className="flex items-center gap-3 px-4 py-3 hover-elevate" data-testid={`link-device-${d.code}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.specialty} · 21 CFR {d.regulation || "—"} · {d.submission || "—"}</div>
                </div>
                {d.implant === 1 && <Badge variant="secondary" className="hidden font-normal sm:inline-flex">Implant</Badge>}
                {d.life_sustain === 1 && <Badge variant="secondary" className="hidden font-normal sm:inline-flex">Life-sustaining</Badge>}
                <ClassBadge c={d.class} />
              </Link>
            ))}
          </div>
          <Pager page={page} total={r.data!.total} size={r.data!.size} onPage={(p) => update({ page: p || null }, false)} />
        </>
      )}
      {r.data && <SourceLine name={r.data.source.source} url="https://open.fda.gov/apis/device/classification/" date={`Exported ${fmtDate(r.data.source.export_date)}`} note="Public domain" />}
    </div>
  );
}

export function DevicePage() {
  const { code } = useParams<{ code: string }>();
  const r = useQuery<Dev & { source: Src }>({ queryKey: ["/api/devices", code] });
  if (r.isLoading) return <Skeleton className="h-60" />;
  if (r.isError) return <ErrorState error={r.error} onRetry={() => r.refetch()} />;
  const d = r.data!;
  const rows: [string, React.ReactNode][] = [
    ["Product code", <span className="font-mono">{d.code}</span>],
    ["Device class", DEVICE_CLASS[d.class] ?? d.class],
    ["Medical specialty", d.specialty],
    ["Review panel", d.panel],
    ["Regulation", d.regulation ? <a className="text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://www.ecfr.gov/current/title-21/section-${d.regulation}`}>21 CFR {d.regulation}</a> : "—"],
    ["Premarket pathway", d.submission || "—"],
    ["Implantable", d.implant ? "Yes" : "No"],
    ["Life-sustaining / supporting", d.life_sustain ? "Yes" : "No"],
  ];
  return (
    <div>
      <PageHeader eyebrow="FDA device classification" title={d.name} actions={<BookmarkButton type="device" refId={d.code} title={d.name} />} />
      <Card><CardContent className="pt-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm">{v}</dd></div>)}
        </dl>
        {d.definition && <p className="mt-4 border-t pt-3 text-sm leading-relaxed">{d.definition}</p>}
      </CardContent></Card>
      <SourceLine name={d.source.source} url={d.source.url} date={`Exported ${fmtDate(d.source.export_date)}`} />
    </div>
  );
}
