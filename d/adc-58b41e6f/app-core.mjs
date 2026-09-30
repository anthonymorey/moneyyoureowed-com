const PRODUCT = "airbnb-damage-claim-builder";
const SOURCE_CHECKED = "2026-07-26";
const MAX_ROWS = 300;

const DEFAULT_CASE = Object.freeze({
  schemaVersion: 1,
  listing: "",
  reservationCode: "",
  guestName: "",
  checkoutDate: "",
  incidentDiscovered: "",
  incidentType: "",
  factualSummary: "",
  causeOrigin: "",
  guestContacted: false,
  platformNotified: false,
  termsVerified: false,
  termsVerifiedDate: "",
  lineItems: [],
  evidence: [],
  timeline: [],
  correspondence: [],
});

export function safeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function text(value, limit = 2000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, limit);
}

function isoDate(value) {
  const cleaned = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : "";
}

function isoDateTime(value) {
  const cleaned = text(value, 19);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(cleaned) ? cleaned : "";
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12)}`;
}

function number(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function addDays(value, days) {
  const valid = isoDate(value);
  if (!valid) return "";
  const [year, month, day] = valid.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateActionWindows(checkoutDate) {
  const valid = isoDate(checkoutDate);
  return {
    checkoutDate: valid,
    guestActionBy: valid ? addDays(valid, 14) : "",
    formalRequestBy: valid ? addDays(valid, 30) : "",
    sourceChecked: SOURCE_CHECKED,
  };
}

function normalizeLineItem(item = {}) {
  return {
    id: text(item.id, 80) || makeId("item"),
    description: text(item.description, 240),
    makeModel: text(item.makeModel, 180),
    purchaseDate: isoDate(item.purchaseDate),
    conditionBefore: text(item.conditionBefore, 500),
    conditionAfter: text(item.conditionAfter, 500),
    remedy: ["repair", "replace", "cleaning", "income-loss", "other"].includes(item.remedy) ? item.remedy : "other",
    amount: number(item.amount),
    ownershipProof: text(item.ownershipProof, 240),
    estimateProof: text(item.estimateProof, 240),
    evidenceRefs: text(item.evidenceRefs, 240),
  };
}

function normalizeEvidence(item = {}) {
  return {
    id: text(item.id, 80) || makeId("EV"),
    type: ["photo", "video", "receipt", "estimate", "message", "condition-record", "police-report", "other"].includes(item.type) ? item.type : "other",
    label: text(item.label, 240),
    capturedAt: isoDateTime(item.capturedAt),
    source: text(item.source, 240),
    proves: text(item.proves, 500),
    originalStatus: ["original-retained", "copy-only", "unknown", "altered"].includes(item.originalStatus) ? item.originalStatus : "unknown",
  };
}

function normalizeTimeline(item = {}) {
  return {
    id: text(item.id, 80) || makeId("TL"),
    at: isoDateTime(item.at),
    fact: text(item.fact, 800),
    source: text(item.source, 240),
  };
}

function normalizeCorrespondence(item = {}) {
  return {
    id: text(item.id, 80) || makeId("CO"),
    at: isoDateTime(item.at),
    party: text(item.party, 160),
    channel: text(item.channel, 120),
    fact: text(item.fact, 800),
  };
}

export function normalizeCase(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_CASE,
    schemaVersion: 1,
    listing: text(source.listing, 240),
    reservationCode: text(source.reservationCode, 80),
    guestName: text(source.guestName, 160),
    checkoutDate: isoDate(source.checkoutDate),
    incidentDiscovered: isoDateTime(source.incidentDiscovered),
    incidentType: text(source.incidentType, 80),
    factualSummary: text(source.factualSummary, 4000),
    causeOrigin: text(source.causeOrigin, 2000),
    guestContacted: source.guestContacted === true,
    platformNotified: source.platformNotified === true,
    termsVerified: source.termsVerified === true,
    termsVerifiedDate: isoDate(source.termsVerifiedDate),
    lineItems: Array.isArray(source.lineItems) ? source.lineItems.slice(0, MAX_ROWS).map(normalizeLineItem) : [],
    evidence: Array.isArray(source.evidence) ? source.evidence.slice(0, MAX_ROWS).map(normalizeEvidence) : [],
    timeline: Array.isArray(source.timeline) ? source.timeline.slice(0, MAX_ROWS).map(normalizeTimeline) : [],
    correspondence: Array.isArray(source.correspondence) ? source.correspondence.slice(0, MAX_ROWS).map(normalizeCorrespondence) : [],
  };
}

export function lineItemTotal(items) {
  return Math.round((Array.isArray(items) ? items : []).reduce((sum, item) => sum + number(item?.amount), 0) * 100) / 100;
}

export function computeReadiness(value) {
  const claim = normalizeCase(value);
  const missing = [];
  if (!claim.checkoutDate || !claim.incidentDiscovered || !claim.factualSummary || !claim.causeOrigin) missing.push("incident facts");
  if (!claim.lineItems.length || claim.lineItems.some((item) => !item.description || !item.amount)) missing.push("itemized loss inventory");
  if (!claim.evidence.length || claim.evidence.some((item) => !item.label || !item.proves)) missing.push("evidence register");
  if (!claim.timeline.length) missing.push("dated timeline");
  if (!claim.guestContacted) missing.push("guest-recovery step confirmation");
  if (!claim.platformNotified) missing.push("platform complaint notification confirmation");
  if (!claim.termsVerified || !claim.termsVerifiedDate) missing.push("current-terms verification");
  const warnings = [
    "Airbnb decides whether a request is eligible, complete, verifiable, and payable.",
    "The 14-day and 30-day dates reflect terms checked on July 26, 2026; verify the live official terms before relying on them.",
    "This organizer does not create evidence, write a reimbursement narrative, value depreciation, or predict success.",
  ];
  if (claim.evidence.some((item) => item.originalStatus === "altered")) warnings.push("One or more evidence rows are marked altered. Do not submit altered material as original evidence.");
  return {
    status: missing.length ? "INCOMPLETE" : "REVIEW_READY_NOT_ELIGIBILITY_DECISION",
    missing: [...new Set(missing)],
    warnings,
    total: lineItemTotal(claim.lineItems),
    windows: calculateActionWindows(claim.checkoutDate),
  };
}

export function readinessLabel(status) {
  if (status === "REVIEW_READY_NOT_ELIGIBILITY_DECISION") return "Review ready — not an eligibility decision";
  if (status === "INCOMPLETE") return "Incomplete organizer record";
  return "Status unavailable";
}

export function createPortableRecord(caseData) {
  return {
    schemaVersion: 1,
    product: PRODUCT,
    exportedAt: new Date().toISOString(),
    sourceChecked: SOURCE_CHECKED,
    privacy: "Browser-local record. Review and redact before sharing.",
    case: normalizeCase(caseData),
  };
}

export function normalizeImportedRecord(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1 || (value.product && value.product !== PRODUCT)) {
    throw new Error("Unsupported Airbnb Damage Claim Builder record");
  }
  return normalizeCase(value.case || value);
}

function rows(values, render, columns, empty) {
  return values.length ? values.map(render).join("") : `<tr><td colspan="${columns}">${safeText(empty)}</td></tr>`;
}

export function buildEvidencePacketHtml(caseData) {
  const claim = normalizeCase(caseData);
  const readiness = computeReadiness(claim);
  const windows = readiness.windows;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const itemRows = rows(claim.lineItems, (item) => `<tr><td>${safeText(item.description)}</td><td>${safeText(item.makeModel || "—")}</td><td>${safeText(item.conditionBefore || "—")}</td><td>${safeText(item.conditionAfter || "—")}</td><td>${safeText(item.remedy)}</td><td>${safeText(money.format(item.amount))}</td><td>${safeText(item.ownershipProof || "—")}</td><td>${safeText(item.estimateProof || "—")}</td><td>${safeText(item.evidenceRefs || "—")}</td></tr>`, 9, "No loss items recorded.");
  const evidenceRows = rows(claim.evidence, (item) => `<tr><td>${safeText(item.id)}</td><td>${safeText(item.type)}</td><td>${safeText(item.label)}</td><td>${safeText(item.capturedAt || "—")}</td><td>${safeText(item.source || "—")}</td><td>${safeText(item.proves || "—")}</td><td>${safeText(item.originalStatus)}</td></tr>`, 7, "No evidence rows recorded.");
  const timelineRows = rows(claim.timeline, (item) => `<tr><td>${safeText(item.at || "—")}</td><td>${safeText(item.fact || "—")}</td><td>${safeText(item.source || "—")}</td></tr>`, 3, "No timeline rows recorded.");
  const correspondenceRows = rows(claim.correspondence, (item) => `<tr><td>${safeText(item.at || "—")}</td><td>${safeText(item.party || "—")}</td><td>${safeText(item.channel || "—")}</td><td>${safeText(item.fact || "—")}</td></tr>`, 4, "No correspondence rows recorded.");
  const missing = readiness.missing.length ? `<ul>${readiness.missing.map((item) => `<li>${safeText(item)}</li>`).join("")}</ul>` : "<p>No organizer category is empty. This is not an eligibility or payment decision.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Airbnb damage claim evidence inventory packet</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#14231f;max-width:1100px;margin:32px auto;padding:0 20px}h1,h2{font-family:Georgia,serif}h1{font-size:2.4rem;line-height:1.05}h2{margin-top:2rem;border-bottom:2px solid #173f3a;padding-bottom:.35rem}table{width:100%;border-collapse:collapse;font-size:.8rem}th,td{border:1px solid #adb9b5;padding:7px;text-align:left;vertical-align:top}.notice{padding:14px;background:#f3efdc;border:1px solid #c7b96b}.status{font-weight:800}.small{color:#4c5d57;font-size:.82rem}@media print{body{margin:0;max-width:none}a{color:inherit}h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body><h1>Evidence inventory packet</h1><p class="notice"><strong>Independent self-help organizer.</strong> Not affiliated with Airbnb. This packet organizes user-entered facts and evidence labels. It does not create evidence, draft a reimbursement narrative, determine eligibility, provide legal advice, or promise payment.</p><p class="status">Readiness: ${safeText(readinessLabel(readiness.status))}</p><h2>Case record</h2><dl><dt>Listing</dt><dd>${safeText(claim.listing || "Not entered")}</dd><dt>Reservation code</dt><dd>${safeText(claim.reservationCode || "Not entered")}</dd><dt>Guest</dt><dd>${safeText(claim.guestName || "Not entered")}</dd><dt>Checkout</dt><dd>${safeText(claim.checkoutDate || "Not entered")}</dd><dt>Incident discovered</dt><dd>${safeText(claim.incidentDiscovered || "Not entered")}</dd><dt>Incident type</dt><dd>${safeText(claim.incidentType || "Not entered")}</dd></dl><h2>Current-terms timing reference</h2><p>Official terms checked ${SOURCE_CHECKED}. Section 3.1.2 uses 14 days from checkout for guest-recovery and complaint steps. Section 3.3 uses 30 days from checkout for the formal request and legitimate/verifiable evidence.</p><ul><li>Guest-recovery/complaint date: ${safeText(windows.guestActionBy || "Not calculated")}</li><li>Formal request date: ${safeText(windows.formalRequestBy || "Not calculated")}</li></ul><p class="small">Verify the live official terms and account flow before relying on either date. The app does not decide whether an exception, different term, or other route applies.</p><h2>Incident facts</h2><h3>Observed facts</h3><p>${safeText(claim.factualSummary || "Not entered")}</p><h3>Time, cause and origin record</h3><p>${safeText(claim.causeOrigin || "Not entered")}</p><h2>Section 3.3.2 loss inventory</h2><table><thead><tr><th>Item</th><th>Make/model</th><th>Before</th><th>After</th><th>Basis</th><th>Amount</th><th>Ownership</th><th>Estimate</th><th>Evidence</th></tr></thead><tbody>${itemRows}</tbody></table><p><strong>Total entered:</strong> ${safeText(money.format(readiness.total))}</p><h2>Evidence register</h2><table><thead><tr><th>ID</th><th>Type</th><th>Label</th><th>Captured</th><th>Source</th><th>What it supports</th><th>Original status</th></tr></thead><tbody>${evidenceRows}</tbody></table><h2>Timeline</h2><table><thead><tr><th>Date/time</th><th>Fact</th><th>Source</th></tr></thead><tbody>${timelineRows}</tbody></table><h2>Correspondence</h2><table><thead><tr><th>Date/time</th><th>Party</th><th>Channel</th><th>Fact</th></tr></thead><tbody>${correspondenceRows}</tbody></table><h2>Completeness review</h2>${missing}<h2>Primary sources</h2><ul><li><a href="https://www.airbnb.com/help/article/2869">Airbnb Host Damage Protection Terms</a> — sections 3.1–3.4; last updated February 5, 2026; retrieved July 26, 2026.</li><li><a href="https://www.airbnb.com/help/article/279">Airbnb Host damage protection overview</a> — covered and excluded examples; retrieved July 26, 2026.</li></ul><p class="small">Preserve originals. Do not doctor or falsify documents or information, including through artificial intelligence. Review every field against the source material before sharing.</p></body></html>`;
}

