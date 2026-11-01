import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard, ListChecks, Layers, BarChart3, Search, Network, Pill, Stethoscope, FileCode2, FlaskConical, BookOpenText,
  Box, Bug, Image as ImageIcon, Newspaper, Microscope, NotebookPen, Bookmark, Info, Moon, Sun, LogIn, LogOut, UserRound,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useApp, type AuthUser } from "@/lib/app-context";
import { apiJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const NAV: { label: string; items: { href: string; label: string; icon: typeof Search }[] }[] = [
  { label: "Study", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/qbank", label: "Question bank", icon: ListChecks },
    { href: "/flashcards", label: "Flashcards", icon: Layers },
    { href: "/analytics", label: "Performance", icon: BarChart3 },
  ] },
  { label: "Visual learning", items: [
    { href: "/atlas", label: "3D anatomy atlas", icon: Box },
    { href: "/pathogens", label: "3D pathogens", icon: Bug },
    { href: "/diagrams", label: "Clinical diagrams", icon: ImageIcon },
  ] },
  { label: "Reference library", items: [
    { href: "/search", label: "Search everything", icon: Search },
    { href: "/browse", label: "MeSH concepts", icon: Network },
    { href: "/drugs", label: "Drugs (FDA labels)", icon: Pill },
    { href: "/devices", label: "Medical devices", icon: Stethoscope },
    { href: "/icd10", label: "ICD-10-CM codes", icon: FileCode2 },
    { href: "/labs", label: "Lab values", icon: FlaskConical },
    { href: "/topics", label: "Health topics", icon: BookOpenText },
  ] },
  { label: "Research", items: [
    { href: "/research", label: "PubMed literature", icon: Newspaper },
    { href: "/trials", label: "Clinical trials", icon: Microscope },
  ] },
  { label: "My study", items: [
    { href: "/notes", label: "Notes", icon: NotebookPen },
    { href: "/saved", label: "Saved items", icon: Bookmark },
    { href: "/sources", label: "Sources & methods", icon: Info },
  ] },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-label="Vesalius logo" role="img">
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary" />
      <path d="M9 9.5 16 23l7-13.5" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.2 15.6h7.6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

function isActive(loc: string, href: string) {
  return href === "/" ? loc === "/" : loc === href || loc.startsWith(href + "/");
}

function AppSidebar() {
  const [loc] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home" onClick={() => isMobile && setOpenMobile(false)}>
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Vesalius</div>
            <div className="text-[11px] text-muted-foreground">Medical study platform</div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 overflow-y-auto">
        {NAV.map((g) => (
          <SidebarGroup key={g.label} className="py-0.5">
            <SidebarGroupLabel className="h-7">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton asChild size="sm" className="h-[30px] text-[13.5px]" isActive={isActive(loc, it.href)}>
                      <Link href={it.href} data-testid={`link-nav-${it.href.replace(/\//g, "") || "dashboard"}`} onClick={() => isMobile && setOpenMobile(false)}>
                        <it.icon className="h-4 w-4" />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <p className="mx-2 mt-3 mb-3 border-t px-2 pt-3 text-[11px] leading-snug text-muted-foreground" data-testid="text-disclaimer">
          For education only. Not a substitute for clinical judgment or current prescribing information.
        </p>
      </SidebarContent>
    </Sidebar>
  );
}

function AuthDialog() {
  const { authOpen, setAuthOpen, signIn } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () =>
      apiJson<{ token: string; user: AuthUser }>("POST", tab === "login" ? "/api/auth/login" : "/api/auth/register", tab === "login" ? { email, password } : { name, email, password }),
    onSuccess: (r) => {
      signIn(r.token, r.user);
      setAuthOpen(false);
      setPassword("");
      toast({ title: tab === "login" ? `Welcome back, ${r.user.name}` : "Account created", description: "Your progress from this session has been saved to your account." });
    },
    onError: (e: Error) => toast({ title: tab === "login" ? "Sign in failed" : "Could not create account", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your study account</DialogTitle>
          <DialogDescription>Sign in to keep question history, flashcards, notes and saved items across sessions. Anything you did as a guest is carried over.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" data-testid="tab-login">Sign in</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Create account</TabsTrigger>
          </TabsList>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <TabsContent value="register" className="m-0 space-y-1.5">
              <Label htmlFor="auth-name">Name</Label>
              <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="input-name" />
            </TabsContent>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} required minLength={8} data-testid="input-password" />
              {tab === "register" && <p className="text-xs text-muted-foreground">At least 8 characters. Passwords are stored as salted scrypt hashes.</p>}
            </div>
            <Button type="submit" className="w-full" disabled={m.isPending} data-testid="button-auth-submit">
              {m.isPending ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function TopBar() {
  const { theme, toggleTheme, user, setAuthOpen, signOut } = useApp();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <form
        className="relative max-w-xl flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search diseases, drugs, anatomy, ICD-10, devices…"
          className="h-9 pl-8"
          aria-label="Search the library"
          data-testid="input-global-search"
        />
      </form>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle color theme" data-testid="button-theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-account">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)} data-testid="button-login">
            <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Sign in</span>
            <UserRound className="h-4 w-4 sm:hidden" />
          </Button>
        )}
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <AuthDialog />
    </SidebarProvider>
  );
}
