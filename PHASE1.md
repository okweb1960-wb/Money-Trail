# Phase 1 report — v1 build (Glyphosate case)

Built on 2026-11-12. Data retrieved the same day (see `/sources` in the app and `data/raw/*`).

## What was built

| Screen | Route | Status |
|---|---|---|
| Case page: timeline, pattern flags, Citizen / Investigator toggle, filings table + CSV export, "where to dig" | `/cases/glyphosate` | Done |
| Network graph (company, firms, lobbyists, PACs, officials, decisions; color + shape by type, size by connections; click for sources; table view) | `/cases/glyphosate/network` | Done |
| Revolving door (covered positions verbatim, overlap note, legality note) | `/cases/glyphosate/revolving-door` | Done, overlap notes pending review |
| Claims panel (CLAIM vs RECORD comparison) | `/cases/glyphosate/claims` | Built; **empty until a transcript source is approved** |
| Footer on every page; methodology; nonpartisan statement; data sources | all pages, `/methodology`, `/sources` | Done |

Pipeline: `fetch` (public APIs → `data/raw/`) → `review:generate` (human-review CSVs) → `db:load` (SQLite) → `flags` (rule engine).

## Decisions approved in Phase 0 and how they were applied

1. Total spend labelled "all issues", plus a separate count of case-related lobbying entries — done (three charts on one time axis; no dual axis).
2. Decisions = the two U.S. briefs, EO 14387 and the opinion; the six other docket items are "case events" (shown in the chronology, not used by flags).
3. Name lists are in `data/review/` for your approval; the app labels unreviewed items "pending review".
4. State-level PAC money excluded (1,063 itemized payments), along with 22 transfers between the company's own PACs.
5. Officials who filed briefs are nodes tied to the opinion: U.S. Senator Cory Booker, Missouri State Senator Jason Bean et al., 36 State Legislators, and three groups of states. "Former EPA Officials" were left out because they are not current public officials.

## What the data shows (flags fired: 9)

- **Lobbying spend above the company's own baseline** (4 quarters, 2025-Q2 to 2026-Q1): outside firms' reported income was 27–51% above the company's own 8-quarter median.
- **New case-related lobbying text listing the decision-making body** (1): 9 new texts in 2025-Q3 to 2026-Q1 listed White House offices/OMB, against an average of 1.48 new texts per quarter before.
- **New outside firm before a decision** (3 merged windows): Mercury Public Affairs (2025-Q3), Lynn Tjeerdsma Consulting (2025-Q4), Michael R. Pawlowski (2026-Q1), against an average of 0.38 new firms per quarter.
- **Revolving door** (1): one lobbyist on case-related activity near the EO lists a prior Domestic Policy Council role.
- **Contributions to a decision participant**: none. The company PACs' FEC records and the company's LD-203 reports show no contributions to Senator Booker in the window.

All flags are worded "worth a closer look" and show their baseline and evidence links.

## Changes made to the rules during the build (and why)

- Rule 2 originally fired on any case-related entry listing a White House office. Its own baseline showed the same kind of entry in **30 of 30** earlier quarters, so the flag was noise. It now flags only **new** texts and compares against the company's usual rate of new texts.
- Rule 4 originally matched the bare words "justice" and "White House", which caught a congressional "Commerce, Justice, Science" subcommittee and a "White House Liaison" job at USDA. It now matches named offices (Department of Justice, Solicitor General, Domestic Policy Council, OMB, NEC, …).
- Flags that share identical evidence across overlapping decision windows are merged.

## Pending your review

| File | Rows | What to do |
|---|---|---|
| `data/review/lda-activities.csv` | 211 distinct texts (26 name glyphosate, 168 pesticide policy, 17 weak matches) → 407 activity lines | Confirm or change the label |
| `data/review/lda-client-aliases.csv` | 21 client names (all proposed "yes") | Confirm; consider `BAYER HEALTHCARE` / `BAYER MATERIALSCIENCE` (all-issues total includes them) |
| `data/review/revolving-door.csv` | 38 covered positions (10 with a proposed overlap note) | Write your note or `none` |

## Not verified / not done

1. **Calley Means claims**: no claim text loaded. Candidate sources found (see below); none added without your approval.
2. **EO 14387 full text**: the Federal Register blocks this cloud environment's IP for full-text pages. Only title and metadata are used. Running `npm run fetch:fr` on your machine should save the text.
3. **LDA in-house vs outside overlap**: still not confirmed from LDA guidance; the two series stay separate.
4. **Legality note** on the revolving-door page is general (disclosure requirement + "ethics rules restrict some former officials for a time"); no statute is cited yet because no legal source was approved.
5. Industry-overlap notes are machine proposals until reviewed.

## Open questions

1. **Claims source**: which do you approve? (a) The official episode video on YouTube (primary, the speaker's own words; I would need you or a transcript to supply exact quotes and timestamps), (b) the Podcast Rex full transcript (third-party, possibly partly paywalled), (c) the Singjupost timestamped excerpts (third-party, selected quotes). Recommendation: quote from (b) or (c), and link every quote to the exact timestamp in (a) so readers can check it against the audio.
2. **Non-official amici** (e.g. CropLife America, U.S. Chamber of Commerce, Public Citizen, Farmworker Justice): add them to the network as "organization" nodes? This would be a new feature.
3. **Statute citation** for the revolving-door legality note: OK to add an official source (e.g. the U.S. Code on uscode.house.gov)? That is a new source.
4. Review the three CSVs above, or tell me to make a first pass and mark my decisions as yours to confirm.
