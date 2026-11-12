"use client";

// Citizen / Investigator toggle. Both views are rendered on the server; this only shows one.
// The choice is remembered in this browser (best effort) and can be set with ?view=investigator.
import { createContext, useContext, useEffect, useState } from "react";

type View = "citizen" | "investigator";
const Ctx = createContext<{ view: View; setView: (v: View) => void }>({ view: "citizen", setView: () => {} });
const KEY = "money-trail:view";

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<View>("citizen");
  useEffect(() => {
    let v: string | null = null;
    try {
      v = new URLSearchParams(window.location.search).get("view") ?? window.localStorage.getItem(KEY);
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state after hydration
    if (v === "investigator" || v === "citizen") setViewState(v);
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(KEY, v);
      const u = new URL(window.location.href);
      u.searchParams.set("view", v);
      window.history.replaceState(null, "", u);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ view, setView }}>{children}</Ctx.Provider>;
}

export function ViewToggle() {
  const { view, setView } = useContext(Ctx);
  const opt = (v: View, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`rounded-md px-3 py-1.5 text-sm ${view === v ? "bg-ink text-page font-semibold" : "text-ink-2 hover:bg-surface-2"}`}
      title={hint}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Choose a view" className="inline-flex gap-1 rounded-lg border border-line bg-surface p-1">
      {opt("citizen", "Citizen", "Plain-English explanation")}
      {opt("investigator", "Investigator", "Filings, leads and where to dig")}
    </div>
  );
}

export function ViewOnly({ view, children }: { view: View; children: React.ReactNode }) {
  const ctx = useContext(Ctx);
  return <div hidden={ctx.view !== view}>{children}</div>;
}
