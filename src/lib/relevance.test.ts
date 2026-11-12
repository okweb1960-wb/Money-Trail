import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyActivity } from "./relevance";

test("glyphosate named directly", () => {
  assert.equal(classifyActivity("Glyphosate liability protection in legislation").relevance, "glyphosate_direct");
});
test("FIFRA / pesticide labeling uniformity is pesticide policy", () => {
  assert.equal(classifyActivity("Monitor ... related to the uniformity of pesticide labeling.").relevance, "pesticide_policy");
  assert.equal(classifyActivity("Federal Insecticide, Fungicide, Rodenticide (FIFRA) Regulations").relevance, "pesticide_policy");
});
test("medicine labeling uniformity is not case-relevant", () => {
  assert.equal(classifyActivity("regulation of over-the-counter medicines; national uniformity of labeling").relevance, "general");
});
