import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrg } from "./amicus-lda";

test("same organization across LDA name forms", () => {
  assert.ok(sameOrg("US CHAMBER OF COMMERCE", "Chamber of Commerce of the United States of America, et al."));
  assert.ok(sameOrg("CHAMBER OF COMMERCE OF THE U.S.A.", "Chamber of Commerce of the United States of America, et al."));
  assert.ok(sameOrg("AMERICAN FARM BUREAU FED", "American Farm Bureau Federation, et al."));
  assert.ok(sameOrg("VETERANS OF FOREIGN WARS OF THE UNITED STATES", "Veterans of Foreign Wars of the United States"));
});
test("different organizations are not merged", () => {
  assert.ok(!sameOrg("LOUISIANA CHAMBER OF COMMERCE FOUNDATION", "Chamber of Commerce of the United States of America, et al."));
  assert.ok(!sameOrg("SOBBA PUBLIC, LLC, ON BEHALF OF CITIZENS FOR REPONSIBLE ENERGY POLICY", "Public Citizen"));
  assert.ok(!sameOrg("ARKANSAS FARM BUREAU FEDERATION", "American Farm Bureau Federation, et al."));
});
