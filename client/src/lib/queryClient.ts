import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Session identity is held in memory only (no cookies / web storage).
const auth: { token: string | null; visitorId: string } = {
  token: null,
  visitorId: (globalThis.crypto?.randomUUID?.() ?? `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`),
};
export function setAuthToken(token: string | null) {
  auth.token = token;
}
export function getAuthToken() {
  return auth.token;
}
function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = { "X-Visitor-Id": auth.visitorId };
  if (auth.token) h.Authorization = `Bearer ${auth.token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}
export function assetUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const t = await res.text();
      try {
        message = JSON.parse(t).message || t;
      } catch {
        message = t || message;
      }
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

export async function apiRequest(method: string, url: string, data?: unknown | undefined): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: headers(data !== undefined),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

export async function apiJson<T = any>(method: string, url: string, data?: unknown): Promise<T> {
  const r = await apiRequest(method, url, data);
  return (await r.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const [base, params] = queryKey as [string, Record<string, unknown> | string | undefined];
    let url = base;
    if (typeof params === "string") url += "/" + encodeURIComponent(params);
    else if (params && typeof params === "object") {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
      const s = sp.toString();
      if (s) url += "?" + s;
    }
    const res = await fetch(`${API_BASE}${url}`, { headers: headers(false) });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: { retry: false },
  },
});
