# Money Trail

A nonpartisan web app that shows how lobbying and political money line up in time with government decisions, using public records only. Every fact links to its source. It says "the data shows X followed Y", never "X caused Y".

v1 case: **Glyphosate** (Bayer / Monsanto lobbying and PAC money around the U.S. briefs in *Monsanto Co. v. Durnell*, Executive Order 14387, and the Supreme Court ruling).

- `PLAN.md` — architecture, data model, screens
- `FEASIBILITY.md` — what each public source returns (Phase 0)
- `PHASE1.md` — what was built, what is pending review, open questions

## Run it on Windows

Requires Node.js 22+ (https://nodejs.org). In PowerShell:

```powershell
git clone https://github.com/okweb1960-wb/Money-Trail.git
cd Money-Trail
npm install
npm run data        # builds prisma/dev.db from the saved public records in data/raw/
npm run build
npm start           # open http://localhost:3000
```

For development with hot reload: `npm run dev`.

`npm run data` needs no internet and no API keys: the raw public-record responses are saved in `data/raw/` with the exact request URL and retrieval time.

## Refresh the data from the public APIs

```powershell
copy .env.example .env.local   # then put your api.data.gov key in FEC_API_KEY
npm run fetch                  # Supreme Court, Federal Register, FEC, then LDA (~10 min; LDA is throttled)
npm run review:generate        # updates data/review/*.csv, keeping decisions you already made
npm run data                   # reload the database and recompute flags
```

Keys live only in `.env.local` (git-ignored). The FEC key is sent in a header, never in a URL, so stored source links never contain it.

## Human review (required before publishing)

Screening rules only *propose* labels. A person confirms them in three CSV files (open in Excel, fill the last column, save as CSV, then `npm run data`):

| File | Decide | Values |
|---|---|---|
| `data/review/lda-client-aliases.csv` | Which LDA client names count as the company | `yes` / `no` |
| `data/review/lda-activities.csv` | Whether each distinct lobbying text is about the case | `glyphosate_direct` / `pesticide_policy` / `general` |
| `data/review/revolving-door.csv` | A note on whether a prior government role overlaps with the client's industry | your note, or `none` |

Until a row is reviewed, the app shows the proposal with a **pending review** label. A first review pass was done on 2026-11-13 by Claude on the owner's instruction; the `reviewed_by` and `review_note` columns record each decision and its reason.

## Scripts

| Command | What it does |
|---|---|
| `npm run fetch` / `fetch:lda` / `fetch:fec` / `fetch:scotus` / `fetch:fr` | Download public records to `data/raw/` |
| `npm run review:generate` | Create/update the review CSVs |
| `npm run data` | `db:push` + `db:load` + `flags` |
| `npm test` | Unit tests, including the symmetry test for the flag rules |
| `npm run lint:copy` | Fails on causal, accusatory or partisan wording in UI code |
| `npm run feasibility` | The Phase 0 source checks |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · Prisma 7 + SQLite (libSQL adapter; swap provider/adapter to move to Postgres/Supabase) · Recharts · Cytoscape.js · tsx for scripts.
