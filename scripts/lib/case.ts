import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CaseDecisionCfg {
  key: string;
  match?: string;
  nth?: number;
  source?: "federal_register";
  kind: string;
  tier: "decision" | "event";
  dateKind: string;
  decidedBy: string;
  title?: string;
  conclusionPattern?: string;
  ldaEntities?: string[];
  bodyKeywords?: string[];
}
export interface CaseOfficialCfg {
  id: string;
  name: string;
  role: string;
  docketMatch?: string;
  fec?: { name: string; office: "S" | "H" | "P" };
  links: Array<{ decision: string; type: "filed_in" | "issued" }>;
}
export interface CaseCfg {
  slug: string;
  title: string;
  window_from_year: number;
  company: { id: string; name: string };
  lda_client_search_terms: string[];
  fec_committee_ids: string[];
  scotus: { docket: string; expect_petitioner: string; expect_respondent: string };
  federal_register: { search_term: string; type: string; subtype: string };
  decisions: CaseDecisionCfg[];
  officials: CaseOfficialCfg[];
}

export function loadCase(slug = "glyphosate"): CaseCfg {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "case", `${slug}.json`), "utf8"));
}

export const CURRENT_YEAR = new Date().getFullYear();
