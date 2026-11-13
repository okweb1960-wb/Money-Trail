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
