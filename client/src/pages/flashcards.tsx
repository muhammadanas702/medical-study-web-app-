import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ListSkeleton, ErrorState, EmptyState, CardDialog } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/meta";

type FC = { id: number; front: string; back: string; deck: string; ease: number; interval: number; reps: number; due: number; createdAt: number };

// mirrors server SM-2 so the buttons can show the next interval
function nextInterval(c: FC, grade: number) {
  if (grade < 3) return "10 min";
  const reps = c.reps + 1;
  let iv = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(c.interval * c.ease);
  if (grade === 5 && reps === 1) iv = 4;
  return iv === 1 ? "1 day" : iv < 31 ? `${iv} days` : `${Math.round(iv / 30)} mo`;
}

function Review({ cards }: { cards: FC[] }) {
  const [deck, setDeck] = useState("all");
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const decks = Array.from(new Set(cards.map((c) => c.deck)));
  const queue = cards.filter((c) => deck === "all" || c.deck === deck);
  const c = queue[0];
  const grade = useMutation({
    mutationFn: (g: number) => apiJson("POST", `/api/cards/${c.id}/review`, { grade: g }),
    onSuccess: () => {
      setFlipped(false);
      setDone((d) => d + 1);
      queryClient.invalidateQueries({ queryKey: ["/api/cards/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    },
  });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={deck} onValueChange={(v) => { setDeck(v); setFlipped(false); }}>
          <SelectTrigger className="w-56" data-testid="select-review-deck"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All decks</SelectItem>{decks.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground tabular" data-testid="text-due-count">{queue.length} due · {done} reviewed this session</span>
      </div>
      {!c ? (
        <EmptyState title="All caught up" icon={<Layers className="h-6 w-6" />}>No cards are due. Add cards from any concept, drug label or answered question, or create one here.</EmptyState>
      ) : (
        <Card className="mx-auto max-w-2xl">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><Badge variant="secondary" className="font-normal">{c.deck}</Badge><span>{c.reps ? `Reviewed ${c.reps}×` : "New card"}</span></div>
            <div className="min-h-[120px] whitespace-pre-line text-[15px] leading-relaxed" data-testid="text-card-front">{c.front}</div>
            {flipped && <div className="mt-4 whitespace-pre-line border-t pt-4 text-[15px] leading-relaxed" data-testid="text-card-back">{c.back}</div>}
            <div className="mt-6">
              {!flipped ? (
                <Button className="w-full" onClick={() => setFlipped(true)} data-testid="button-show-answer">Show answer</Button>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[{ g: 0, l: "Again", v: "destructive" as const }, { g: 3, l: "Hard", v: "outline" as const }, { g: 4, l: "Good", v: "default" as const }, { g: 5, l: "Easy", v: "secondary" as const }].map((b) => (
                    <Button key={b.g} variant={b.v} onClick={() => grade.mutate(b.g)} disabled={grade.isPending} className="flex h-auto flex-col py-2" data-testid={`button-grade-${b.l.toLowerCase()}`}>
                      <span>{b.l}</span><span className="text-[11px] font-normal opacity-75">{nextInterval(c, b.g)}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Flashcards() {
  const due = useQuery<{ cards: FC[] }>({ queryKey: ["/api/cards/due"] });
  const all = useQuery<{ cards: FC[]; due: number; decks: string[] }>({ queryKey: ["/api/cards"] });
  const [newOpen, setNewOpen] = useState(false);
  const [deckFilter, setDeckFilter] = useState("all");
  const del = useMutation({
    mutationFn: (id: number) => apiJson("DELETE", `/api/cards/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cards"] }); queryClient.invalidateQueries({ queryKey: ["/api/cards/due"] }); },
  });
  const list = useMemo(() => (all.data?.cards || []).filter((c) => deckFilter === "all" || c.deck === deckFilter), [all.data, deckFilter]);
  return (
    <div>
      <PageHeader title="Flashcards" subtitle="Spaced repetition with the SM-2 algorithm: cards you know well come back less often, cards you miss return within minutes."
        actions={<Button onClick={() => setNewOpen(true)} data-testid="button-new-card"><Plus className="h-4 w-4" /> New card</Button>} />
      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review" data-testid="tab-review">Review ({due.data?.cards.length ?? "…"})</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-cards">All cards ({all.data?.cards.length ?? "…"})</TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="mt-4">
          {due.isLoading ? <ListSkeleton rows={3} /> : due.isError ? <ErrorState error={due.error} /> : <Review cards={due.data!.cards} />}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {all.isLoading ? <ListSkeleton /> : !all.data?.cards.length ? <EmptyState title="No cards yet">Use “Flashcard” on any concept, drug or explanation to add one.</EmptyState> : (
            <>
              <Select value={deckFilter} onValueChange={setDeckFilter}>
                <SelectTrigger className="mb-3 w-56" data-testid="select-deck-filter"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All decks</SelectItem>{all.data.decks.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <div className="divide-y rounded-lg border bg-card" data-testid="list-cards">
                {list.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium">{c.front}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{c.back}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><Badge variant="outline" className="font-normal">{c.deck}</Badge><span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />{c.due <= Date.now() ? "Due now" : `Due ${fmtDate(c.due)}`}</span><span>ease {c.ease.toFixed(2)}</span></div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)} aria-label="Delete card" data-testid={`button-delete-card-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      <CardDialog open={newOpen} onOpenChange={setNewOpen} initial={{ front: "", back: "", deck: "My cards" }} />
    </div>
  );
}
