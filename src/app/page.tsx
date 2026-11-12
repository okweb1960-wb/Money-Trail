import Link from "next/link";
import { getDecisions, getFlags } from "@/lib/data";

export default async function Home() {
  const [decisions, flags] = await Promise.all([getDecisions(), getFlags()]);
  const majors = decisions.filter((d) => d.tier === "decision");
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Money Trail</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-2">
        A nonpartisan look at how lobbying and political money line up in time with government decisions — using public records only, with every fact linked to its source.
      </p>
      <p className="mt-2 text-[15px] text-ink-2">It shows what the records say happened and when. It does not say that money caused any decision.</p>
      <Link href="/cases/glyphosate" className="mt-8 block rounded-lg border border-line bg-surface p-5 no-underline hover:border-ink-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Case</p>
        <p className="text-xl font-semibold text-ink">Glyphosate</p>
        <p className="mt-1 text-[15px] text-ink-2">{majors.length} federal decisions from {majors[0]?.date.slice(0, 4)} to {majors[majors.length - 1]?.date.slice(0, 4)}, lobbying reports since 2018, PAC contributions, and {flags.length} pattern flags worth a closer look.</p>
      </Link>
    </div>
  );
}
