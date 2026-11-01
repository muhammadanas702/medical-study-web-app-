import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Download, FileText, Flag, Loader2, Play, Plus, RotateCcw, Save, Settings, ShieldCheck, Trash2, Users, ListChecks, ScrollText, Box, Globe, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, ErrorState, ExtLink, ListSkeleton, EmptyState, Pager, Stat, useDebounced } from "@/components/common";
import { apiJson, queryClient } from "@/lib/queryClient";
import { useApp } from "@/lib/app-context";
import { useHashQuery } from "@/lib/hash-query";
import { useToast } from "@/hooks/use-toast";
import { KIND_LABEL } from "@/lib/meta";

const ts = (n: number | null | undefined) => (n ? new Date(n).toLocaleString() : "—");
function useAct() {
  const { toast } = useToast();
  return (fn: () => Promise<any>, ok: string, inval: string[] = []) => fn()
    .then((r) => { inval.forEach((k) => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(k) })); toast({ title: ok }); return r; })
    .catch((e: Error) => { toast({ title: "Action failed", description: e.message, variant: "destructive" }); throw e; });
}

export default function AdminPage() {
  const { user, setAuthOpen } = useApp();
  const [params, setParams] = useHashQuery();
  const tab = params.get("tab") || "overview";
  if (!user) return (
    <EmptyState title="Admin panel" icon={<ShieldCheck className="h-8 w-8" />}>
      Sign in with an administrator account to manage the platform. The first account created on a new installation becomes the administrator.
      <div className="mt-3"><Button onClick={() => setAuthOpen(true)} data-testid="button-admin-signin">Sign in</Button></div>
    </EmptyState>
  );
  if (user.role !== "admin") return <EmptyState title="Administrator access required" icon={<Ban className="h-8 w-8" />}>Your account ({user.email}) is not an administrator. Ask an existing admin to change your role.</EmptyState>;
  const tabs: [string, string, any][] = [
    ["overview", "Overview", Activity], ["users", "Users", Users], ["questions", "Questions", ListChecks], ["reports", "Reports", Flag],
    ["updates", "Data updates", Download], ["import", "Import & articles", Globe], ["anatomy", "Anatomy notes", Box], ["settings", "Settings", Settings], ["audit", "Audit log", ScrollText],
  ];
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Administration" title="Admin panel" subtitle="Control users, content, data updates and site settings. Every change is recorded in the audit log." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {tabs.map(([k, l, I]) => <TabsTrigger key={k} value={k} data-testid={`tab-admin-${k}`} className="gap-1.5"><I className="h-3.5 w-3.5" />{l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="questions"><QuestionsTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="updates"><JobsTab /></TabsContent>
        <TabsContent value="import"><ImportTab /></TabsContent>
        <TabsContent value="anatomy"><AnatomyTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Overview() {
  const d = useQuery<any>({ queryKey: ["/api/admin/overview"] });
  if (d.isLoading) return <ListSkeleton rows={6} />;
  if (d.isError) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  const o = d.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Accounts" value={o.users} hint={`${o.admins} admin · ${o.suspended} suspended`} testId="stat-users" />
        <Stat label="Active learners today" value={o.activeToday} />
        <Stat label="Answers recorded" value={o.attempts.toLocaleString()} hint={`${o.attemptsToday} today`} />
        <Stat label="Quiz blocks" value={o.sessions.toLocaleString()} />
        <Stat label="Open error reports" value={o.openReports} testId="stat-reports" />
        <Stat label="Drafts awaiting review" value={o.drafts} hint={`${o.published} published`} />
        <Stat label="Editor questions" value={o.customQuestions} hint={`${o.editedQuestions} edited · ${o.disabledQuestions} disabled`} />
        <Stat label="Annotated figures" value={o.annotatedFigures} />
        <Stat label="Anatomy notes" value={o.anatomyOverrides} />
        <Stat label="Update items stored" value={o.feedItems.toLocaleString()} />
        <Stat label="Flashcards" value={o.cards.toLocaleString()} />
        <Stat label="Notes" value={o.notes.toLocaleString()} />
      </div>
      {o.content && (
        <Card><CardContent className="p-4">
          <h3 className="mb-2 font-semibold">Content database</h3>
          <div className="flex flex-wrap gap-1.5">{Object.entries(o.content).map(([k, v]) => <Badge key={k} variant="secondary" className="font-normal">{k}: {Number(v).toLocaleString()}</Badge>)}</div>
        </CardContent></Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="p-4">
          <h3 className="mb-2 font-semibold">Hardest questions (≥3 attempts)</h3>
          {o.hardest.length ? <ul className="space-y-1 text-sm">{o.hardest.map((h: any) => <li key={h.id} className="flex justify-between gap-2"><span className="font-mono text-xs">{h.id}</span><span className="tabular-nums">{h.pct}% of {h.n}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Not enough answers yet.</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <h3 className="mb-2 font-semibold">Recent update jobs</h3>
          {o.recentJobs.length ? <ul className="space-y-1 text-sm">{o.recentJobs.map((j: any) => <li key={j.id} className="flex justify-between gap-2"><span>{j.type}</span><span className="text-muted-foreground">{j.status} · {j.items} items · {ts(j.started_at)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No jobs run yet.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const d = useQuery<{ users: any[] }>({ queryKey: [`/api/admin/users?q=${encodeURIComponent(dq)}`] });
  const act = useAct();
  const { user } = useApp();
  const [pw, setPw] = useState<{ id: number; email: string } | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; run: () => void } | null>(null);
  return (
    <div className="space-y-3">
      <Input className="max-w-sm" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-admin-user-search" />
      {d.isLoading ? <ListSkeleton rows={5} /> : d.isError ? <ErrorState error={d.error} /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Activity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.data!.users.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div><div className="text-[11px] text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}{u.last_seen ? ` · seen ${ts(u.last_seen)}` : ""}</div></TableCell>
                  <TableCell>
                    <Select value={u.role || "student"} onValueChange={(v) => act(() => apiJson("PATCH", `/api/admin/users/${u.id}`, { role: v }), "Role updated", ["/api/admin/users"])} disabled={u.id === user?.id}>
                      <SelectTrigger className="h-8 w-28" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{u.attempts} answers{u.pct != null ? ` · ${u.pct}%` : ""}</TableCell>
                  <TableCell>{u.suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" disabled={u.id === user?.id} onClick={() => act(() => apiJson("PATCH", `/api/admin/users/${u.id}`, { suspended: !u.suspended }), u.suspended ? "Account reactivated" : "Account suspended", ["/api/admin/users"])} data-testid={`button-suspend-${u.id}`}>{u.suspended ? "Reactivate" : "Suspend"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setPw({ id: u.id, email: u.email }); setNewPw(""); }} data-testid={`button-password-${u.id}`}>Password</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirm({ title: `Erase all answers and quiz blocks of ${u.email}?`, run: () => act(() => apiJson("POST", `/api/admin/users/${u.id}/reset-progress`), "Progress reset", ["/api/admin/users"]) })} data-testid={`button-reset-${u.id}`}><RotateCcw className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={u.id === user?.id} onClick={() => setConfirm({ title: `Permanently delete ${u.email} and all of their data?`, run: () => act(() => apiJson("DELETE", `/api/admin/users/${u.id}`), "Account deleted", ["/api/admin/users"]) })} data-testid={`button-delete-user-${u.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      <Dialog open={!!pw} onOpenChange={(o) => !o && setPw(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set a new password</DialogTitle><DialogDescription>For {pw?.email}. The user will be signed out of all devices.</DialogDescription></DialogHeader>
          <Input type="password" placeholder="At least 8 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="input-new-password" />
          <DialogFooter><Button disabled={newPw.length < 8} onClick={() => act(() => apiJson("POST", `/api/admin/users/${pw!.id}/password`, { password: newPw }), "Password changed").then(() => setPw(null))} data-testid="button-save-password">Save password</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog c={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function ConfirmDialog({ c, onClose }: { c: { title: string; run: () => void } | null; onClose: () => void }) {
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Please confirm</DialogTitle><DialogDescription>{c?.title} This cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={() => { c?.run(); onClose(); }} data-testid="button-confirm">Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── questions ──
function QuestionsTab() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [source, setSource] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => setPage(0), [dq, source, state]);
  const qs = new URLSearchParams({ q: dq, source, state, page: String(page) }).toString();
  const d = useQuery<any>({ queryKey: [`/api/admin/questions?${qs}`] });
  const act = useAct();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-sm" placeholder="Search stem text or exact question ID" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-admin-question-search" />
        <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56" data-testid="select-question-source"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All question types</SelectItem>
            <SelectItem value="custom">Editor-written</SelectItem>
            {d.data?.kinds.map((k: any) => <SelectItem key={k.v} value={k.v}>{KIND_LABEL[k.v] ?? k.v} ({k.n.toLocaleString()})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state || "any"} onValueChange={(v) => setState(v === "any" ? "" : v)}>
          <SelectTrigger className="w-40" data-testid="select-question-state"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="any">Any state</SelectItem><SelectItem value="edited">Edited</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setEditId("new")} data-testid="button-new-question"><Plus className="mr-1 h-4 w-4" />Write a question</Button>
      </div>
      {d.isLoading ? <ListSkeleton rows={8} /> : d.isError ? <ErrorState error={d.error} /> : !d.data.rows.length ? <EmptyState title="No questions match" /> : (
        <>
          <div className="text-sm text-muted-foreground">{d.data.total.toLocaleString()} questions</div>
          <div className="space-y-2">
            {d.data.rows.map((r: any) => (
              <Card key={r.id} data-testid={`row-question-${r.id}`}><CardContent className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-mono">{r.id}</span>
                    <Badge variant="outline" className="font-normal">{KIND_LABEL[r.kind] ?? r.kind ?? "custom"}</Badge>
                    {r.system && <span className="text-muted-foreground">{r.system} · {r.discipline}</span>}
                    {r.edited && <Badge>Edited</Badge>}{r.disabled && <Badge variant="destructive">Disabled</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{r.stem}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditId(r.id)} data-testid={`button-edit-q-${r.id}`}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => act(() => apiJson("POST", `/api/admin/questions/${r.id}/disable`, { disabled: !r.disabled }), r.disabled ? "Question enabled" : "Question disabled", ["/api/admin/questions"])} data-testid={`button-disable-q-${r.id}`}>{r.disabled ? "Enable" : "Disable"}</Button>
                  {r.edited && !r.custom && <Button size="sm" variant="outline" onClick={() => act(() => apiJson("POST", `/api/admin/questions/${r.id}/revert`), "Reverted to source", ["/api/admin/questions"])} data-testid={`button-revert-q-${r.id}`}>Revert</Button>}
                  {r.custom && <Button size="sm" variant="outline" className="text-destructive" onClick={() => act(() => apiJson("DELETE", `/api/admin/questions/${r.id}`), "Question deleted", ["/api/admin/questions"])} data-testid={`button-delete-q-${r.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </CardContent></Card>
            ))}
          </div>
          <Pager page={page} total={d.data.total} size={d.data.size} onPage={setPage} />
        </>
      )}
      {editId && <QuestionEditor id={editId} systems={d.data?.systems ?? []} disciplines={d.data?.disciplines ?? []} onClose={() => setEditId(null)} />}
    </div>
  );
}

type QForm = { stem: string; ask: string; options: string[]; answer: number; explanation: string; rationales: string[]; objective: string; system: string; discipline: string; source: string; source_url: string | null };
const EMPTY: QForm = { stem: "", ask: "Which of the following is the most likely diagnosis?", options: ["", "", "", "", ""], answer: 0, explanation: "", rationales: ["", "", "", "", ""], objective: "", system: "", discipline: "", source: "", source_url: null };

function QuestionEditor({ id, systems, disciplines, onClose }: { id: string; systems: string[]; disciplines: string[]; onClose: () => void }) {
  const isNew = id === "new";
  const d = useQuery<any>({ queryKey: [`/api/admin/questions/${id}`], enabled: !isNew });
  const [f, setF] = useState<QForm>(EMPTY);
  useEffect(() => {
    if (d.data) setF({ stem: d.data.stem, ask: d.data.ask || "", options: d.data.options, answer: d.data.answer, explanation: d.data.explanation, rationales: d.data.options.map((_: any, i: number) => d.data.rationales?.[i] ?? ""), objective: d.data.objective || "", system: d.data.system || "", discipline: d.data.discipline || "", source: d.data.source || "", source_url: d.data.source_url || null });
  }, [d.data]);
  const { toast } = useToast();
  const save = useMutation({
    mutationFn: () => isNew ? apiJson("POST", "/api/admin/questions", f) : apiJson("PUT", `/api/admin/questions/${id}`, f),
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin/questions") }); toast({ title: isNew ? "Question created" : "Question saved" }); onClose(); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  const set = <K extends keyof QForm>(k: K, v: QForm[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Write a question" : `Edit ${id}`}</DialogTitle>
          <DialogDescription>{isNew ? "Editor-written questions join the question bank immediately." : "Edits are stored as an overlay; the original can be restored with Revert."}</DialogDescription>
        </DialogHeader>
        {!isNew && d.isLoading ? <ListSkeleton rows={6} /> : (
          <div className="space-y-3">
            {!isNew && d.data?.stats?.n > 0 && <p className="text-xs text-muted-foreground">{d.data.stats.n} answers, {Math.round((100 * (d.data.stats.c || 0)) / d.data.stats.n)}% correct. {d.data.reports.length} report(s).</p>}
            <div><Label>Stem (clinical vignette)</Label><Textarea rows={5} value={f.stem} onChange={(e) => set("stem", e.target.value)} data-testid="input-q-stem" /></div>
            <div><Label>Question</Label><Input value={f.ask} onChange={(e) => set("ask", e.target.value)} data-testid="input-q-ask" /></div>
            <div className="space-y-2">
              <Label>Options (select the correct one) and why each is right or wrong</Label>
              {f.options.map((o, i) => (
                <div key={i} className="grid gap-1 sm:grid-cols-[auto_1fr_1fr_auto]">
                  <input type="radio" name="ans" className="mt-2.5" checked={f.answer === i} onChange={() => set("answer", i)} aria-label={`Correct answer ${i + 1}`} data-testid={`radio-q-answer-${i}`} />
                  <Input placeholder={`Option ${String.fromCharCode(65 + i)}`} value={o} onChange={(e) => set("options", f.options.map((x, j) => (j === i ? e.target.value : x)))} data-testid={`input-q-option-${i}`} />
                  <Input placeholder="Rationale" value={f.rationales[i] ?? ""} onChange={(e) => set("rationales", f.options.map((_, j) => (j === i ? e.target.value : f.rationales[j] ?? "")))} />
                  <Button size="icon" variant="ghost" disabled={f.options.length <= 2} onClick={() => { const opts = f.options.filter((_, j) => j !== i); setF({ ...f, options: opts, rationales: f.rationales.filter((_, j) => j !== i), answer: Math.min(f.answer > i ? f.answer - 1 : f.answer, opts.length - 1) }); }} aria-label="Remove option"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {f.options.length < 8 && <Button size="sm" variant="outline" onClick={() => setF({ ...f, options: [...f.options, ""], rationales: [...f.rationales, ""] })}>Add option</Button>}
            </div>
            <div><Label>Explanation</Label><Textarea rows={5} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} data-testid="input-q-explanation" /></div>
            <div><Label>Educational objective</Label><Input value={f.objective} onChange={(e) => set("objective", e.target.value)} /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>System</Label><Input list="sys-list" value={f.system} onChange={(e) => set("system", e.target.value)} data-testid="input-q-system" /><datalist id="sys-list">{systems.map((s) => <option key={s} value={s} />)}</datalist></div>
              <div><Label>Discipline</Label><Input list="disc-list" value={f.discipline} onChange={(e) => set("discipline", e.target.value)} data-testid="input-q-discipline" /><datalist id="disc-list">{disciplines.map((s) => <option key={s} value={s} />)}</datalist></div>
              <div><Label>Reference</Label><Input placeholder="e.g. Harrison's 21e ch. 273" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
              <div><Label>Reference URL</Label><Input value={f.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} /></div>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-question"><Save className="mr-1 h-4 w-4" />{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── reports ──
const REF_LINK: Record<string, (id: string) => string> = {
  drug: (id) => `/drugs/${id}`, concept: (id) => `/concept/${id}`, anatomy: (id) => `/atlas?part=${id}`, figure: (id) => `/figures/${id}`,
  book: (id) => `/books/${id}`, molecule: (id) => `/molecules/${id}`, article: (id) => `/articles/${id}`,
};
function ReportsTab() {
  const [status, setStatus] = useState("open");
  const d = useQuery<{ reports: any[] }>({ queryKey: [`/api/admin/reports?status=${status}`] });
  const act = useAct();
  const [note, setNote] = useState<Record<number, string>>({});
  return (
    <div className="space-y-3">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-40" data-testid="select-report-status"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="dismissed">Dismissed</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
      </Select>
      {d.isLoading ? <ListSkeleton rows={4} /> : d.isError ? <ErrorState error={d.error} /> : !d.data!.reports.length ? <EmptyState title="No reports">Learners can flag errors on any question, drug, concept, structure or figure.</EmptyState> : (
        <div className="space-y-2">
          {d.data!.reports.map((r) => (
            <Card key={r.id} data-testid={`row-report-${r.id}`}><CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{r.type}</Badge>
                {r.type === "question" ? <span className="font-mono">{r.ref_id}</span> : REF_LINK[r.type] ? <Link href={REF_LINK[r.type](r.ref_id)} className="font-mono text-primary hover:underline">{r.ref_id}</Link> : <span className="font-mono">{r.ref_id}</span>}
                <span className="text-muted-foreground">{ts(r.created_at)} · {r.user_email || "guest"}</span>
                <Badge variant={r.status === "open" ? "destructive" : "secondary"} className="ml-auto">{r.status}</Badge>
              </div>
              {r.title && <div className="text-sm font-medium">{r.title}</div>}
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              {r.admin_note && <p className="text-xs text-muted-foreground">Note: {r.admin_note}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Input className="h-8 max-w-sm" placeholder="Resolution note (optional)" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                {r.status !== "resolved" && <Button size="sm" onClick={() => act(() => apiJson("PATCH", `/api/admin/reports/${r.id}`, { status: "resolved", note: note[r.id] || undefined }), "Marked resolved", ["/api/admin/reports", "/api/admin/overview"])} data-testid={`button-resolve-${r.id}`}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Resolved</Button>}
                {r.status !== "dismissed" && <Button size="sm" variant="outline" onClick={() => act(() => apiJson("PATCH", `/api/admin/reports/${r.id}`, { status: "dismissed", note: note[r.id] || undefined }), "Dismissed", ["/api/admin/reports", "/api/admin/overview"])}>Dismiss</Button>}
                {r.status !== "open" && <Button size="sm" variant="ghost" onClick={() => act(() => apiJson("PATCH", `/api/admin/reports/${r.id}`, { status: "open" }), "Reopened", ["/api/admin/reports"])}>Reopen</Button>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── data update jobs ──
function JobsTab() {
  const d = useQuery<{ defs: any[]; history: any[] }>({ queryKey: ["/api/admin/jobs"], refetchInterval: 5000 });
  const act = useAct();
  const [watch, setWatch] = useState<number | null>(null);
  const [feedJob, setFeedJob] = useState<string | null>(null);
  const job = useQuery<any>({ queryKey: [`/api/admin/jobs/${watch}`], enabled: watch != null, refetchInterval: (q) => (q.state.data?.status === "running" ? 1500 : false) });
  const feed = useQuery<{ items: any[] }>({ queryKey: [`/api/admin/feed/${feedJob}`], enabled: !!feedJob });
  if (d.isLoading) return <ListSkeleton rows={6} />;
  if (d.isError) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Update jobs collect new information through the official public APIs of each source (NCBI E-utilities, openFDA, ClinicalTrials.gov, MedlinePlus, Wikipedia, PubChem, GitHub), respecting their rate limits and terms. New items appear on the What's new page. Jobs never overwrite reviewed content without an editor.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {d.data!.defs.map((j) => (
          <Card key={j.key} data-testid={`card-job-${j.key}`}><CardContent className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-semibold">{j.title}</div><div className="text-xs text-muted-foreground">{j.source}</div></div>
              {j.running ? <Badge className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Running</Badge> : j.last ? <Badge variant={j.last.status === "done" ? "secondary" : "destructive"}>{j.last.status}</Badge> : <Badge variant="outline">Never run</Badge>}
            </div>
            <p className="flex-1 text-sm text-muted-foreground">{j.description}</p>
            <div className="text-xs text-muted-foreground">{j.last ? `Last: ${ts(j.last.started_at)} · ${j.last.items} items` : ""}{j.stored ? ` · ${j.stored.toLocaleString()} stored` : ""}</div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" disabled={j.running} onClick={() => act(() => apiJson<{ id: number }>("POST", `/api/admin/jobs/${j.key}/run`, {}), `${j.title} started`, ["/api/admin/jobs"]).then((r) => setWatch(r.id))} data-testid={`button-run-${j.key}`}><Play className="mr-1 h-3.5 w-3.5" />Run now</Button>
              {j.last && <Button size="sm" variant="outline" onClick={() => setWatch(j.last.id)} data-testid={`button-log-${j.key}`}>Log</Button>}
              {j.stored > 0 && <Button size="sm" variant="outline" onClick={() => setFeedJob(j.key)} data-testid={`button-feed-${j.key}`}>Items</Button>}
            </div>
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4">
        <h3 className="mb-2 font-semibold">History</h3>
        {d.data!.history.length ? (
          <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>Started</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
            <TableBody>{d.data!.history.map((h) => <TableRow key={h.id} className="cursor-pointer" onClick={() => setWatch(h.id)}><TableCell>{h.id}</TableCell><TableCell>{h.type}</TableCell><TableCell>{h.status}</TableCell><TableCell>{h.items}</TableCell><TableCell>{ts(h.started_at)}</TableCell><TableCell className="text-xs">{h.started_by}</TableCell></TableRow>)}</TableBody></Table>
        ) : <p className="text-sm text-muted-foreground">No jobs yet.</p>}
      </CardContent></Card>
      <Dialog open={watch != null} onOpenChange={(o) => !o && setWatch(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Job #{watch} {job.data ? `· ${job.data.type} · ${job.data.status}` : ""}</DialogTitle><DialogDescription>{job.data ? `${job.data.items} items · started ${ts(job.data.started_at)}${job.data.finished_at ? ` · finished ${ts(job.data.finished_at)}` : ""}` : "Loading…"}</DialogDescription></DialogHeader>
          <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" data-testid="text-job-log">{job.data?.log || "…"}</pre>
        </DialogContent>
      </Dialog>
      <Dialog open={!!feedJob} onOpenChange={(o) => !o && setFeedJob(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Collected items · {feedJob}</DialogTitle><DialogDescription>{feed.data?.items.length ?? 0} most recent</DialogDescription></DialogHeader>
          <ul className="space-y-2 text-sm">{(feed.data?.items ?? []).map((it) => <li key={it.id} className="border-b pb-2">{it.url ? <ExtLink href={it.url}>{it.title}</ExtLink> : it.title}<div className="text-xs text-muted-foreground">{it.published}</div>{it.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{it.summary}</p>}</li>)}</ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── URL import + drafts ──
function ImportTab() {
  const [url, setUrl] = useState("");
  const [license, setLicense] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const act = useAct();
  const [busy, setBusy] = useState(false);
  const d = useQuery<{ drafts: any[] }>({ queryKey: [`/api/admin/drafts?status=${status}`] });
  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-3 p-4">
        <h3 className="font-semibold">Import a page from the web</h3>
        <p className="text-sm text-muted-foreground">Paste the URL of an article (for example a CDC, NIH, WHO or open-access journal page). The importer checks the site's robots.txt, extracts the readable text and saves it as a draft. Nothing is shown to learners until you set its licence and publish it. Only import content you have the right to republish.</p>
        <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
          <Input placeholder="https://www.ncbi.nlm.nih.gov/books/…" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="input-import-url" />
          <Input placeholder="Licence (optional)" value={license} onChange={(e) => setLicense(e.target.value)} data-testid="input-import-license" />
          <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="input-import-subject" />
          <Button disabled={!url || busy} onClick={() => { setBusy(true); act(() => apiJson<any>("POST", "/api/admin/import", { url, license: license || undefined, subject: subject || undefined }), "Draft created", ["/api/admin/drafts"]).then((r) => { setUrl(""); setOpen(r.id); }).catch(() => {}).finally(() => setBusy(false)); }} data-testid="button-import">{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Import</Button>
        </div>
      </CardContent></Card>
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Drafts and articles</h3>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="ml-auto w-40" data-testid="select-draft-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="draft">Drafts</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
        </Select>
      </div>
      {d.isLoading ? <ListSkeleton rows={4} /> : d.isError ? <ErrorState error={d.error} /> : !d.data!.drafts.length ? <EmptyState title="Nothing imported yet" /> : (
        <div className="space-y-2">
          {d.data!.drafts.map((x) => (
            <Card key={x.id} data-testid={`row-draft-${x.id}`}><CardContent className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{x.title}</div><div className="truncate text-xs text-muted-foreground">{x.url} · {x.chars.toLocaleString()} chars · {x.license}</div></div>
              <Badge variant={x.status === "published" ? "default" : x.status === "rejected" ? "destructive" : "secondary"}>{x.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => setOpen(x.id)} data-testid={`button-open-draft-${x.id}`}>Review</Button>
            </CardContent></Card>
          ))}
        </div>
      )}
      {open != null && <DraftEditor id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DraftEditor({ id, onClose }: { id: number; onClose: () => void }) {
  const d = useQuery<any>({ queryKey: [`/api/admin/drafts/${id}`] });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (d.data) setF({ title: d.data.title, body: d.data.body, license: d.data.license, attribution: d.data.attribution || "", subject: d.data.subject || "" }); }, [d.data]);
  const act = useAct();
  const patch = (extra: any, msg: string) => act(() => apiJson("PATCH", `/api/admin/drafts/${id}`, { ...f, ...extra }), msg, ["/api/admin/drafts", "/api/articles"]).then(onClose).catch(() => {});
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Review import</DialogTitle><DialogDescription>{d.data ? <>From <ExtLink href={d.data.url}>{d.data.url}</ExtLink> · robots.txt: {d.data.robots}</> : "Loading…"}</DialogDescription></DialogHeader>
        {!f ? <ListSkeleton rows={6} /> : (
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="input-draft-title" /></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div><Label>Licence</Label><Input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} data-testid="input-draft-license" /></div>
              <div><Label>Attribution</Label><Input value={f.attribution} onChange={(e) => setF({ ...f, attribution: e.target.value })} /></div>
              <div><Label>Subject</Label><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
            </div>
            {/^unknown/i.test(f.license) && <p className="text-xs text-destructive">Set the licence (for example "CC BY 4.0" or "Public domain (U.S. Government work)") before publishing.</p>}
            <div><Label>Text</Label><Textarea rows={16} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="font-mono text-xs" data-testid="input-draft-body" /></div>
          </div>
        )}
        <DialogFooter className="flex-wrap gap-1.5">
          <Button variant="ghost" className="text-destructive" onClick={() => act(() => apiJson("DELETE", `/api/admin/drafts/${id}`), "Deleted", ["/api/admin/drafts", "/api/articles"]).then(onClose).catch(() => {})} data-testid="button-delete-draft"><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
          <Button variant="outline" onClick={() => patch({ status: "rejected" }, "Rejected")} data-testid="button-reject-draft">Reject</Button>
          <Button variant="outline" onClick={() => patch({}, "Saved")} data-testid="button-save-draft">Save draft</Button>
          <Button onClick={() => patch({ status: "published" }, "Published")} data-testid="button-publish-draft"><FileText className="mr-1 h-4 w-4" />Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnatomyTab() {
  const d = useQuery<{ overrides: any[] }>({ queryKey: ["/api/admin/anatomy"] });
  if (d.isLoading) return <ListSkeleton rows={4} />;
  if (d.isError) return <ErrorState error={d.error} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Editor's notes appear above the imported description of a 3D structure. Open the atlas, select a structure and use "Edit description" to add or change one. Figure hotspots are edited on each figure page.</p>
      {!d.data!.overrides.length ? <EmptyState title="No anatomy notes yet" /> : d.data!.overrides.map((o) => (
        <Card key={o.fj}><CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 text-sm"><Link href={`/atlas?part=${o.fj}`} className="font-mono text-primary hover:underline">{o.fj}</Link><span className="text-xs text-muted-foreground">{ts(o.updated_at)} · {o.updated_by}</span></div>
          <p className="mt-1 line-clamp-3 text-sm">{o.description}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

const FEATURES: [string, string][] = [["qbank", "Question bank"], ["flashcards", "Flashcards"], ["atlas", "3D anatomy atlas"], ["pathogens", "3D pathogens"], ["molecules", "3D molecules"], ["diagrams", "Clinical diagrams"], ["books", "Textbooks"], ["figures", "Figure library"], ["research", "PubMed & trials"], ["updates", "What's new"], ["articles", "Reviewed articles"]];
function SettingsTab() {
  const d = useQuery<any>({ queryKey: ["/api/admin/settings"] });
  const [s, setS] = useState<any>(null);
  useEffect(() => { if (d.data) setS(d.data); }, [d.data]);
  const act = useAct();
  if (!s) return <ListSkeleton rows={6} />;
  return (
    <Card><CardContent className="max-w-3xl space-y-5 p-4">
      <div className="space-y-2">
        <Label>Site announcement (shown at the top of every page; leave empty to hide)</Label>
        <Textarea rows={2} value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} data-testid="input-announcement" />
        <Select value={s.announcementLevel} onValueChange={(v) => setS({ ...s, announcementLevel: v })}>
          <SelectTrigger className="w-40" data-testid="select-announcement-level"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="info">Information</SelectItem><SelectItem value="warning">Warning</SelectItem></SelectContent>
        </Select>
      </div>
      <div>
        <Label>Features</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FEATURES.map(([k, l]) => <label key={k} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span>{l}</span><Switch checked={s.features[k] !== false} onCheckedChange={(v) => setS({ ...s, features: { ...s.features, [k]: v } })} data-testid={`switch-feature-${k}`} /></label>)}
        </div>
      </div>
      <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span>Allow new account registration</span><Switch checked={s.registrationOpen} onCheckedChange={(v) => setS({ ...s, registrationOpen: v })} data-testid="switch-registration" /></label>
      <div className="space-y-1">
        <Label>PubMed / trials / MedlinePlus subjects (comma-separated)</Label>
        <Textarea rows={3} value={s.pubmedTerms} onChange={(e) => setS({ ...s, pubmedTerms: e.target.value })} data-testid="input-pubmed-terms" />
      </div>
      <Button onClick={() => act(() => apiJson("PUT", "/api/admin/settings", { announcement: s.announcement, announcementLevel: s.announcementLevel, features: s.features, registrationOpen: s.registrationOpen, pubmedTerms: s.pubmedTerms }), "Settings saved", ["/api/admin/settings", "/api/settings"])} data-testid="button-save-settings"><Save className="mr-1 h-4 w-4" />Save settings</Button>
    </CardContent></Card>
  );
}

function AuditTab() {
  const d = useQuery<{ rows: any[] }>({ queryKey: ["/api/admin/audit"] });
  if (d.isLoading) return <ListSkeleton rows={6} />;
  if (d.isError) return <ErrorState error={d.error} />;
  return (
    <Card><CardContent className="overflow-x-auto p-0">
      <Table>
        <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
        <TableBody>{d.data!.rows.map((r) => <TableRow key={r.id}><TableCell className="whitespace-nowrap text-xs">{ts(r.at)}</TableCell><TableCell className="text-xs">{r.user_email}</TableCell><TableCell className="text-xs font-medium">{r.action}</TableCell><TableCell className="max-w-[16rem] truncate font-mono text-xs">{r.target}</TableCell><TableCell className="max-w-[20rem] truncate text-xs text-muted-foreground">{r.detail}</TableCell></TableRow>)}</TableBody>
      </Table>
      {!d.data!.rows.length && <p className="p-4 text-sm text-muted-foreground">No actions recorded yet.</p>}
    </CardContent></Card>
  );
}
