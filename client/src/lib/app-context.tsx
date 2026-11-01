import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { queryClient, setAuthToken, apiJson } from "./queryClient";

export type AuthUser = { id: number; name: string; email: string; role?: string };
type Theme = "light" | "dark";
type Ctx = {
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => Promise<void>;
  theme: Theme;
  toggleTheme: () => void;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
};
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const signIn = (token: string, u: AuthUser) => {
    setAuthToken(token);
    setUser(u);
    // guest progress was merged server-side; refetch everything owner-scoped
    queryClient.invalidateQueries();
  };
  const signOut = async () => {
    try {
      await apiJson("POST", "/api/auth/logout");
    } catch {
      /* token may already be gone */
    }
    setAuthToken(null);
    setUser(null);
    queryClient.invalidateQueries();
  };
  return (
    <AppCtx.Provider value={{ user, signIn, signOut, theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")), authOpen, setAuthOpen }}>
      {children}
    </AppCtx.Provider>
  );
}
export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
