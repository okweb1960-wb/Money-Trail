import type { Metadata } from "next";
import { getClaims } from "@/lib/data";
import { ClaimBadge, RecordBadge, SourceLink } from "@/components/Badges";

export const metadata: Metadata = { title: "Claims · Glyphosate" };

const STATUS: Record<string, string> = {
  supported_by_record: "Supported by the public record",
  partially_supported: "Partly supported by the public record",
  not_supported_by_record: "Not supported by the public record",
  not_addressed_by_record: "The public record does not address this",
  unreviewed: "Not yet compared with the record",
};

export default async function ClaimsPage() {
  const claims = await getClaims();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Glyphosate</p>
      <h1 className="text-2xl font-semibold">Claims</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-2">
        Statements made in public by named people, shown next to what the public record does and does not show. A <ClaimBadge className="align-middle" /> is an allegation, not a verified fact. A <RecordBadge className="align-middle" /> item comes from a primary public source.
      </p>
      {claims.length > 0 && (
        <p className="mt-3 max-w-3xl text-sm text-muted">Only statements about the decisions in this case are included. Allegations about private individuals, and allegations of crimes that the loaded public records cannot address, are left out on purpose.</p>
      )}
      {claims.length === 0 ? (
        <div className="mt-6 max-w-3xl rounded-lg border border-dashed border-line bg-surface p-5 text-[15px]">
          <p className="font-semibold">No claims are loaded yet.</p>
          <p className="mt-1 text-ink-2">
            This panel will show statements by Calley Means on <em>The Joe Rogan Experience</em> #2578, once the exact wording can be taken from a public transcript or recording and that source has been approved.
            Until then, nothing is paraphrased or quoted from memory.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {claims.map((c) => (
            <article key={c.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2"><ClaimBadge /><span className="text-sm text-ink-2">{c.speaker} · {c.venue}{c.timestamp ? ` · ${c.timestamp}` : ""}</span></div>
              <blockquote className="mt-2 border-l-2 border-dashed pl-3 text-[15px] italic" style={{ borderColor: "var(--claim-ink)" }}>&ldquo;{c.statement}&rdquo;</blockquote>
              <p className="mt-1 flex flex-wrap gap-x-4">
                <SourceLink href={c.sourceUrl} retrievedAt={c.retrievedAt}>Episode at {c.timestamp?.split("–")[0] ?? "timestamp"}</SourceLink>
                {c.transcriptUrl && <SourceLink href={c.transcriptUrl}>Transcript</SourceLink>}
              </p>
              {c.verificationNote && <p className="mt-1 text-xs text-muted">{c.verificationNote}</p>}
              <p className="mt-3 text-sm font-medium">{STATUS[c.status] ?? c.status}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-surface-2 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">What the record shows <RecordBadge /></p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{c.recordShows.map((r, i) => <li key={i}>{r.text} {r.refs.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="ml-1">↗</a>)}</li>)}</ul>
                </div>
                <div className="rounded-md bg-surface-2 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">What the record does not show</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{c.recordDoesNotShow.map((r, i) => <li key={i}>{r.text} {r.refs.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="ml-1">↗</a>)}</li>)}</ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
