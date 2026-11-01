import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Bookmark, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ListSkeleton, EmptyState } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/meta";

type Note = { id: number; title: string; body: string; updatedAt: number };

export function NotesPage() {
  const { toast } = useToast();
  const r = useQuery<{ notes: Note[] }>({ queryKey: ["/api/notes"] });
  const [sel, setSel] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const cur = r.data?.notes.find((n) => n.id === sel);
  useEffect(() => { if (cur) { setTitle(cur.title); setBody(cur.body); } }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const inv = () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
  const create = useMutation({
    mutationFn: () => apiJson<Note>("POST", "/api/notes", { title: "Untitled note", body: "" }),
    onSuccess: (n) => { inv(); setSel(n.id); setTitle(n.title); setBody(""); },
  });
  const save = useMutation({
    mutationFn: () => apiJson("PATCH", `/api/notes/${sel}`, { title: title.trim() || "Untitled note", body }),
    onSuccess: () => { inv(); toast({ title: "Note saved" }); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({ mutationFn: (id: number) => apiJson("DELETE", `/api/notes/${id}`), onSuccess: () => { inv(); setSel(null); } });
  return (
    <div>
      <PageHeader title="Notes" subtitle="Your own study notes, saved to your account (or this session as a guest)." actions={<Button onClick={() => create.mutate()} data-testid="button-new-note"><Plus className="h-4 w-4" /> New note</Button>} />
      {r.isLoading ? <ListSkeleton /> : !r.data?.notes.length ? <EmptyState title="No notes yet">Create a note for mnemonics, high-yield lists or things to look up.</EmptyState> : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="divide-y rounded-lg border bg-card" data-testid="list-notes">
            {r.data.notes.map((n) => (
              <button key={n.id} onClick={() => setSel(n.id)} className={`block w-full px-3 py-2.5 text-left hover-elevate ${sel === n.id ? "bg-accent" : ""}`} data-testid={`button-note-${n.id}`}>
                <div className="truncate text-sm font-medium">{n.title}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDate(n.updatedAt)}</div>
              </button>
            ))}
          </div>
          {cur ? (
            <Card><CardContent className="space-y-3 pt-4">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-medium" data-testid="input-note-title" />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} placeholder="Write here…" data-testid="input-note-body" />
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => del.mutate(cur.id)} data-testid="button-delete-note"><Trash2 className="h-4 w-4" /> Delete</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-note"><Save className="h-4 w-4" /> Save</Button>
              </div>
            </CardContent></Card>
          ) : <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">Select a note to edit</div>}
        </div>
      )}
    </div>
  );
}

type BM = { id: number; type: string; refId: string; title: string; createdAt: number };
const HREF: Record<string, (id: string) => string> = {
  concept: (id) => `/concept/${id}`, drug: (id) => `/drugs/${id}`, device: (id) => `/devices/${id}`, icd10: (id) => `/icd10/${id}`,
  topic: (id) => `/topics/${id}`, article: (id) => `/research/${id}`, diagram: (id) => `/diagrams?d=${id}`, anatomy: (id) => `/atlas?part=${id}`, book: (id) => `/books/${id}`, figure: (id) => `/figures/${id}`, molecule: (id) => `/molecules/${id}`,
};
const TYPE_LABEL: Record<string, string> = { concept: "Concept", drug: "Drug", device: "Device", icd10: "ICD-10", topic: "Topic", article: "Article", diagram: "Diagram", anatomy: "3D structure", book: "Textbook", figure: "Figure", molecule: "Molecule" };

export function SavedPage() {
  const r = useQuery<{ bookmarks: BM[] }>({ queryKey: ["/api/bookmarks"] });
  const del = useMutation({ mutationFn: (id: number) => apiJson("DELETE", `/api/bookmarks/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] }) });
  return (
    <div>
      <PageHeader title="Saved items" subtitle="Concepts, drugs, codes, devices, articles and diagrams you have saved." />
      {r.isLoading ? <ListSkeleton /> : !r.data?.bookmarks.length ? <EmptyState title="Nothing saved yet" icon={<Bookmark className="h-6 w-6" />}>Use the Save button on any record.</EmptyState> : (
        <div className="divide-y rounded-lg border bg-card" data-testid="list-saved">
          {r.data.bookmarks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
              <Badge variant="secondary" className="w-24 justify-center font-normal">{TYPE_LABEL[b.type] ?? b.type}</Badge>
              <Link href={(HREF[b.type] ?? ((x: string) => `/search?q=${x}`))(b.refId)} className="flex-1 truncate text-sm font-medium hover:text-primary" data-testid={`link-saved-${b.id}`}>{b.title}</Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(b.createdAt)}</span>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(b.id)} aria-label="Remove" data-testid={`button-remove-saved-${b.id}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
