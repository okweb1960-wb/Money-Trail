# FEASIBILITY — Phase 0 data check (Glyphosate case)

Run date: **2026-11-12**. Window: **2018-01-01 → today** (from Bayer's acquisition of Monsanto).
Every number below comes from a script in `scripts/feasibility/` and the JSON it wrote to `data/feasibility/`. Re-run with `npm run feasibility` (see "How to re-run" at the end).

Nothing here is a finding about wrongdoing. This document only says **what data exists, how good it is, and which dates we can anchor to.**

---

## 0. Summary

| Source | Retrievable? | Quality for v1 | Biggest gap |
|---|---|---|---|
| Senate LDA (lobbying) | **Yes**, via `lda.gov` (`lda.senate.gov` showed a maintenance page) | Good: quarterly amounts, firms, named lobbyists, covered positions, issue text, agencies lobbied, LD-203 contributions | Spending is company-wide, not per issue. Glyphosate relevance has to come from short free-text descriptions, reviewed by a person. |
| OpenFEC (contributions) | **Yes** (with your api.data.gov key) | Good for PAC → candidate/committee money with dates and filing images | Employee "employer" field is free text and noisy. Executive-branch officials are not FEC candidates. |
| Federal Register | **Yes** | Exact EO metadata retrieved | The service started blocking this environment's shared IP after a few requests. The EO PDF is on govinfo.gov, which this environment can't reach. |
| Supreme Court | **Yes** (docket JSON + PDFs) | Every anchor date is on the official docket with document links | No official API; the docket JSON format is undocumented. |
| DOJ Solicitor General | **Yes** (one page) | The filer's own copy of the merits-stage brief | Only the merits-stage brief is on that page. |

**Verdict:** all four v1 sources can support the screens in PLAN.md. Two things need your decision before Phase 1: how to treat the company's **total** lobbying spend (it is not glyphosate-specific), and the **entity alias lists** (which name variants count as Bayer/Monsanto).

---

## 1. Decision anchors (verified; exact text from source)

| # | Date | Kind | What the record says | Primary source |
|---|---|---|---|---|
| D1 | 2025-04-04 | court (filing) | "Petition for a writ of certiorari filed." *Monsanto Company, Petitioner v. John L. Durnell*, No. 24-1068; lower court: Court of Appeals of Missouri, Eastern District (ED112410), decided 2025-02-11 | [Docket JSON](https://www.supremecourt.gov/RSS/Cases/JSON/24-1068.json) · [Docket page](https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/24-1068.html) |
| D2 | 2025-06-30 | court (order) | "The Solicitor General is invited to file a brief in this case expressing the views of the United States." | Docket |
| D3 | **2025-12-01** | **court_brief** | "Brief amicus curiae of United States filed." Conclusion: "The petition for a writ of certiorari should be granted." Signed by D. John Sauer, Solicitor General. | [Brief PDF](https://www.supremecourt.gov/DocketPDF/24/24-1068/386073/20251201170732560_24-1068%20--%20Monsanto%20v.%20Durnell.pdf) |
| D4 | 2026-01-16 | court_ruling (order) | "Petition GRANTED limited to the following Question: Whether the Federal Insecticide, Fungicide, and Rodenticide Act preempts a label-based failure-to-warn claim where EPA has not required the warning." | Docket |
| D5 | **2026-02-18** signed · 2026-02-23 published | **executive_order** | **Executive Order 14387**, "Promoting the National Defense by Ensuring an Adequate Supply of Elemental Phosphorus and Glyphosate- Based Herbicides" (title as printed). FR document **2026-03628**, **91 FR 8703**. EO notes: "See: EO 13603, March 16, 2012". | [Federal Register](https://www.federalregister.gov/documents/2026/02/23/2026-03628/promoting-the-national-defense-by-ensuring-an-adequate-supply-of-elemental-phosphorus-and) · [XML full text](https://www.federalregister.gov/documents/full_text/xml/2026/02/23/2026-03628.xml) |
| D6 | **2026-03-02** | **court_brief** | "Brief amicus curiae of the United States filed." (merits stage). Conclusion: "The Missouri Court of Appeals' judgment should be reversed." | [Brief PDF (Court)](https://www.supremecourt.gov/DocketPDF/24/24-1068/399785/20260302183259184_24-1068%20Monsanto%20tsac.pdf) · [DOJ OSG page](https://www.justice.gov/osg/brief/monsanto-co-v-durnell) · [DOJ PDF](https://www.justice.gov/sites/default/files/2026-03/24-1068_monsanto_tsac.pdf) |
| D7 | 2026-04-17 | court (order) | SG motion to participate in oral argument as amicus and for divided argument GRANTED. | Docket |
| D8 | 2026-04-27 | court (event) | "Argued. For petitioner: Paul D. Clement …; and Sarah M. Harris, Principal Deputy Solicitor General … (for United States, as amicus curiae.) For respondent: Ashley C. Keller …" | Docket |
| D9 | **2026-06-25** | **court_ruling** | "Judgment REVERSED and case REMANDED." Kavanaugh, J., for the Court (Roberts, Thomas, Alito, Sotomayor, Kagan, Barrett). Thomas, J., concurring. Jackson, J., dissenting, joined by Gorsuch, J. Syllabus "Held: FIFRA expressly preempts Durnell's state-law failure-to-warn claim because the claim would require Monsanto to add a cancer warning to Roundup's label." | [Opinion PDF](https://www.supremecourt.gov/opinions/25pdf/24-1068_n7ip.pdf) |
| D10 | 2026-07-27 | court (event) | "Judgment and Mandate Issued." | [Mandate PDF](https://www.supremecourt.gov/DocketPDF/24/24-1068/417323/20260727103042801_EFILING%2024-1068%20Rev%20Rem%20MANDATE%20COSTS%20Mo.%20App.%20E.D..pdf) |

Also on the docket (useful for the network graph and the "public officials tied to a decision" rule): amicus briefs filed by public officials and governments, including **U.S. Senator Cory Booker**, **Missouri State Senator Jason Bean, et al.**, **36 State Legislators**, **Nebraska, et al.**, **Texas, et al.**, **New Mexico, et al.**, and **Former EPA Officials, et al.** The docket has 35 amicus-brief entries out of 63 docket entries.

Only one Federal Register **executive order** mentions glyphosate (the only other presidential document is a 1995 narcotics determination). One later Federal Register document cites EO 14387: a USDA "Delegations of Authority" rule (2026-04-13, doc 2026-07088).

**Not a v1 decision type, but available:** 122 agency rules, proposed rules and notices since 2018 mention glyphosate (mostly EPA pesticide actions, e.g. "Glyphosate Open Literature Search To Inform Human Health Risk Assessment", 2026-09-28). Adding them would be a new feature, so I haven't.

---

## 2. Senate LDA — `data/feasibility/lda.json`

**Base:** `https://lda.gov/api/v1` (works). `https://lda.senate.gov/api/v1` returned HTTP 503 "U.S. Senate: Site Under Maintenance" throughout the run.

| Check | Result |
|---|---|
| Client-name variants | 39 kept as Bayer/Monsanto (e.g. `BAYER CORPORATION (FKA MONSANTO COMPANY)`, `BAYER U.S. LLC`, `MONSANTO COMPANY`, `WILMER CUTLER … (ON BEHALF OF MONSANTO)`); 5 excluded for review: `BAYER`, `BAYER (FORMERLY KNOWN AS CONCEPTUS)`, `BAYER CLOTHING GROUP`, `BAYER DIAGNOSTICS`, `DAVID BAYER AND BAYPOINTE AT NAPLES CAY` (the last is a private individual and must stay out). |
| LD-2 filings 2018–2026 | **539** (per year: 2018 92 · 2019 67 · 2020 55 · 2021 50 · 2022 54 · 2023 53 · 2024 48 · 2025 68 · 2026 52 so far) |
| Quarterly amounts | Available every quarter 2018-Q1 → 2026-Q3. Two separate series: **in-house reported expenses** (Bayer's consolidated self-filed report) and **outside-firm reported income**. Example: 2025-Q1 in-house $2,950,000; outside firms $730,000 across 11 firms. 2026-Q3 in-house $1,710,000; outside firms $820,000 across 14 firms. |
| Outside registrants | 31 firms. Most frequent: The Washington Tax & Public Policy Group, Akin Gump, Capitol Counsel, Venture Government Strategies, The Russell Group (35 filings each), Todd Strategy Group, BGR Government Affairs, Invariant, ACG Advocacy, East End Group … |
| Named lobbyists | **186** distinct; **131** list a covered position (prior government job). Covered positions are verbatim text, e.g. "Chief of Staff Congressman Roy Blunt"; "Spec. Asst to Pres for leg affairs, exec ofc of pres, jan08-dec08 …". |
| Agencies lobbied (activity count) | House 1,377 · Senate 1,368 · USDA 467 · EPA 442 · USTR 341 · Treasury 318 · FDA 275 · NEC 267 · NSC 267 · Executive Office of the President 256 · … · White House Office 235 · OMB 15 |
| Glyphosate screen | 466 activity entries hit at least one broad term. The **strong-term** series (glyphosate, Roundup, FIFRA, preemption, uniformity, failure to warn) per quarter runs 1–7 in 2018–2023, then 2025-Q3 **11**, 2025-Q4 **14**, 2026-Q1 **15**, 2026-Q2 8, 2026-Q3 7. |
| LD-203 contributions | **223** reports, **987** itemized items (938 FECA contributions, 48 honorary expenses, 1 presidential inaugural committee). Each has date, amount, payee, honoree, filer and a link. |

**Examples of what the activity text supports (verbatim, for your review; not yet RECORD on screen):**
- Lynn Tjeerdsma Consulting, sub-contracted via "Akin, Gump, Strauss, Hauer & Feld on behalf of Bayer Corporation": 2025-Q4 "Glyphosate liability protection in legislation" (entity: Senate) — [filing](https://lda.gov/filings/public/filing/a7d1bf4f-8d71-4216-802a-fc51c6c53dee/print/). The same text appears in 2026-Q1 — [filing](https://lda.gov/filings/public/filing/d1da351c-0de2-44e1-bf22-59af92881350/print/).
- Bayer Corporation (consolidated report), 2025-Q3, issue NAT: "… Monitor and engage regarding the inclusion of glyphosate on the critical minerals list." Entities listed include White House Office, OMB, Interior, BLM, USGS, EPA, House, Senate — [filing](https://lda.gov/filings/public/filing/c0647eff-56a5-4e0e-849a-c05bd688fb8e/print/).
- Bayer Corporation (consolidated report), 2025–2026, issue BUD: "… related to the uniformity of pesticide labeling." — e.g. [2026-Q1 filing](https://lda.gov/filings/public/filing/a229bfd0-5906-4e09-949f-3e2dab8d1b73/print/).

These are the kind of items rule `issue_named_near_decision` would surface as "worth a closer look", alongside the baseline (the same company's earlier quarters).

**Rate limits:** no rate-limit headers. At one request per 1.2 s, anonymous access got **HTTP 429 five times in 69 requests**, each followed by a `Retry-After` of 4–26 s, and every retry succeeded. Maximum `page_size` is 25. A free LDA API key (header `Authorization: Token …`) should raise the limit. **A full pull takes about 6 minutes.**

**Gaps / caveats**
1. **Spend is company-wide.** Bayer is a diversified company (crop science, pharmaceuticals, consumer health). LD-2 gives one quarterly total per registrant–client pair, not a total per issue. The timeline can show total spend plus a separate count of glyphosate-related activity entries, but cannot say how much money went to glyphosate.
2. **In-house vs outside-firm overlap.** I could not find the LDA guidance on lda.gov during this run that says whether the in-house expense figure already includes payments to outside firms. Until that's checked, show the two series separately and never sum them.
3. **Keyword false positives.** "Uniformity"/"label" also match over-the-counter medicine labeling (issue HCR). Every activity needs human confirmation before it is tagged `glyphosate_confirmed`.
4. **Sub-contracted amounts.** Sub-contractor filings (e.g. Lynn Tjeerdsma via Akin Gump) show no income figure. Those payments sit inside the prime firm's income.
5. **People layer.** 131 lobbyists have covered positions, but the rules allow showing only those tied to a decision. Phase 1 will show only lobbyists listed on a **confirmed glyphosate-related activity**.
6. Amendments: I keep the latest-posted filing per registrant + client + quarter. Filing types include amendments (`1A`, `2A`…), terminations (`1T`…) and no-activity reports (`Q1Y`…).

---

## 3. OpenFEC — `data/feasibility/fec.json`

| Check | Result |
|---|---|
| Affiliated committees | **C00281162** BAYER US LLC EMPLOYEE POLITICAL ACTION COMMITTEE (BAYERPAC), active through 2026. Name history: Miles Inc PAC (1994) → Bayer Corporation PAC (1996–2016) → Bayer U.S. LLC PAC (2018–2020) → BayerPAC (2022–2026). |
| | **C00042069** — FEC history shows **Monsanto Company Citizenship Fund** (1976–2016), renamed **Bayer Corporation Crop Science Employees Citizenship Fund** for 2018–2020, filing frequency **T (terminated)**, last file date **2019-08-14**. It transferred money to the Bayer U.S. LLC PAC before terminating (largest single recipient by amount in its 2017–2019 disbursements). |
| | C00232330 (Rhône-Poulenc → Aventis CropScience → Bayer CropScience Holding PAC), terminated 2003; outside the window. |
| PAC totals | BayerPAC receipts / disbursements by cycle are available (e.g. 2024: receipts $656,681.98, disbursements $568,907.68). |
| Itemized PAC disbursements | BayerPAC: **1,701** itemized (2017-01-16 → 2026-09-09); **1,662** to candidates/committees; **740** carry an FEC candidate ID. **808** go to recipients with no FEC committee ID (mostly state and local candidates), and 16 are transfers to affiliated committees (e.g. BAYER US LLC MISSOURI PAC). Every row has a date and a link to the filing image (`docquery.fec.gov`). |
| | Former Monsanto PAC (C00042069): 590 itemized, 534 to candidates/committees, 191 with candidate ID. |
| Employee contributions | `schedule_a/by_employer` gives per-cycle totals by employer string. After an allowlist filter: 2018 $1.06M (21,828 receipts), 2020 $0.94M, 2022 $0.46M, 2024 $0.79M, 2026 $0.44M so far. **64 of 100** sampled 2024 itemized receipts went to an affiliated PAC (payroll deduction), and many others went to conduits (ActBlue/WinRed). |

**Rate limits:** your key worked (requests return 200 without `api_key` in the URL; the key goes in `X-Api-Key`). The response header showed `X-RateLimit-Limit: 60`. No 429s occurred in about 45 requests. Itemized endpoints sometimes return **504 "Query timed out"**, and retries succeed. Pagination for itemized data is **keyset** (`last_index` + `last_disbursement_date`), not page numbers.

**Gaps / caveats**
1. **Employer strings are noisy.** The search for "bayer" also returns *Bayer Properties*, *Jenna Bayer Garden Design*, *Bayer Construction* and individual people. My allowlist also wrongly excludes real variants (e.g. `BAYER-MONSANTO`, `MONSANTO LLC`, `BAYER ENVIRONMENTAL SCIENCE`). A reviewed alias list is required.
2. **Employee money ≠ money to officials.** Most goes to the company's own PAC, so counting both would double count. The cleaner signal is the **PAC's disbursements to candidates**.
3. **State recipients.** About half of BayerPAC's itemized payments go to non-federal recipients. They're out of scope for v1 unless you want them.
4. **Executive-branch decision makers** (President, SG, EPA, USDA) are not FEC candidates. The only FEC link to an executive decision is via a campaign or party committee. That needs very careful wording, and I recommend leaving it out of pattern flags.
5. FEC itemizes individual receipts only above $200 per cycle.

---

## 4. Federal Register — `data/feasibility/federal-register.json`

- Search `conditions[term]=glyphosate` + `type=PRESDOCU` → 2 presidential documents, 1 executive order (EO 14387; details in §1).
- Detail endpoint gives signing date, publication date, FR document number, citation, president, HTML, XML and PDF URLs, and EO notes.
- **Problem 1:** after a handful of requests (about 15 across all runs), the service returned **HTTP 403** and then an HTML page: *"Your IP address has been blocked - please contact support"*. This environment's outbound traffic shares an IP, so it may not happen on your machine. The script already retries; Phase 1 should cache responses and stay at a few requests per run.
- **Problem 2:** the official PDF is on `www.govinfo.gov`, which isn't on this environment's allowed hosts. The FR HTML page and XML full text are on `federalregister.gov` and serve as the stored sources.
- No API key; no rate-limit headers; dates are day-precision only.

---

## 5. Supreme Court + DOJ — `data/feasibility/scotus.json`

- `https://www.supremecourt.gov/RSS/Cases/JSON/24-1068.json` returns the full docket (caption, lower court, every entry with date, text and document links). All 9 anchors parse automatically. Every linked PDF returned HTTP 200/206.
- The script **checks the docket identity** (petitioner contains "Monsanto", respondent "Durnell"), so the one hardcoded input, the docket number, is verified against the record on every run.
- The DOJ OSG page for *Monsanto Co. v. Durnell* links one PDF, the merits-stage brief (page dated 2026-03-02). The cert-stage brief (2025-12-01) is linked only from the Court's docket.
- Gaps: there's no official API and the JSON format is undocumented, so the HTML docket is the fallback. Dates are day-only. The labels "cert stage" and "merits stage" for the two U.S. briefs are inferred from their order relative to the grant (the brief conclusions quoted in §1 confirm it).

---

## 6. What I could NOT verify (left out of any visuals)

1. Whether LDA in-house expense totals include payments to outside firms (guidance not found on lda.gov in this run).
2. The cause or purpose behind any spending change. Only amounts and dates are in the record.
3. The text of EO 14387 beyond its title and metadata. The Federal Register blocked the full-text request in this run, so the operative sections haven't been read yet.
4. Calley Means' statements on The Joe Rogan Experience #2578. No transcript has been retrieved yet, as agreed; I'll look for a public transcript and **ask you before adding it as a source**.
5. Which filings' activity text is truly about glyphosate (needs human review; the keyword screen is a starting list).
6. Whether the `BAYER` client name (no suffix) on LDA is the same company.

---

## 7. Open questions for you

1. **Total vs. glyphosate-specific spend.** OK to show total quarterly lobbying (clearly labelled "all issues"), with a separate overlay counting confirmed glyphosate-related activity entries?
2. **Which decisions go on the timeline as "decisions"?** My proposal: D3 (U.S. cert brief), D5 (EO 14387), D6 (U.S. merits brief), D9 (opinion) as decisions, and D1, D2, D4, D7, D8, D10 as lighter "case events".
3. **Alias review.** I'll produce `data/aliases/*.csv` (LDA client names, FEC employer strings, FEC committees) for you to approve before Phase 1 loads anything. OK?
4. **State-level PAC money** (about half of BayerPAC's itemized payments): exclude from v1? (Recommended: exclude, and say so in the methodology.)
5. **Amicus officials** (e.g. a U.S. Senator and state legislators who filed briefs): include them as `official` nodes tied to D9? They meet the rule (public officials, tied to a specific decision).
6. **New hosts.** Adding `www.govinfo.gov` (official PDF of the EO, from GPO) would be a new source/host. Want it?
7. **LDA API key.** Optional. It would cut the 429 slowdowns. Add `LDA_API_KEY` to `.env.local` if you register one.
8. **GitHub repo.** It doesn't exist yet. Please create an empty private repo named **`Money-Trail`** under `okweb1960-wb` (GitHub doesn't allow `&` or spaces, so "M&I Trail" isn't possible), and I'll push.

---

## How to re-run (Windows)

```powershell
npm install
copy .env.example .env.local   # then paste your api.data.gov key into FEC_API_KEY
npm run feasibility             # or feasibility:lda | :fec | :fr | :scotus
```

Outputs go to `data/feasibility/*.json`. Each record keeps the exact `source_url` and `retrieved_at`.
