import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Style = "chain" | "spectrum" | "surface";

/** Experimentally determined macromolecular structure from the RCSB Protein Data Bank, rendered with 3Dmol.js (cartoon colored by chain). */
export function PdbViewer({ id, height = 340 }: { id: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [style, setStyle] = useState<Style>("chain");
  const [spin, setSpin] = useState(true);
  const [atoms, setAtoms] = useState(0);

  useEffect(() => {
    let dead = false;
    setState("loading"); setStyle("chain");
    (async () => {
      try {
        const $3Dmol: any = await import("3dmol");
        const r = await fetch(`https://files.rcsb.org/download/${id}.cif`);
        if (!r.ok) throw new Error(String(r.status));
        const cif = await r.text();
        if (dead || !host.current) return;
        host.current.innerHTML = "";
        const dark = document.documentElement.classList.contains("dark");
        const v = $3Dmol.createViewer(host.current, { backgroundColor: dark ? "#0f141b" : "#f8fafc", antialias: true });
        v.addModel(cif, "cif");
        viewer.current = v;
        setAtoms(v.selectedAtoms({}).length);
        apply(v, "chain");
        v.zoomTo(); v.spin("y", 0.4); v.render();
        setState("ok");
      } catch {
        if (!dead) setState("error");
      }
    })();
    return () => { dead = true; try { viewer.current?.clear(); } catch { /* ignore */ } viewer.current = null; };
  }, [id]);

  const apply = (v: any, s: Style) => {
    v.removeAllSurfaces();
    if (s === "chain") v.setStyle({}, { cartoon: { colorscheme: "chainHetatm" } });
    if (s === "spectrum") v.setStyle({}, { cartoon: { color: "spectrum" } });
    if (s === "surface") { v.setStyle({}, { cartoon: { colorscheme: "chainHetatm", opacity: 0.5 } }); v.addSurface(1, { opacity: 0.85, colorscheme: "chainHetatm" }); }
    v.setStyle({ hetflag: true, resn: ["HOH", "WAT"], invert: true }, { stick: { colorscheme: "greenCarbon", radius: 0.2 } });
    v.render();
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border" style={{ height }}>
        <div ref={host} className="absolute inset-0" data-testid={`pdb-viewer-${id}`} />
        {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading {id} from the Protein Data Bank…</div>}
        {state === "error" && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">Could not load structure {id}. Check your connection, or open it on RCSB.org.</div>}
      </div>
      {state === "ok" && (
        <div className="flex flex-wrap gap-1.5">
          {((atoms > 40000 ? ["chain", "spectrum"] : ["chain", "spectrum", "surface"]) as Style[]).map((s) => (
            <Button key={s} size="sm" variant={style === s ? "default" : "outline"} onClick={() => { setStyle(s); viewer.current && apply(viewer.current, s); }} data-testid={`button-pdbstyle-${s}`}>
              {s === "chain" ? "Color by chain" : s === "spectrum" ? "N to C rainbow" : "Surface"}
            </Button>
          ))}
          {atoms > 0 && <span className="self-center text-xs text-muted-foreground">{atoms.toLocaleString()} atoms</span>}
          <Button size="sm" variant={spin ? "default" : "outline"} onClick={() => { const n = !spin; setSpin(n); viewer.current?.spin(n ? "y" : false, 0.4); }} data-testid="button-pdb-spin">Spin</Button>
        </div>
      )}
    </div>
  );
}
