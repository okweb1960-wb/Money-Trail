import type { Metadata } from "next";
import { getDataRuns } from "@/lib/data";

export const metadata: Metadata = { title: "Data sources" };

const SOURCES = [
  { name: "Senate Lobbying Disclosure Act database (LD-2, LD-203)", url: "https://lda.gov/api/v1/", note: "lda.senate.gov showed a maintenance page during collection; lda.gov serves the same records." },
  { name: "OpenFEC API (Federal Election Commission)", url: "https://api.open.fec.gov/developers/", note: "Committee records, name history and itemized disbursements." },
  { name: "Federal Register API", url: "https://www.federalregister.gov/developers/documentation/api/v1", note: "Executive order metadata." },
  { name: "Supreme Court of the United States — docket 24-1068", url: "https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/24-1068.html", note: "Docket entries, briefs and the opinion." },
  { name: "U.S. Department of Justice, Office of the Solicitor General", url: "https://www.justice.gov/osg/brief/monsanto-co-v-durnell", note: "The government's own copy of its merits-stage brief." },
];

export default async function Sources() {
  const runs = await getDataRuns();
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Data sources</h1>
      <p className="mt-2 text-[15px] text-ink-2">Every number on this site comes from these public sources. Raw responses are saved in the repository under <code>data/raw/</code> with the exact request URL and retrieval time.</p>
      <ul className="mt-6 space-y-3">
        {SOURCES.map((s) => (
          <li key={s.url} className="rounded-md border border-line bg-surface p-3">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium">{s.name} ↗</a>
            <p className="text-sm text-ink-2">{s.note}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">Last retrieval</h2>
      <table className="mt-2 w-full text-left text-sm">
        <thead className="text-ink-2"><tr><th className="py-1">Source</th><th>Retrieved</th><th>Notes</th></tr></thead>
        <tbody>
          {runs.map((r) => <tr key={r.id} className="border-t border-line align-top"><td className="py-1.5 pr-3">{r.source}</td><td className="pr-3 tabular">{r.ranAt.slice(0, 10)}</td><td className="text-ink-2">{r.notes}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
