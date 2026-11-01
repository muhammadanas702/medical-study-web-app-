import { useCallback, useEffect, useState } from "react";

function read(): URLSearchParams {
  const h = window.location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}

/** Query-string state stored in the hash (e.g. #/search?q=asthma) so links are shareable. */
export function useHashQuery() {
  const [params, setParams] = useState(read);
  useEffect(() => {
    const on = () => setParams(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const update = useCallback((patch: Record<string, string | number | null | undefined>, replace = true) => {
    const p = read();
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") p.delete(k);
      else p.set(k, String(v));
    }
    const h = window.location.hash;
    const path = (h.indexOf("?") >= 0 ? h.slice(1, h.indexOf("?")) : h.slice(1)) || "/";
    const s = p.toString();
    const next = `#${path}${s ? "?" + s : ""}`;
    if (replace) history.replaceState(null, "", next);
    else history.pushState(null, "", next);
    setParams(p);
  }, []);
  return [params, update] as const;
}
