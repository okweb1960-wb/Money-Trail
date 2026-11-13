import type { Metadata } from "next";
import { getNetwork } from "@/lib/data";
import { NetworkGraph } from "@/components/NetworkGraph";
import { KINDS } from "@/lib/graph-kinds";
import { RecordBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Network · Glyphosate" };

export default async function NetworkPage() {
  const { nodes, edges } = await getNetwork();
  const name = new Map(nodes.map((n) => [n.id, n.label]));
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Glyphosate · Investigator view</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Network</h1>
        <RecordBadge />
      </div>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-2">
        Who is connected to whom in the public record: the company, the firms that reported lobbying for it, the lobbyists on case-related activity near a decision, the company&apos;s PACs, and the officials who issued or filed in a decision.
        A connection is a filing or docket entry, not a judgment about influence. People appear only if they are public officials or registered lobbyists tied to a decision.
      </p>
      <div className="mt-6">
        <NetworkGraph nodes={nodes} edges={edges} />
      </div>
      <details className="mt-6 rounded-md border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Table view ({nodes.length} nodes, {edges.length} connections)</summary>
        <div className="grid gap-4 p-3 lg:grid-cols-2">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-2"><tr><th className="py-1">Node</th><th>Type</th><th>Source</th></tr></thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id} className="border-t border-line"><td className="py-1 pr-2">{n.label}</td><td className="pr-2">{KINDS.find((k) => k.kind === n.kind)?.label}</td><td><a href={n.sources[0]?.url} target="_blank" rel="noopener noreferrer">↗</a></td></tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-left text-xs">
            <thead className="text-ink-2"><tr><th className="py-1">From</th><th>Connection</th><th>To</th><th>Side (briefs)</th><th>Source</th></tr></thead>
            <tbody>
              {edges.map((e) => (
                <tr key={e.id} className="border-t border-line"><td className="py-1 pr-2">{name.get(e.source)}</td><td className="pr-2">{e.type.replace(/_/g, " ")}</td><td className="pr-2">{name.get(e.target)}</td><td className="pr-2">{e.side ? e.side.replace("_", " ") : ""}</td><td><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">↗</a></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
