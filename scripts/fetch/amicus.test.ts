import { test } from "node:test";
import assert from "node:assert/strict";
import { sideFromCover } from "./amicus";

const P = "Monsanto", R = "Durnell";
test("standard cover phrases", () => {
  assert.equal(sideFromCover("BRIEF OF AMICI CURIAE NEBRASKA ... IN SUPPORT OF PETITIONER", P, R).side, "petitioner");
  assert.equal(sideFromCover("AS AMICI CURIAE IN SUPPORT OF\n RESPONDENT", P, R).side, "respondent");
  assert.equal(sideFromCover("Brief ... in Support of Petitioner and Reversal", P, R).side, "petitioner");
  assert.equal(sideFromCover("BRIEF ... SUPPORTING RESPONDENT", P, R).side, "respondent");
  assert.equal(sideFromCover("IN SUPPORT OF RESPONDENTS", P, R).side, "respondent");
  assert.equal(sideFromCover("IN SUPPORT OF NEITHER PARTY", P, R).side, "neither");
});
test("party named instead of role", () => {
  const r = sideFromCover("COALITION FOR LEGAL REFORM IN SUPPORT OF\n      MONSANTO COMPANY AND REVERSAL", P, R);
  assert.equal(r.side, "petitioner");
  assert.equal(r.phrase, "IN SUPPORT OF MONSANTO COMPANY");
});
test("no side on cover", () => {
  assert.equal(sideFromCover("BRIEF FOR THE UNITED STATES AS AMICUS CURIAE", P, R).side, "not_stated");
});

import { extractDisclosure } from "./amicus";
test("disclosure: CropLife-style statement with party membership", () => {
  const d = extractDisclosure("intro text. 1 No counsel for either party authored this brief in whole or in part, nor did any party or other person or entity other than amicus curiae, its members, and its counsel make a monetary contribution intended to fund its preparation or submission. Monsanto Company’s parent company, Bayer Corp., is a member of CropLife America, but apart from the dues it pays as a member, did not contribute money intended to fund preparation or submission of this brief. 2 of those tests each costing", ["Monsanto", "Durnell", "Bayer"]);
  assert.equal(d.partyCounselAuthoredDenied, true);
  assert.equal(d.membersExcepted, true);
  assert.equal(d.mentionsParty.length, 1);
  assert.ok(!d.statement!.includes("of those tests"));
});
test("disclosure: no members exception", () => {
  const d = extractDisclosure("x. No counsel for a party authored this brief in whole or part. No person or entity other than amici or counsel made a monetary contribution to the preparation or submission of this brief. 2 SUMMARY OF ARGUMENT The Court", ["Monsanto", "Durnell"]);
  assert.equal(d.membersExcepted, false);
  assert.equal(d.partyCounselAuthoredDenied, true);
});
test("disclosure: none in government brief", () => {
  assert.equal(extractDisclosure("BRIEF FOR THE UNITED STATES. The question presented is whether.", ["Monsanto"]).statement, null);
});

test("disclosure: counsel overlap is detected on either side", () => {
  const a = extractDisclosure("bio text. 1 Pursuant to Rule 37.6, counsel for amici curiae are the sole authors of this brief. Counsel for amici disclose that they are counsel for Plaintiffs in other Roundup litigation. No person or entity, including amici curiae, made a monetary contribution to the preparation or submission of the brief. 2 Amicus Lianne", ["Monsanto", "Durnell"]);
  assert.equal(a.counselOverlap.length, 1);
  assert.ok(a.statement!.startsWith("Pursuant to Rule 37.6"));
  const b = extractDisclosure("interest. 1 Pursuant to Rule 37.6, counsel for amici curiae authored this brief in whole. Counsel for amici discloses that other Shook, Hardy & Bacon LLP attorneys are among counsel to Monsanto Company in glyphosate litigation and appeared in the trial court below. No person or entity, other than amici curiae, their members, or their counsel made a monetary contribution to the preparation or submission of the brief. 2 See", ["Monsanto", "Durnell"]);
  assert.equal(b.counselOverlap.length, 1);
  assert.equal(b.mentionsParty.length, 1);
});
test("disclosure: 'not written by counsel for a party' counts as a denial; lead text excluded", () => {
  const d = extractDisclosure("reserved to the states the power to 1 This brief was not written in whole or in part by counsel for a party. No one other than amicus curiae or its counsel made a monetary contribution to the preparation or submission of the brief. 2 environment", ["Monsanto"]);
  assert.equal(d.partyCounselAuthoredDenied, true);
  assert.ok(d.statement!.startsWith("This brief was not written"));
});