export const SAMPLE_CASE = Object.freeze({
  listing: "Sample Lake House (fictional)",
  reservationCode: "HMSAMPLE42",
  guestName: "Jordan",
  checkoutDate: "2026-07-01",
  incidentDiscovered: "2026-07-01T11:30",
  incidentType: "guest-damage",
  factualSummary: "Sample only: a dining chair leg was observed split during the post-checkout inspection.",
  causeOrigin: "Sample only: observed immediately after the stay; cause has not been independently confirmed.",
  guestContacted: true,
  platformNotified: true,
  termsVerified: true,
  termsVerifiedDate: SOURCE_CHECKED,
  lineItems: [{ id: "item-sample", description: "Oak dining chair", makeModel: "Sample Chair 2", purchaseDate: "2025-01-15", conditionBefore: "Intact in dated turnover photo", conditionAfter: "Front leg split", remedy: "repair", amount: 185.5, ownershipProof: "Original receipt", estimateProof: "Carpenter quote", evidenceRefs: "EV-01, EV-02" }],
  evidence: [{ id: "EV-01", type: "photo", label: "Post-checkout chair photo", capturedAt: "2026-07-01T11:35", source: "Host phone", proves: "Observed condition after checkout", originalStatus: "original-retained" }],
  timeline: [{ id: "TL-01", at: "2026-07-01T10:00", fact: "Guest checkout time shown in reservation", source: "Airbnb reservation" }],
  correspondence: [{ id: "CO-01", at: "2026-07-01T12:00", party: "Guest", channel: "Airbnb message", fact: "Asked guest to review the chair damage" }],
});
