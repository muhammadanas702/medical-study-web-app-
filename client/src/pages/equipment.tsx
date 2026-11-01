import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Maximize2, RefreshCw, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, ExtLink, BookmarkButton, AddCardButton } from "@/components/common";
import { ThreeViewer, type ViewerHandle } from "@/components/three-viewer";
import { EQUIPMENT, buildEquipment, type EqPart } from "@/lib/equipment3d";
import { assetUrl } from "@/lib/queryClient";
import { useHashQuery } from "@/lib/hash-query";

type NihModel = { id: string; title: string; description: string | null; license: string; file: string; bytes: number; source_url: string; category: string };
const CATS = ["Clinical", "Airway", "Laboratory", "Open hardware"] as const;

export default function EquipmentPage() {
  const [params, setParams] = useHashQuery();
  const nih = useQuery<{ models: NihModel[] }>({ queryKey: ["/api/equipment-models"] });
  const item = params.get("item") || EQUIPMENT[0].id;
  const cat = params.get("cat") || "";
  const viewer = useRef<ViewerHandle>(null);
  const shown = useRef<string | null>(null);
  const [parts, setParts] = useState<EqPart[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const eq = EQUIPMENT.find((e) => e.id === item);
  const nm = nih.data?.models.find((m) => m.id === item);

  useEffect(() => {
    const v = viewer.current; if (!v) return;
    if (shown.current === item) return;
    if (!eq && !nm) return;
    if (shown.current) v.unload(shown.current);
    shown.current = item; setSel(null); setErr(null);
    if (eq) { const b = buildEquipment(eq.id)!; v.add(item, b.group); setParts(b.parts); v.setAutoRotate(spin); return; }
    setParts([]); setLoading(true);
    v.load(item, assetUrl(`/models/pathogens/${nm!.file}`), null).then(() => v.setAutoRotate(spin)).catch((e) => setErr(String(e?.message ?? e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, eq, nm]);

  const choose = (n: string | null) => { setSel(n); viewer.current?.select(n ? [n] : [], false); };
  const selPart = parts.find((p) => p.name === sel);
  const list = [
    ...EQUIPMENT.map((e) => ({ id: e.id, name: e.name, cat: e.category as string, sub: e.summary })),
    ...(nih.data?.models ?? []).map((m) => ({ id: m.id, name: m.title, cat: "Open hardware", sub: `${m.category === "lab" ? "Lab equipment" : "Medical device"} · NIH 3D · ${m.license}` })),
  ].filter((x) => !cat || x.cat === cat);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Clinical skills" title="Medical devices and lab equipment in 3D"
        subtitle="Rotate, zoom and click each part of common bedside devices, airway equipment and laboratory tools. Every part carries the exam-relevant fact; real open-hardware designs from NIH 3D are included too." />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!cat ? "default" : "outline"} onClick={() => setParams({ cat: null })} data-testid="button-eqcat-all">All</Button>
        {CATS.map((k) => <Button key={k} size="sm" variant={cat === k ? "default" : "outline"} onClick={() => setParams({ cat: k })} data-testid={`button-eqcat-${k.replace(/\s/g, "-").toLowerCase()}`}>{k}</Button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="order-2 lg:order-1">
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto p-3">
            {list.map((x) => (
              <button key={x.id} onClick={() => setParams({ item: x.id })} data-testid={`button-eq-${x.id}`}
                className={`w-full rounded-lg px-3 py-2 text-left hover-elevate ${item === x.id ? "bg-primary/10" : ""}`}>
                <div className={`text-sm font-medium ${item === x.id ? "text-primary" : ""}`}>{x.name}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{x.cat} · {x.sub}</div>
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="order-1 space-y-3 lg:order-2">
          <div className="grid gap-3 xl:grid-cols-[1fr_300px]">
            <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-xl border bg-gradient-to-b from-slate-800 to-slate-950">
              <ThreeViewer ref={viewer} className="absolute inset-0" testId="canvas-equipment" onPick={(n) => eq && choose(n)} />
              {loading && <div className="absolute inset-x-0 top-3 flex justify-center"><Badge variant="secondary" className="gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading model…</Badge></div>}
              {err && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-200">Could not load this model: {err}</div>}
              {selPart && <div className="absolute right-3 top-3 max-w-[75%] rounded-lg bg-slate-900/85 p-3 text-sm text-white shadow" data-testid="text-eq-part"><div className="font-semibold">{selPart.name}</div><div className="mt-1 text-slate-200">{selPart.desc}</div></div>}
              <div className="absolute bottom-3 left-3 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => viewer.current?.frameAll()} data-testid="button-eq-fit"><Maximize2 className="mr-1 h-3.5 w-3.5" />Fit</Button>
                <Button size="sm" variant={spin ? "default" : "secondary"} onClick={() => { setSpin(!spin); viewer.current?.setAutoRotate(!spin); }} data-testid="button-eq-spin"><RefreshCw className="mr-1 h-3.5 w-3.5" />Spin</Button>
              </div>
              <Badge variant="secondary" className="absolute bottom-3 right-3">{eq ? "Schematic 3D model" : "NIH 3D model"}</Badge>
            </div>
            {eq && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Parts</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {parts.map((p) => (
                    <button key={p.name} onClick={() => choose(sel === p.name ? null : p.name)} data-testid={`button-eqpart-${p.name.replace(/\W+/g, "-").toLowerCase()}`}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover-elevate ${sel === p.name ? "bg-primary/10" : ""}`}>
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-sm border" style={{ background: p.color }} />
                      <span><span className="font-medium">{p.name}</span>{sel === p.name && <span className="block text-xs text-muted-foreground">{p.desc}</span>}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          {eq ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold" data-testid="text-eq-title">{eq.name}</h2>
                    <p className="text-sm text-muted-foreground">{eq.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <AddCardButton front={`${eq.name}: high-yield points?`} back={eq.facts.join("\n\n")} deck="Clinical skills" sourceType="equipment" sourceId={eq.id} />
                    <BookmarkButton type="equipment" refId={eq.id} title={eq.name} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">High-yield facts</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">{eq.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
                <p className="text-xs text-muted-foreground">Schematic model built for teaching; shapes are simplified and not to scale. Facts follow standard clinical skills references (e.g. CLSI GP41 order of draw, ISO 10555-5 cannula colors, AHA blood-pressure measurement guidance); follow your local protocols.</p>
              </CardContent>
            </Card>
          ) : nm ? (
            <Card>
              <CardContent className="space-y-2 p-4">
                <h2 className="text-lg font-semibold" data-testid="text-eq-title">{nm.title}</h2>
                <div className="flex flex-wrap gap-1.5"><Badge variant="outline">{nm.id}</Badge><Badge variant="outline">{nm.license}</Badge><Badge variant="outline">{nm.category === "lab" ? "Lab equipment" : "Medical device"}</Badge></div>
                {nm.description && <p className="text-sm text-muted-foreground">{nm.description.replace(/<[^>]+>/g, "").slice(0, 600)}</p>}
                <p className="text-xs text-muted-foreground">Open-hardware design shared for 3D printing. Source: <ExtLink href={nm.source_url}>NIH 3D entry {nm.id}</ExtLink>, {nm.license}. Untextured parts are shown in an illustrative palette.</p>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Stethoscope className="h-4 w-4" />Select an item.</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
