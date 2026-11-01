import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Lab = { id: number; section: string; subsection: string | null; test: string; conventional: string; si: string };

export function LabSheet() {
  const [q, setQ] = useState("");
  const r = useQuery<{ rows: Lab[] }>({ queryKey: ["/api/labs"] });
  const rows = (r.data?.rows || []).filter((x) => !q || `${x.test} ${x.section}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-lab-values"><FlaskConical className="h-4 w-4" /> Lab values</Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Laboratory values</SheetTitle>
          <SheetDescription>NBME reference ranges, as shown during the exam.</SheetDescription>
        </SheetHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="my-3" data-testid="input-lab-sheet-filter" />
        <div className="divide-y text-sm">
          {rows.map((x, i) => (
            <div key={x.id} className="py-2">
              {(i === 0 || rows[i - 1].section !== x.section) && <div className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-primary">{x.section}</div>}
              <div>{x.test}</div>
              <div className="flex justify-between gap-3 text-xs tabular text-muted-foreground"><span>{x.conventional}</span><span>{x.si}</span></div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
