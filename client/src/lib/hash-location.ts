import { useSyncExternalStore } from "react";

// Hash router hook that ignores the "?query" part of the hash, so "#/search?q=x" matches "/search".
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => { window.removeEventListener("hashchange", cb); window.removeEventListener("popstate", cb); };
};
const path = () => {
  const h = window.location.hash.replace(/^#/, "");
  const p = h.split("?")[0];
  return p.startsWith("/") ? p : "/" + p;
};

export function navigate(to: string, opts?: { replace?: boolean }) {
  const next = "#" + (to.startsWith("/") ? to : "/" + to);
  if (opts?.replace) history.replaceState(null, "", next); else history.pushState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useHashLocationQ(): [string, (to: string, opts?: { replace?: boolean }) => void] {
  const p = useSyncExternalStore(subscribe, path, () => "/");
  return [p, navigate];
}
// wouter <Link> builds hrefs via hrefs option
export const hashHref = (href: string) => "#" + href;
