import assert from "node:assert/strict";
import {
  buildClaimMap,
  createPortableRecord,
  detectDenialReasons,
  extractDollarAmounts,
  extractPolicyReferences,
  normalizeImportedRecord,
  safeText,
} from "../d/denialfix-7f3c91e2/app-core.mjs";

const denial = `We are unable to provide coverage for the claimed bathroom damage. Our inspection indicates repeated seepage over a period of 14 days or more. See Section I — Exclusions, paragraph 3 and endorsement HO 04 95. The covered estimate is $4,820.00 after your $2,500 deductible.`;
const policy = `SECTION I — EXCLUSIONS\n3. Water damage caused by constant or repeated seepage or leakage over a period of 14 days or more is excluded.\nHO 04 95 modifies this policy.\nSECTION I — CONDITIONS\nYour Duties After Loss include protecting property and providing records.`;
const estimate = `Demo contractor estimate\nDrywall removal $1,250.00\nFlooring $6,400.00\nCabinet reset $1,100.00\nTotal $8,750.00`;

assert.deepEqual(detectDenialReasons(denial).map((row) => row.id), ["gradual-water", "deductible-or-limit"]);
assert.deepEqual(extractPolicyReferences(denial), ["Section I — Exclusions", "paragraph 3", "HO 04 95"]);
assert.deepEqual(extractDollarAmounts(estimate).map((entry) => entry.value), [1250, 6400, 1100, 8750]);

const map = buildClaimMap({ denialText: denial, policyText: policy, estimateText: estimate, confirmedDeadline: "" });
assert.equal(map.reasons.length, 2);
assert.ok(map.policyMatches.some((match) => /14 days/i.test(match.snippet)));
assert.equal(map.estimate.highestAmount, 8750);
assert.ok(map.warnings.some((warning) => /deadline/i.test(warning)));
assert.equal("coverageVerdict" in map, false, "map must not expose a coverage-verdict field");
assert.equal("successProbability" in map, false, "map must not score appeal outcomes");

const source = {
  schemaVersion: 1,
  product: "denialfix",
  case: {
    insurer: "Example Mutual",
    state: "TX",
    denialText: denial,
    policyText: policy,
    estimateText: estimate,
    evidence: [{ id: "ev-1", description: "Plumber report", status: "have" }],
    correspondence: [{ id: "co-1", date: "2026-07-26", channel: "Email", summary: "Requested written explanation" }],
  },
};
const portable = createPortableRecord(source.case);
const restored = normalizeImportedRecord(JSON.parse(JSON.stringify(portable)));
assert.equal(restored.insurer, "Example Mutual");
assert.equal(restored.evidence.length, 1);
assert.equal(restored.correspondence.length, 1);
assert.equal(restored.denialText, denial);

assert.equal(safeText(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
assert.throws(() => normalizeImportedRecord({ schemaVersion: 99 }), /unsupported/i);

console.log(JSON.stringify({ ok: true, reasons: map.reasons.map((row) => row.id), policyMatches: map.policyMatches.length }));
