import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Bookmark, BookmarkCheck, Layers, AlertCircle, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiJson, queryClient } from "@/lib/queryClient";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-xl font-semibold leading-tight tracking-tight" data-testid="text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SourceLine({ name, url, date, note }: { name: string; url?: string | null; date?: string | null; note?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-xs text-muted-foreground" data-testid="text-source">
      <span className="font-medium text-foreground/80">Source:</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline" data-testid="link-source">
          {name} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span>{name}</span>
      )}
      {date && <span>· {date}</span>}
      {note && <span>· {note}</span>}
    </div>
  );
}

export function ExtLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" data-testid={testId}>
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

export function ListSkeleton({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} data-testid="status-loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" data-testid="status-error">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="h-4 w-4" /> Could not load this
      </div>
      <p className="text-muted-foreground">{msg}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} data-testid="button-retry">
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center" data-testid="status-empty">
      <div className="text-muted-foreground">{icon ?? <SearchX className="h-6 w-6" />}</div>
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular" data-testid="text-pager">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)} data-testid="button-prev-page">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} data-testid="button-next-page">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

type BM = { id: number; type: string; refId: string; title: string; createdAt: number };
export function BookmarkButton({ type, refId, title }: { type: string; refId: string; title: string }) {
  const { toast } = useToast();
  const { data } = useQuery<{ bookmarks: BM[] }>({ queryKey: ["/api/bookmarks"] });
  const existing = data?.bookmarks.find((b) => b.type === type && b.refId === refId);
  const m = useMutation({
    mutationFn: async () => (existing ? apiJson("DELETE", `/api/bookmarks/${existing.id}`) : apiJson("POST", "/api/bookmarks", { type, refId, title })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      toast({ title: existing ? "Bookmark removed" : "Bookmarked", description: title });
    },
    onError: (e: Error) => toast({ title: "Could not update bookmark", description: e.message, variant: "destructive" }),
  });
  return (
    <Button variant="outline" size="sm" onClick={() => m.mutate()} disabled={m.isPending} data-testid="button-bookmark">
      {existing ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
      {existing ? "Saved" : "Save"}
    </Button>
  );
}

export function AddCardButton({ front, back, deck, sourceType, sourceId, label = "Flashcard", variant = "outline" }: {
  front: string; back: string; deck?: string; sourceType?: string; sourceId?: string; label?: string; variant?: "outline" | "ghost" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} data-testid="button-add-card">
        <Layers className="h-4 w-4" /> {label}
      </Button>
      <CardDialog open={open} onOpenChange={setOpen} initial={{ front, back, deck: deck || "My cards", sourceType, sourceId }} />
    </>
  );
}

export function CardDialog({ open, onOpenChange, initial }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: { front: string; back: string; deck: string; sourceType?: string; sourceId?: string };
}) {
  const { toast } = useToast();
  const [front, setFront] = useState(initial.front);
  const [back, setBack] = useState(initial.back);
  const [deck, setDeck] = useState(initial.deck);
  useEffect(() => {
    if (open) {
      setFront(initial.front);
      setBack(initial.back);
      setDeck(initial.deck);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const m = useMutation({
    mutationFn: () => apiJson("POST", "/api/cards", { front, back, deck, sourceType: initial.sourceType ?? null, sourceId: initial.sourceId ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards/due"] });
      toast({ title: "Flashcard added", description: `Deck: ${deck}. It is due for review now.` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Could not add card", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New flashcard</DialogTitle>
          <DialogDescription>Cards are scheduled with spaced repetition (SM-2). Edit before saving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-front">Front</Label>
            <Textarea id="card-front" rows={3} value={front} onChange={(e) => setFront(e.target.value)} data-testid="input-card-front" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-back">Back</Label>
            <Textarea id="card-back" rows={5} value={back} onChange={(e) => setBack(e.target.value)} data-testid="input-card-back" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-deck">Deck</Label>
            <Input id="card-deck" value={deck} onChange={(e) => setDeck(e.target.value)} data-testid="input-card-deck" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-card">Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!front.trim() || !back.trim() || m.isPending} data-testid="button-save-card">
            {m.isPending ? "Saving…" : "Save card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** FDA label text arrives as flowing plain text with section numbers; break it into readable paragraphs. */
const LABEL_HEAD = new RegExp(
  "^\\s*(\\d+(\\.\\d+)*\\s+)?(" + [
    "BOXED WARNING", "WARNING", "INDICATIONS (AND|&) USAGE", "DOSAGE (AND|&) ADMINISTRATION", "DOSAGE FORMS (AND|&) STRENGTHS", "CONTRAINDICATIONS",
    "WARNINGS (AND|&) PRECAUTIONS", "WARNINGS", "PRECAUTIONS", "ADVERSE REACTIONS", "DRUG INTERACTIONS", "USE IN SPECIFIC POPULATIONS", "PREGNANCY", "LACTATION",
    "NURSING MOTHERS", "PEDIATRIC USE", "GERIATRIC USE", "OVERDOSAGE", "DESCRIPTION", "MECHANISM OF ACTION", "PHARMACODYNAMICS", "PHARMACOKINETICS",
    "CLINICAL PHARMACOLOGY", "HOW SUPPLIED(/STORAGE (AND|&) HANDLING)?", "STORAGE (AND|&) HANDLING", "DRUG ABUSE (AND|&) DEPENDENCE", "CONTROLLED SUBSTANCE",
    "PATIENT COUNSELING INFORMATION", "INFORMATION FOR PATIENTS",
  ].join("|") + ")(?=\\s|$)\\s*",
);

export function LabelText({ text, className = "" }: { text: string; className?: string }) {
  const cleaned = text
    .replace(LABEL_HEAD, "")
    .replace(/\s+(?=\d+\.\d+\s+[A-Z][a-z])/g, "\n\n")
    .replace(/\s+(•|●)\s*/g, "\n• ");
  const paras = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {paras.map((p, i) => (
        <p key={i} className="prose-label">{p}</p>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, testId }: { label: string; value: ReactNode; hint?: ReactNode; testId?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular" data-testid={testId}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
