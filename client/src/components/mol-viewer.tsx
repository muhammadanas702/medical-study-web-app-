import { assetUrl } from "@/lib/queryClient";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Style = "stick" | "sphere" | "line";

/** 3D conformer from PubChem (public domain), rendered with 3Dmol.js; falls back to the 2D structure if no 3D conformer exists. */
export function MolViewer({ cid, height = 360, testId = "mol-viewer" }: { cid: number; height?: number; testId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const [state, setState] = useState<"loading" | "3d" | "2d" | "error">("loading");
  const [style, setStyle] = useState<Style>("stick");
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    let dead = false;
    setState("loading");
    (async () => {
      try {
        const $3Dmol: any = await import("3dmol");
        let sdf: string | null = null, dim: "3d" | "2d" = "3d";
        const r3 = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF?record_type=3d`);
        if (r3.ok) sdf = await r3.text();
        else {
          const r2 = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF?record_type=2d`);
          if (r2.ok) { sdf = await r2.text(); dim = "2d"; }
        }
        if (dead) return;
        if (!sdf || !host.current) { setState("error"); return; }
        host.current.innerHTML = "";
        const dark = document.documentElement.classList.contains("dark");
        const v = $3Dmol.createViewer(host.current, { backgroundColor: dark ? "#141a22" : "#ffffff", antialias: true });
        v.addModel(sdf, "sdf");
        viewer.current = v;
        applyStyle(v, "stick");
        v.zoomTo(); v.render();
        setState(dim);
      } catch {
        if (!dead) setState("error");
      }
    })();
    return () => { dead = true; try { viewer.current?.clear(); } catch { /* ignore */ } viewer.current = null; };
  }, [cid]);

  const applyStyle = (v: any, s: Style) => {
    if (s === "stick") v.setStyle({}, { stick: { radius: 0.16, colorscheme: "Jmol" }, sphere: { scale: 0.25, colorscheme: "Jmol" } });
    if (s === "sphere") v.setStyle({}, { sphere: { colorscheme: "Jmol" } });
    if (s === "line") v.setStyle({}, { line: { colorscheme: "Jmol" } });
    v.render();
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border" style={{ height }}>
        <div ref={host} className="absolute inset-0" data-testid={testId} />
        {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading structure from PubChem…</div>}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white p-3 text-center text-sm text-muted-foreground">
            <img src={assetUrl(`/api/compounds/${cid}/svg`)} onError={(e) => { (e.target as HTMLImageElement).src = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=300x300`; }} alt="2D structure" className="max-h-[80%]" />
            No interactive conformer available (large molecule, mixture or biologic). Showing the 2D depiction.
          </div>
        )}
      </div>
      {(state === "3d" || state === "2d") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(["stick", "sphere", "line"] as Style[]).map((s) => (
            <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => { setStyle(s); viewer.current && applyStyle(viewer.current, s); }} data-testid={`button-molstyle-${s}`}>
              {s === "stick" ? "Ball & stick" : s === "sphere" ? "Space-filling" : "Wireframe"}
            </Button>
          ))}
          <Button size="sm" variant={spin ? "default" : "outline"} onClick={() => { const n = !spin; setSpin(n); viewer.current?.spin(n ? "y" : false); }} data-testid="button-molspin">Spin</Button>
          <span className="text-xs text-muted-foreground">{state === "3d" ? "PubChem computed 3D conformer" : "2D coordinates (no 3D conformer in PubChem)"}</span>
        </div>
      )}
    </div>
  );
}
