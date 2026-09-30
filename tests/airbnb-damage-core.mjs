import assert from "node:assert/strict";
import {
  buildEvidencePacketHtml,
  calculateActionWindows,
  computeReadiness,
  createPortableRecord,
  lineItemTotal,
  normalizeImportedRecord,
  readinessLabel,
  safeText,
} from "../d/adc-58b41e6f/app-core.mjs";

const windows = calculateActionWindows("2026-07-01");
assert.deepEqual(windows, {
  checkoutDate: "2026-07-01",
  guestActionBy: "2026-07-15",
  formalRequestBy: "2026-07-31",
  sourceChecked: "2026-07-26",
});
assert.deepEqual(calculateActionWindows(""), {
  checkoutDate: "",
  guestActionBy: "",
  formalRequestBy: "",
  sourceChecked: "2026-07-26",
});

const caseData = {
  listing: "Sample Lake House",
  reservationCode: "HMA123456",
  checkoutDate: "2026-07-01",
  incidentDiscovered: "2026-07-01T11:30",
  incidentType: "guest-damage",
  factualSummary: "A dining chair leg is split after checkout.",
  causeOrigin: "Observed immediately after the stay; cause not independently confirmed.",
  guestContacted: true,
  platformNotified: true,
  termsVerified: true,
  termsVerifiedDate: "2026-07-26",
  lineItems: [{
    id: "item-1",
    description: "Oak dining chair",
    makeModel: "Example Chair 2",
    purchaseDate: "2025-01-15",
    conditionBefore: "Intact in dated turnover photo",
    conditionAfter: "Front leg split",
    remedy: "repair",
    amount: 185.50,
    ownershipProof: "Original receipt",
    estimateProof: "Carpenter quote",
    evidenceRefs: "EV-01, EV-02",
  }],
  evidence: [{
    id: "EV-01",
    type: "photo",
    label: "Post-checkout chair photo",
    capturedAt: "2026-07-01T11:35",
    source: "Host phone",
    proves: "The observed split after checkout",
    originalStatus: "original-retained",
  }],
  timeline: [{ id: "TL-01", at: "2026-07-01T10:00", fact: "Guest checkout time shown in reservation", source: "Airbnb reservation" }],
  correspondence: [{ id: "CO-01", at: "2026-07-01T12:00", party: "Guest", channel: "Airbnb message", fact: "Asked guest to review chair damage" }],
};

assert.equal(lineItemTotal(caseData.lineItems), 185.5);
const readiness = computeReadiness(caseData);
assert.equal(readiness.status, "REVIEW_READY_NOT_ELIGIBILITY_DECISION");
assert.equal(readinessLabel(readiness.status), "Review ready — not an eligibility decision");
assert.equal(readinessLabel("INCOMPLETE"), "Incomplete organizer record");
assert.equal(readiness.missing.length, 0);
assert.ok(readiness.warnings.some((warning) => /Airbnb decides/i.test(warning)));
assert.equal("eligibility" in readiness, false);
assert.equal("successProbability" in readiness, false);

const missing = computeReadiness({ lineItems: [], evidence: [] });
assert.equal(missing.status, "INCOMPLETE");
assert.ok(missing.missing.includes("incident facts"));
assert.ok(missing.missing.includes("itemized loss inventory"));
assert.ok(missing.missing.includes("evidence register"));

const portable = createPortableRecord(caseData);
assert.equal(portable.product, "airbnb-damage-claim-builder");
assert.equal(portable.schemaVersion, 1);
assert.equal(portable.case.listing, "Sample Lake House");
const restored = normalizeImportedRecord(JSON.parse(JSON.stringify(portable)));
assert.equal(restored.lineItems.length, 1);
assert.equal(restored.evidence[0].originalStatus, "original-retained");
assert.throws(() => normalizeImportedRecord({ schemaVersion: 2, product: "airbnb-damage-claim-builder" }), /unsupported/i);
assert.throws(() => normalizeImportedRecord({ schemaVersion: 1, product: "other-product" }), /unsupported/i);

const html = buildEvidencePacketHtml(caseData);
assert.match(html, /Evidence inventory packet/i);
assert.match(html, /Section 3\.3\.2/i);
assert.match(html, /Oak dining chair/);
assert.match(html, /Readiness: Review ready — not an eligibility decision/);
assert.doesNotMatch(html, /REVIEW_READY_NOT_ELIGIBILITY_DECISION/);
assert.doesNotMatch(html, /Dear Airbnb|reimburse me|demand letter/i);
assert.equal(safeText(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");

console.log(JSON.stringify({ ok: true, status: readiness.status, total: lineItemTotal(caseData.lineItems) }));
