# Money Trail — PLAN (Phase 0)

Working title: **Money & Influence Tracker**. v1 case: **Glyphosate**.

A nonpartisan web app that shows how money (lobbying, PAC and employee contributions) sits in time and in relationship to government decisions. It surfaces patterns ("worth a closer look") and never declares cause or corruption. Every fact links to a public primary source.

> Status: Phase 1 built (see `PHASE1.md`). Phase 0 results: `FEASIBILITY.md`.

---

## 1. Principles → engineering rules

| Rule | How the code enforces it |
|---|---|
| Public records only | Ingest scripts only talk to the source allowlist in `scripts/lib/sources.ts` (Phase 1). Anything else needs your approval first. |
| Every data point has `source_url` + `retrieved_at` | Both columns are `NOT NULL` on every fact table (Prisma schema below). UI components take a `Sourced<T>` type and render nothing without a source. |
| RECORD vs CLAIM | Separate tables (`Claim` is never joined into fact tables). Separate React components (`<RecordBadge>`, `<ClaimBadge>`) with distinct, non-partisan styling (shape + label, not party colors). Claims are rendered in quotation blocks with the speaker's name. |
| Identical logic for everyone | Pattern-flag rules are pure functions of (entity, decisions, filings). No party, administration or name appears in rule code. A unit test runs every rule on a synthetic dataset with the party labels swapped and asserts identical output. |
| People layer limited to officials + registered lobbyists tied to a decision | `Entity.kind` allows only `official` and `lobbyist` for people. A person node renders only if an `Edge` links it to a `Decision` (directly or via a filing on this case). |
| No facts from memory | Seed data comes only from `data/raw/*.json` produced by scripts. A `verification` field (`verified` / `unverified`) is set by ingest; `unverified` rows are excluded from charts and graphs. |
| No secrets in code | `.env.local` (gitignored) + `.env.example`. FEC key goes in the `X-Api-Key` header, never in a stored URL. |

Copy rules (enforced in review + a lint list of banned words in UI strings): "followed", "preceded", "during the same quarter", "worth a closer look". Banned: "caused", "bought", "corrupt", "paid for", "in exchange for", party adjectives.

---

## 2. Architecture

```
               ┌──────────────── scripts/ (tsx, run locally on Windows) ────────────────┐
 Public APIs → │ fetch/*.ts  → data/raw/<source>/<date>.json  (raw responses + retrieved_at) │
               │ normalize/*.ts → entity resolution (reviewed alias lists in data/aliases)   │
               │ load.ts → Prisma → SQLite (prisma/dev.db)                                   │
               │ flags.ts → rule engine → PatternFlag rows (with baseline + evidence ids)    │
               └─────────────────────────────────────────────────────────────────────────────┘
                                              │
                         Next.js App Router (server components read SQLite via Prisma)
                                              │
     /cases/glyphosate  ·  /cases/glyphosate/network  ·  /cases/glyphosate/revolving-door
     /cases/glyphosate/claims  ·  /methodology  ·  /sources
```

- **Next.js (App Router) + TypeScript + Tailwind.** Pages are server components; data is static per build (no live API calls from the browser, no keys in the client).
- **SQLite via Prisma** for v1. Schema uses only portable types so a later move to Supabase/Postgres is a `provider` change plus a migration.
- **Charts: Recharts** (timeline). **Graph: Cytoscape.js** (recommended over react-force-graph-2d: built-in layouts, deterministic positions, and easier accessible fallbacks such as a table of nodes and edges).
- **Data scripts** in `/scripts`, run with `tsx`. Raw responses are cached so the pipeline can be re-run offline and audited.
- **Windows**: all scripts are cross-platform Node (no bash). `npm run` scripts only. Paths via `node:path`.

### Source allowlist (v1)

| Source | Base URL | Used for |
|---|---|---|
| Senate LDA | `https://lda.gov/api/v1` (`lda.senate.gov` was in maintenance) | LD-2 lobbying filings, registrants, lobbyists, covered positions, LD-203 contributions |
| OpenFEC | `https://api.open.fec.gov/v1` | PAC disbursements, committee history, employee contributions by employer |
| Federal Register | `https://www.federalregister.gov/api/v1` | Executive order metadata + full text |
| Supreme Court | `https://www.supremecourt.gov/RSS/Cases/JSON/<docket>.json` + DocketPDF links | Docket events, briefs, opinion |
| DOJ OSG | `https://www.justice.gov/osg/brief/...` | Filer's own copy of the U.S. brief |

---

## 3. Data model (Prisma draft)

Your five core models plus two supporting ones (`PatternFlag`, `Alias`). Every fact row carries `sourceUrl`, `retrievedAt`, `verification`.

