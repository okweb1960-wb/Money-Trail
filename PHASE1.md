# Phase 1 report — v1 build (Glyphosate case)

Built on 2026-11-12. Data retrieved the same day (see `/sources` in the app and `data/raw/*`).

## What was built

| Screen | Route | Status |
|---|---|---|
| Case page: timeline, pattern flags, Citizen / Investigator toggle, filings table + CSV export, "where to dig" | `/cases/glyphosate` | Done |
| Network graph (company, firms, lobbyists, PACs, officials, decisions; color + shape by type, size by connections; click for sources; table view) | `/cases/glyphosate/network` | Done |
| Revolving door (covered positions verbatim, overlap note, legality note with U.S. Code citations) | `/cases/glyphosate/revolving-door` | Done |
| Claims panel (CLAIM vs RECORD comparison) | `/cases/glyphosate/claims` | Done — 7 claims (see "Update 2026-11-13") |
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

---

## Update 2026-11-13 (owner approved: claims source, delegated review, organizations, U.S. Code)

### Claims (7, all shown as CLAIM)
- Source: the Singju Post transcript (wording) + the episode on YouTube (timestamp links). Podcast Rex (Cloudflare challenge) and YouTube (Google bot check) could not be opened from the build environment; neither block was circumvented. Every quote was checked to appear word for word in the transcript; none could be checked against the audio.
- Each claim lists what the record shows and does not show. All 7 are "partly supported". Notable record findings:
  - The U.S. brief urging the Court to take the case (2025-12-01) does **not** list Sarah Harris as a signer; she is listed on the later merits brief and argued the case.
  - The executive order (2026-02-18) came **33 days after** the Court agreed to hear the case (2026-01-16), not while it was still deciding.
  - The Court's opinion lists EPA reviews of glyphosate in 2017, 2019 and 2020 (the 2020 interim decision was vacated in 2022), which does not support "hasn't reviewed glyphosate in close to 30 years".
  - Ballard Partners reported $660,000 from Bayer U.S. LLC (2024-Q4 to 2026-Q3) for "crop protection tools"; nothing in the record links it to the Court's decision.
- Left out on purpose: allegations about private individuals (e.g. family members, a former staffer now in a private role) and allegations of crimes the loaded records cannot address (e.g. bribery, ghostwriting).

### Review (done by Claude on the owner's instruction; recorded in `reviewed_by` / `review_note`)
- Client names: all 21 confirmed.
- Activity texts (211): 26 glyphosate, 162 pesticide policy, 23 general. Changes from the machine proposal: 9 trade entries about other countries' chemical rules → general; 3 "H.R. 4288, Labeling Uniformity Act" entries → pesticide policy (the same filings describe H.R. 4288 as the Agricultural Labeling Uniformity Act).
- Covered positions (38): 12 overlap notes, written only from the filed role text (two abbreviations the screening missed were added; roles not stated in the filing were not inferred).
- Effect on flags: still 9; the "new case-related text" baseline moved from 1.48 to 1.24 new texts per quarter; no flags are pending review.

### Organizations that filed amicus briefs
- 21 organization nodes from the docket (e.g. CropLife America, U.S. Chamber of Commerce, American Farm Bureau Federation, Public Citizen, Farmworker Justice, Center for Food Safety). Excluded: filers named as individual people, the United States, and officials (already shown). The docket does not state which side each supported, so the app does not either. Petition-stage briefs link to the cert grant; merits-stage briefs link to the opinion.

### U.S. Code
- Revolving-door legality note now cites 2 U.S.C. § 1603(b)(6) (disclosure of covered positions held in the prior 20 years) and 18 U.S.C. § 207 (a), (c), (d), (e) (post-employment restrictions), checked against the text on uscode.house.gov.

### Still open
1. EO 14387 full text (blocked here) — run `npm run fetch:fr` locally, then the claim about "liability protection" in the order can be checked.
2. Claim wording has not been checked against the audio; a person should spot-check the 7 timestamps.
3. You may want to re-check the delegated review decisions (each has a reason in `review_note`).
