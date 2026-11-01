import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Maximize2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, BookmarkButton } from "@/components/common";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { assetUrl } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";

type M = { id: string; title: string; description: string | null; license: string; file: string; bytes: number; source_url: string; category: string; mesh_id: string | null; mesh_name: string | null; mesh_note: string | null };

function cleanDesc(d: string | null) {
  if (!d) return "";
  let t = d.split("<")[0].replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\.(?=[A-Z])/g, ". ");
  return t.replace(/ The first being$/, "").trim();
}

export default function PathogensPage() {
  const [params, setParams] = useHashQuery();
  const r = useQuery<{ models: M[] }>({ queryKey: ["/api/models"] });
  const viewer = useRef<ViewerHandle>(null);
  const [cur, setCur] = useState<string | null>(params.get("id"));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [spin, setSpin] = useState(true);
  const shown = useRef<string | null>(null);

  const models = r.data?.models ?? [];
  const m = models.find((x) => x.id === cur) ?? models[0];

  useEffect(() => {
    if (!m || !viewer.current || shown.current === m.id) return;
    const v = viewer.current;
    if (shown.current) v.unload(shown.current);
    shown.current = m.id;
    setLoading(true); setErr(null);
    v.load(m.id, assetUrl(`/models/pathogens/${m.file}`), null)
      .then(() => v.setAutoRotate(spin))
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  const pick = (id: string) => { setCur(id); setParams({ id }); };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="3D microbiology" title="Pathogen models"
        subtitle="Scientifically derived 3D models of viruses and bacteria from the NIH 3D repository (NIAID and contributors). Rotate and zoom to study capsid symmetry and virion structure." />
      {r.isError ? <ErrorState error={r.error} onRetry={() => r.refetch()} /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="order-2 lg:order-1">
            <CardContent className="space-y-1 p-3">
              {r.isLoading ? <ListSkeleton rows={8} /> : models.map((x) => (
                <button key={x.id} onClick={() => pick(x.id)} data-testid={`button-model-${x.id}`}
                  className={`w-full rounded-lg px-3 py-2 text-left hover-elevate ${m?.id === x.id ? "bg-primary/10" : ""}`}>
                  <div className={`text-sm font-medium ${m?.id === x.id ? "text-primary" : ""}`}>{x.title}</div>
                  <div className="text-xs text-muted-foreground">{x.mesh_name ?? "Pathogen"} · {x.license}</div>
                </button>
              ))}
            </CardContent>
          </Card>
          <div className="order-1 space-y-3 lg:order-2">
            <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-xl border bg-gradient-to-b from-slate-900 to-slate-950">
              <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-pathogen" />
              {(loading || r.isLoading) && <div className="absolute inset-x-0 top-3 flex justify-center"><Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading model…</Badge></div>}
              {err && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-200">Could not load this model: {err}</div>}
              <div className="absolute bottom-3 left-3 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
                <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
              </div>
            </div>
            {m && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold" data-testid="text-model-title">{m.title}</h2>
                      <div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="outline">{m.id}</Badge><Badge variant="outline">{m.license}</Badge><Badge variant="outline">{(m.bytes / 1e6).toFixed(1)} MB</Badge></div>
                    </div>
                    <BookmarkButton type="model" refId={m.id} title={m.title} />
                  </div>
                  {cleanDesc(m.description) && <p className="text-sm text-muted-foreground">{cleanDesc(m.description)}</p>}
                  {m.mesh_id && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">MeSH heading</div>
                      <Link href={`/concept/${m.mesh_id}`} className="font-medium text-primary hover:underline" data-testid="link-model-concept">{m.mesh_name}</Link>
                      {m.mesh_note && <p className="mt-1 text-muted-foreground">{m.mesh_note}{m.mesh_note.length >= 400 ? "…" : ""}</p>}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Source: <ExtLink href={m.source_url}>NIH 3D entry {m.id}</ExtLink>. License: {m.license}{m.license.startsWith("CC BY") ? " (attribution to the original creators listed on the NIH 3D entry)" : ""}. Models are scientific visualizations; colors are illustrative.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
