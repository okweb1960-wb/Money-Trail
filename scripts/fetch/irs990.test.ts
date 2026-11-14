import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrgStrict } from "./irs990";

test("strict IRS name matching", () => {
  assert.ok(sameOrgStrict("Atlantic Legal Foundation", "Atlantic Legal Foundation"));
  assert.ok(!sameOrgStrict("Atlantic States Legal Foundation", "Atlantic Legal Foundation"));
  assert.ok(sameOrgStrict("Childrens Health Defense", "Children’s Health Defense"));
  assert.ok(sameOrgStrict("Public Citizen Inc", "Public Citizen"));
  assert.ok(sameOrgStrict("Chamber Of Commerce Of The United States Of America", "Chamber of Commerce of the United States of America, et al."));
  assert.ok(!sameOrgStrict("Chamber Of Commerce", "Chamber of Commerce of the United States of America, et al."));
});
