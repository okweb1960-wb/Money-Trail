"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Core, ElementDefinition, LayoutOptions, NodeSingular, StylesheetJson } from "cytoscape";
import { KINDS } from "@/lib/graph-kinds";

export interface NodeIn { id: string; kind: string; label: string; subtitle: string | null; pending: boolean; sources: Array<{ label: string; url: string; retrievedAt: string }> }
export interface EdgeIn { id: string; type: string; source: string; target: string; amount: number | null; date: string | null; note: string | null; sourceUrl: string; retrievedAt: string }

const EDGE_LABEL: Record<string, string> = {
  lobbied_for: "Lobbied for (LD-2)",
  employed_by: "Listed by registrant",
  contributed_to: "Contribution",
  issued: "Issued",
  filed_in: "Filed brief",
  affiliated_with: "PAC affiliated with",
};

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function NetworkGraph({ nodes, edges }: { nodes: NodeIn[]; edges: EdgeIn[] }) {
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const edgeTypes = useMemo(() => [...new Set(edges.map((e) => e.type))], [edges]);
  const [shownTypes, setShownTypes] = useState<Set<string>>(() => new Set(edgeTypes));
  const [scheme, setScheme] = useState(0);

  const degree = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    }
    return m;
  }, [edges]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setScheme((s) => s + 1);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      if (cancelled || !box.current) return;
      const visibleEdges = edges.filter((e) => shownTypes.has(e.type));
      const used = new Set(visibleEdges.flatMap((e) => [e.source, e.target]));
      const els: ElementDefinition[] = [
        ...nodes.filter((n) => used.has(n.id) || n.kind === "company").map((n) => ({ data: { id: n.id, label: n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label, kind: n.kind, deg: degree.get(n.id) ?? 0 } })),
        ...visibleEdges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, type: e.type } })),
      ];
      const ink = cssVar("--ink-2");
      const surface = cssVar("--surface");
      const lineColor = cssVar("--axis");
      const style: StylesheetJson = [
        { selector: "node", style: { label: "data(label)", "font-size": 10, color: ink, "text-valign": "bottom", "text-margin-y": 3, "text-wrap": "ellipsis", "text-max-width": "110px", "min-zoomed-font-size": 9, "border-width": 2, "border-color": surface, width: "mapData(deg, 0, 40, 14, 56)", height: "mapData(deg, 0, 40, 14, 56)" } },
        ...KINDS.map((k) => ({ selector: `node[kind = "${k.kind}"]`, style: { "background-color": cssVar(k.slot), shape: k.shape } })),
        { selector: 'node[kind = "company"], node[kind = "decision"], node[kind = "official"], node[kind = "committee"]', style: { "min-zoomed-font-size": 0, "font-weight": "bold" } },
        { selector: "edge", style: { width: 1, "line-color": lineColor, "curve-style": "straight", "target-arrow-shape": "triangle", "target-arrow-color": lineColor, "arrow-scale": 0.6, opacity: 0.8 } },
        { selector: "edge[type = 'contributed_to']", style: { width: 2 } },
        { selector: ".faded", style: { opacity: 0.12 } },
        { selector: "node:selected", style: { "border-color": cssVar("--ink"), "border-width": 3 } },
      ];
      cyRef.current?.destroy();
      const cy = cytoscape({
        container: box.current,
        elements: els,
        style,
        layout: { name: "concentric", concentric: (n: NodeSingular) => KINDS.find((k) => k.kind === n.data("kind"))?.ring ?? 1, levelWidth: () => 1, minNodeSpacing: 22, spacingFactor: 1.15, animate: false } as LayoutOptions,
        wheelSensitivity: 0.2,
      });
      cy.on("tap", "node", (evt) => {
        const id = evt.target.id();
        setSelected(id);
        cy.elements().addClass("faded");
        evt.target.closedNeighborhood().removeClass("faded");
      });
      cy.on("tap", (evt) => {
        if (evt.target === cy) {
          setSelected(null);
          cy.elements().removeClass("faded");
        }
      });
      cyRef.current = cy;
    })();
    return () => {
      cancelled = true;
    };
  }, [nodes, edges, shownTypes, degree, scheme]);

  useEffect(() => () => cyRef.current?.destroy(), []);

  const node = nodes.find((n) => n.id === selected);
  const nodeEdges = selected ? edges.filter((e) => e.source === selected || e.target === selected) : [];
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const usd = (n: number | null) => (n == null ? "" : " · $" + Math.round(n).toLocaleString("en-US"));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2">
        {KINDS.map((k) => (
          <span key={k.kind} className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              {k.shape === "ellipse" && <circle cx="6" cy="6" r="5" fill={`var(${k.slot})`} />}
              {k.shape === "diamond" && <path d="M6 0 12 6 6 12 0 6Z" fill={`var(${k.slot})`} />}
              {k.shape === "triangle" && <path d="M6 0 12 11H0Z" fill={`var(${k.slot})`} />}
              {k.shape === "hexagon" && <path d="M3 1h6l3 5-3 5H3L0 6Z" fill={`var(${k.slot})`} />}
              {k.shape === "pentagon" && <path d="M6 0 12 4.5 9.8 12H2.2L0 4.5Z" fill={`var(${k.slot})`} />}
              {(k.shape === "rectangle" || k.shape === "round-rectangle") && <rect x="1" y="1" width="10" height="10" rx={k.shape === "round-rectangle" ? 3 : 0} fill={`var(${k.slot})`} />}
            </svg>
            {k.label}
          </span>
        ))}
        <span className="text-muted">Size = number of connections</span>
      </div>
      <fieldset className="mt-2 flex flex-wrap gap-3 text-xs">
        <legend className="sr-only">Show connection types</legend>
        {edgeTypes.map((t) => (
          <label key={t} className="inline-flex items-center gap-1">
            <input type="checkbox" checked={shownTypes.has(t)} onChange={() => setShownTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })} />
            {EDGE_LABEL[t] ?? t}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={box} className="h-[620px] rounded-lg border border-line bg-surface" role="img" aria-label="Network graph of companies, lobbying firms, lobbyists, PACs, officials and decisions. A table version follows." />
        <aside className="rounded-lg border border-line bg-surface p-3 text-sm" aria-live="polite">
          {!node && <p className="text-muted">Click a node to see who it is, how it is connected, and the public records behind it.</p>}
          {node && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{KINDS.find((k) => k.kind === node.kind)?.label}</p>
              <p className="font-semibold">{node.label}</p>
              {node.subtitle && <p className="text-ink-2">{node.subtitle}</p>}
              {node.pending && <p className="mt-1 text-xs" style={{ color: "var(--pending-ink)" }}>Included through screening that is pending review.</p>}
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Sources</p>
              <ul className="mt-1 space-y-1">
                {node.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a> <span className="text-xs text-muted">retrieved {s.retrievedAt.slice(0, 10)}</span></li>)}
              </ul>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Connections ({nodeEdges.length})</p>
              <ul className="mt-1 max-h-[300px] space-y-1 overflow-auto">
                {nodeEdges.map((e) => (
                  <li key={e.id}>
                    {EDGE_LABEL[e.type] ?? e.type}: {e.source === node.id ? nameOf(e.target) : nameOf(e.source)}
                    <span className="text-muted">{usd(e.amount)}{e.date ? ` · ${e.date.slice(0, 10)}` : ""}</span>{" "}
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">↗</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