```prisma
enum EntityKind   { company lobbying_firm lobbyist official committee }
enum DecisionKind { executive_order court_brief court_ruling }
enum FilingKind   { lobbying contribution }
enum EdgeType     { lobbied_for        // lobbying_firm/lobbyist → company (client)
                    employed_by        // lobbyist → lobbying_firm (registrant)
                    lobbied_entity     // filing → government entity listed on LD-2
                    contributed_to     // committee/company → committee/official
                    issued             // official/agency → decision
                    filed_in           // party/amicus → court decision
                    prior_role }       // lobbyist → official body (covered position)
enum Verification { verified unverified }
enum ClaimStatus  { supported_by_record partially_supported not_supported_by_record not_addressed_by_record unreviewed }

model Entity {
  id           String       @id @default(cuid())
  kind         EntityKind
  name         String
  externalIds  String       // JSON: { lda_client_id, lda_registrant_id, lda_lobbyist_id, fec_committee_id, fec_candidate_id }
  partyLabel   String?      // stored only as the source states it (e.g. FEC); never used by rules or colors
  sourceUrl    String
  retrievedAt  DateTime
  verification Verification @default(unverified)
  aliases      Alias[]
  edgesFrom    Edge[]       @relation("from")
  edgesTo      Edge[]       @relation("to")
}

model Alias {               // reviewed name variants, e.g. "BAYER CORPORATION (FKA MONSANTO COMPANY)"
  id        String @id @default(cuid())
  entityId  String
  entity    Entity @relation(fields: [entityId], references: [id])
  alias     String
  source    String  // "lda_client" | "fec_employer" | ...
  reviewed  Boolean @default(false)
  @@unique([alias, source])
}

model Decision {
  id           String       @id @default(cuid())
  caseSlug     String       // "glyphosate"
  kind         DecisionKind
  title        String       // exact title from source
  identifier   String       // e.g. FR doc number, EO number, docket number + entry
  date         DateTime     // signing / filing / decision date as the source states it
  dateKind     String       // "signed" | "published" | "filed" | "decided"
  summary      String?      // short neutral summary, quoting the source where possible
  sourceUrl    String
  retrievedAt  DateTime
  verification Verification @default(unverified)
}

model Filing {
  id           String       @id @default(cuid())
  kind         FilingKind
  externalId   String       @unique   // LDA filing_uuid or FEC sub_id/transaction id
  periodStart  DateTime?    // LD-2 quarter start
  periodEnd    DateTime?
  date         DateTime?    // contribution date / LD-2 posted date
  amount       Decimal?
  amountKind   String       // "lda_income" | "lda_expenses" | "fec_disbursement" | "fec_receipt"
  issueCodes   String?      // JSON array
  description  String?      // verbatim activity text
  relevance    String?      // "glyphosate_confirmed" | "glyphosate_candidate" | "general"
  payload      String       // JSON of the normalized source record
  sourceUrl    String
  retrievedAt  DateTime
  verification Verification @default(unverified)
}

model Edge {
  id           String       @id @default(cuid())
  type         EdgeType
  fromId       String
  toId         String
  from         Entity       @relation("from", fields: [fromId], references: [id])
  to           Entity       @relation("to",   fields: [toId],   references: [id])
  decisionId   String?      // when the edge touches a decision
  filingId     String?      // the filing that evidences this edge
  amount       Decimal?
  date         DateTime?
  sourceUrl    String
  retrievedAt  DateTime
  verification Verification @default(unverified)
}

model Claim {
  id           String      @id @default(cuid())
  caseSlug     String
  speaker      String      // e.g. "Calley Means"
  venue        String      // e.g. "The Joe Rogan Experience #2578"
  statement    String      // verbatim quote
  timestamp    String?     // position in episode
  sourceUrl    String      // episode or transcript link
  retrievedAt  DateTime
  status       ClaimStatus @default(unreviewed)
  recordShows    String?   // what the public record does show (with links in RecordRef)
  recordDoesNotShow String?
  refs         String      // JSON array of Decision/Filing/Edge ids used in the comparison
}

model PatternFlag {
  id          String   @id @default(cuid())
  caseSlug    String
  rule        String   // rule id, e.g. "spend_above_own_baseline"
  subjectId   String   // Entity id
  decisionId  String?
  window      String   // e.g. "2025-Q4 .. 2026-Q1"
  observed    String   // JSON: the measured value(s)
  baseline    String   // JSON: the comparison values + how computed
  evidence    String   // JSON array of Filing/Edge ids
  wording     String   // generated neutral sentence
  computedAt  DateTime
}
```

---

## 4. Decisions anchored in v1 (all verified in Phase 0; see FEASIBILITY.md)

| Date | Kind | Decision | Source |
|---|---|---|---|
| 2025-06-30 | court (order) | Court invites the Solicitor General's views (CVSG) | SCOTUS docket 24-1068 |
| 2025-12-01 | court_brief | U.S. amicus brief, cert stage: "petition … should be granted" | SCOTUS DocketPDF |
| 2026-01-16 | court_ruling (order) | Certiorari granted (limited question) | SCOTUS docket |
| 2026-02-18 (signed) / 2026-02-23 (published) | executive_order | EO 14387, FR doc 2026-03628, 91 FR 8703 | Federal Register |
| 2026-03-02 | court_brief | U.S. amicus brief, merits stage: judgment "should be reversed" | SCOTUS DocketPDF + DOJ OSG |
| 2026-04-27 | court (event) | Oral argument (SG participated as amicus) | SCOTUS docket |
| 2026-06-25 | court_ruling | Opinion: judgment reversed and remanded | supremecourt.gov opinion PDF |

Whether the CVSG order, cert grant and argument count as "decisions" or as timeline context is an open question for you (see FEASIBILITY.md).

---

## 5. v1 screens

### 5.1 Case page — `/cases/glyphosate`
- **Header**: case summary in neutral language with every decision linked.
- **Timeline (Recharts ComposedChart)**:
  - X axis: quarters from 2018-Q1 to today.
  - Bars: quarterly lobbying, shown as **two separate series** (in-house reported expenses; outside-firm reported income). They are not summed, because one can include the other (see FEASIBILITY gaps).
  - Line/dots: PAC contributions to federal candidates/committees per quarter (count and amount), and optionally "glyphosate-related activity count" from LD-2 descriptions (confirmed matches only).
  - Vertical reference lines: each Decision, labelled with date and kind, clickable to the source.
  - Every bar/dot tooltip lists the filings behind it with links.
- **Pattern flags** (rule engine; each card shows observed value, baseline, evidence links and the sentence "Worth a closer look. This is a timing pattern, not evidence of cause."):
  1. `spend_above_own_baseline` — a quarter's reported lobbying in the 2 quarters before/after a decision exceeds the company's own trailing 8-quarter median by ≥ X% (X shown; default 25%).
  2. `issue_named_near_decision` — confirmed glyphosate/FIFRA/preemption activity text lists the government body that made the decision (e.g. Executive Office of the President, Dept. of Justice) in the decision quarter or the one before.
  3. `new_outside_firm` — a new outside registrant for the client appears within 2 quarters before a decision (baseline: average new firms per quarter for this client).
  4. `revolving_door_overlap` — a lobbyist on a relevant activity lists a covered position in a body involved in the decision.
  5. `contribution_to_decision_participant` — PAC contribution to a federal official who took a documented, public action in the case (e.g. filed an amicus brief), compared with the PAC's typical giving to officials of the same chamber.
  - Rules are applied identically to every entity; thresholds are global constants shown on `/methodology`.
- **Citizen / Investigator toggle** (URL param `?view=citizen|investigator`, default citizen):
  - Citizen: plain-English "what happened, in order" + "what this decision changes for people" — only effects stated in the decision documents themselves (e.g. the opinion's holding on failure-to-warn claims). No speculation.
  - Investigator: the lead, the filings table (sortable, exportable CSV), and a "where to dig" list (e.g. read activity text in quarter X; compare lobbying-report government entities with the decision-maker; check LD-203s of named lobbyists).

### 5.2 Network graph — `/cases/glyphosate/network` (Investigator)
- Cytoscape.js. Nodes: company, lobbying_firm, lobbyist, official, committee, decision. Edges: `lobbied_for`, `employed_by`, `contributed_to`, `filed_in`, `issued`, `prior_role`.
- Color by node **type** (neutral palette, never red/blue), size by degree (hot spots). Shape also encodes type for color-blind users.
- Click a node → side panel lists every source behind it. Filter by time window and edge type. A table view mirrors the graph for accessibility.

### 5.3 Revolving door — `/cases/glyphosate/revolving-door`
- Table of lobbyists on this case's filings with covered positions **verbatim** from LD-2, linked to the filing, first/last quarter seen, registrant.
- "Overlap with client's industry" is a manual tag (e.g. former agriculture committee staff) with the reviewer's note — never inferred automatically.
- Plain note: "Former government employees may legally register as lobbyists. Federal law sets cooling-off periods for some roles (cited on the methodology page). Listing a prior role does not suggest any rule was broken."

### 5.4 Claims panel — `/cases/glyphosate/claims`
- Each claim: speaker, venue, verbatim statement, timestamp, link — labelled **CLAIM**.
- Two columns: "What the public record shows" / "What the public record does not show", each line linked to RECORD items. Status values: supported / partially supported / not supported / not addressed by the record / unreviewed.
- Source for claim text: a public transcript or video, to be found and approved by you before use.

### 5.5 Footer (every page)
Methodology · Nonpartisan statement · Data sources (with retrieved dates) · "Correlation is not causation." · Last data refresh.

---

## 6. Phase 1 build order (after approval)

1. Scaffold Next.js + Tailwind + Prisma; schema + migration; footer + methodology shell.
2. Fetch scripts → `data/raw` (reuse Phase 0 code). Normalize + alias review files.
3. Load SQLite; decisions seeded only from SCOTUS/FR script output.
4. Timeline + filings table + Citizen/Investigator toggle.
5. Rule engine + flags + symmetry test.
6. Network graph.
7. Revolving-door table.
8. Claims panel (after transcript source is approved).
9. Copy lint (banned words), accessibility pass, README for Windows setup.

Small commits per step.
