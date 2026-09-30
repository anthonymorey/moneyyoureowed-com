const MAX_TEXT = 350_000;

const REASON_RULES = [
  {
    id: "gradual-water",
    label: "Repeated or gradual water",
    cues: ["seepage", "leakage", "gradual", "continuous", "repeated", "14 days", "wear and tear", "deterioration"],
    question: "Which exact wording makes the insurer treat the event as gradual rather than sudden?",
    evidence: ["Dated photos or video", "Plumber, roofer, engineer, or mitigation report", "Timeline of first visible signs", "Repair and maintenance records"],
  },
  {
    id: "flood-or-surface-water",
    label: "Flood or surface water exclusion",
    cues: ["flood", "surface water", "rising water", "storm surge", "groundwater"],
    question: "What source and path of water does the denial describe, and which policy definition does it cite?",
    evidence: ["Weather and water-entry timeline", "Photos showing the water path", "Flood-policy records, if any", "Written explanation of the cited exclusion"],
  },
  {
    id: "wear-maintenance",
    label: "Wear, maintenance, or deterioration",
    cues: ["maintenance", "deterioration", "rot", "corrosion", "faulty workmanship", "poor workmanship", "pre-existing", "preexisting"],
    question: "Does the denial separate the excluded condition from any resulting damage, and where does the policy address both?",
    evidence: ["Inspection reports", "Maintenance and repair receipts", "Pre-loss photos", "Contractor cause-and-scope statement"],
  },
  {
    id: "business-use",
    label: "Business-use exclusion",
    cues: ["business pursuit", "business use", "working for profit", "commercial activity", "for compensation"],
    question: "What activity does the insurer call a business, and how is that term defined in the policy?",
    evidence: ["Exact denial wording", "Policy business-use definition", "Invoices or payment records", "Written description of frequency and purpose"],
  },
  {
    id: "late-notice",
    label: "Late notice or missed condition",
    cues: ["late notice", "timely notice", "failure to notify", "duties after loss", "proof of loss", "cooperate", "condition precedent"],
    question: "Which duty or deadline does the denial cite, and what dated record shows when notice or documents were provided?",
    evidence: ["Claim-submission confirmation", "Proof-of-loss submission", "Email/call chronology", "Policy conditions section"],
  },
  {
    id: "missing-documents",
    label: "Missing or insufficient documents",
    cues: ["insufficient documentation", "missing documentation", "documents not received", "failure to provide", "additional information", "unable to verify"],
    question: "What exact document does the insurer say is missing, and where did it request that item?",
    evidence: ["Insurer document request", "Submission receipt", "Requested report or estimate", "Follow-up asking what remains outstanding"],
  },
  {
    id: "causation",
    label: "Cause of loss disagreement",
    cues: ["cause of loss", "causation", "not caused by", "unrelated damage", "prior damage", "pre-existing damage", "preexisting damage"],
    question: "Which cause does the denial adopt, which cause does your expert support, and what facts connect each opinion to the damage?",
    evidence: ["Cause-and-origin report", "Pre-loss inspection", "Weather/event record", "Expert photos and explanation"],
  },
  {
    id: "scope-or-price",
    label: "Repair scope or estimate gap",
    cues: ["scope of repair", "scope difference", "actual cash value", "replacement cost", "depreciation", "matching", "labor rate", "underpaid", "supplement"],
    question: "Which contractor line items, quantities, labor assumptions, or code requirements differ from the insurer estimate?",
    evidence: ["Insurer estimate", "Contractor estimate", "Line-item comparison", "Photos tied to each disputed item"],
  },
  {
    id: "deductible-or-limit",
    label: "Deductible or policy limit",
    cues: ["deductible", "policy limit", "limit of liability", "sublimit", "below your deductible"],
    question: "Which deductible, limit, or sublimit was applied, and where is it shown in the declarations or endorsement?",
    evidence: ["Declarations page", "Applicable endorsement", "Insurer calculation", "Estimate total and deductible math"],
  },
  {
    id: "exclusion-other",
    label: "Other cited exclusion",
    cues: ["excluded", "exclusion", "not covered", "coverage does not apply", "we are unable to provide coverage"],
    question: "Which exclusion, definition, condition, or endorsement does the denial cite word for word?",
    evidence: ["Complete denial letter", "Full cited policy section", "Definitions and endorsements", "Written request for the controlling language"],
  },
];

const DEFAULT_CASE = Object.freeze({
  schemaVersion: 1,
  insurer: "",
  state: "",
  claimReference: "",
  lossDate: "",
  denialReceived: "",
  confirmedDeadline: "",
  denialText: "",
  policyText: "",
  estimateText: "",
  evidence: [],
  correspondence: [],
});

export function cleanText(value, limit = MAX_TEXT) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, limit);
}

export function safeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()))];
}

export function detectDenialReasons(text) {
  const source = cleanText(text).toLowerCase();
  if (!source) return [];
  const hits = REASON_RULES.filter((rule) => rule.cues.some((cue) => source.includes(cue)));
  const specific = hits.filter((rule) => rule.id !== "exclusion-other");
  return (specific.length ? specific : hits).map((rule) => ({
    id: rule.id,
    label: rule.label,
    question: rule.question,
    evidence: [...rule.evidence],
    matchedCues: rule.cues.filter((cue) => source.includes(cue)),
  }));
}

export function extractPolicyReferences(text) {
  const source = cleanText(text);
  const patterns = [
    /\bSection\s+[A-Z0-9]+(?:\s*[—-]\s*[A-Za-z][A-Za-z ]+)?/gi,
    /\bparagraph\s+\d+(?:\([a-z0-9]+\))?/gi,
    /\b(?:HO|DP|CP)\s*\d{2}\s*\d{2}\b/g,
    /\bCoverage\s+[A-Z]\b(?:\s*[—-]\s*[A-Za-z][A-Za-z ]+)?/g,
    /\bExclusion\s+[A-Z0-9]+(?:\([a-z0-9]+\))?/g,
  ];
  return dedupe(patterns.flatMap((pattern) => source.match(pattern) || [])).slice(0, 40);
}

export function extractDates(text) {
  const source = cleanText(text);
  const named = source.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{4}\b/gi) || [];
  const numeric = source.match(/\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g) || [];
  return dedupe([...named, ...numeric]).slice(0, 30);
}

export function extractDollarAmounts(text) {
  const source = cleanText(text);
  const result = [];
  const pattern = /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{2})?|[0-9]+(?:\.\d{2})?)/g;
  let match;
  while ((match = pattern.exec(source)) && result.length < 80) {
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const start = Math.max(0, match.index - 48);
    const end = Math.min(source.length, pattern.lastIndex + 48);
    result.push({ raw: match[0].replace(/\s+/g, ""), value, context: source.slice(start, end).replace(/\s+/g, " ").trim() });
  }
  return result;
}

function splitPassages(text) {
  return cleanText(text)
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24)
    .slice(0, 800);
}

function policyMatches(denialText, policyText, reasons, references) {
  if (!cleanText(policyText)) return [];
  const passages = splitPassages(policyText);
  const terms = dedupe([
    ...references.flatMap((ref) => ref.toLowerCase().split(/[^a-z0-9]+/)).filter((term) => term.length >= 3),
    ...reasons.flatMap((reason) => reason.matchedCues),
  ]);
  return passages
    .map((passage) => {
      const lower = passage.toLowerCase();
      const matched = terms.filter((term) => lower.includes(term));
      return { snippet: passage.slice(0, 520), matched };
    })
    .filter((entry) => entry.matched.length)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, 12);
}

export function buildClaimMap(input) {
  const claim = normalizeCase(input);
  const reasons = detectDenialReasons(claim.denialText);
  const references = extractPolicyReferences(claim.denialText);
  const dates = extractDates(claim.denialText);
  const amounts = extractDollarAmounts(claim.estimateText);
  const denialAmounts = extractDollarAmounts(claim.denialText);
  const matches = policyMatches(claim.denialText, claim.policyText, reasons, references);
  const warnings = [
    "Candidate wording only: verify every quote and reference against the original document.",
    "This map does not decide whether coverage exists or whether the insurer's decision is correct.",
  ];
  if (!claim.confirmedDeadline) warnings.push("No confirmed deadline is stored. Copy the date from the notice or policy and verify it with the insurer or official state source; DenialFix does not calculate deadlines.");
  if (!claim.policyText) warnings.push("No policy text is loaded, so cited sections cannot be compared yet.");
  if (!claim.estimateText) warnings.push("No estimate text is loaded, so repair-scope amounts cannot be indexed yet.");
  if (!reasons.length && claim.denialText) warnings.push("No common denial pattern was detected. Use the original wording and request a written explanation rather than guessing.");

  return {
    generatedAt: new Date().toISOString(),
    reasons,
    references,
    dates,
    policyMatches: matches,
    estimate: {
      amounts,
      highestAmount: amounts.length ? Math.max(...amounts.map((entry) => entry.value)) : 0,
      denialAmounts,
    },
    warnings,
  };
}

export function normalizeCase(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_CASE,
    schemaVersion: 1,
    insurer: cleanText(source.insurer, 120),
    state: cleanText(source.state, 2).toUpperCase(),
    claimReference: cleanText(source.claimReference, 40),
    lossDate: cleanText(source.lossDate, 20),
    denialReceived: cleanText(source.denialReceived, 20),
    confirmedDeadline: cleanText(source.confirmedDeadline, 20),
    denialText: cleanText(source.denialText),
    policyText: cleanText(source.policyText),
    estimateText: cleanText(source.estimateText),
    evidence: Array.isArray(source.evidence) ? source.evidence.slice(0, 250).map(normalizeEvidence) : [],
    correspondence: Array.isArray(source.correspondence) ? source.correspondence.slice(0, 250).map(normalizeCorrespondence) : [],
  };
}

function normalizeEvidence(item = {}) {
  return {
    id: cleanText(item.id, 80) || cryptoId("ev"),
    description: cleanText(item.description, 500),
    source: cleanText(item.source, 240),
    status: ["have", "request", "not-applicable"].includes(item.status) ? item.status : "request",
  };
}

function normalizeCorrespondence(item = {}) {
  return {
    id: cleanText(item.id, 80) || cryptoId("co"),
    date: cleanText(item.date, 20),
    channel: cleanText(item.channel, 80),
    contact: cleanText(item.contact, 160),
    summary: cleanText(item.summary, 1200),
  };
}

function cryptoId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid || Math.random().toString(36).slice(2, 12)}`;
}

export function createPortableRecord(caseData) {
  return {
    schemaVersion: 1,
    product: "denialfix",
    exportedAt: new Date().toISOString(),
    privacy: "Browser-local record. Review and redact before sharing.",
    case: normalizeCase(caseData),
  };
}

export function normalizeImportedRecord(value) {
  if (!value || typeof value !== "object") throw new Error("Unsupported DenialFix record");
  if (value.schemaVersion !== 1 || (value.product && value.product !== "denialfix")) throw new Error("Unsupported DenialFix record version");
  return normalizeCase(value.case || value);
}

export function buildPacketHtml(caseData, map = buildClaimMap(caseData)) {
  const claim = normalizeCase(caseData);
  const reasonRows = map.reasons.length
    ? map.reasons.map((reason) => `<section><h3>${safeText(reason.label)}</h3><p><strong>Question to resolve:</strong> ${safeText(reason.question)}</p><ul>${reason.evidence.map((item) => `<li>${safeText(item)}</li>`).join("")}</ul></section>`).join("")
    : "<p>No common reason pattern was detected. Preserve the denial wording and request a written explanation.</p>";
  const policyRows = map.policyMatches.length
    ? map.policyMatches.map((match) => `<blockquote>${safeText(match.snippet)}</blockquote>`).join("")
    : "<p>No candidate policy wording is available.</p>";
  const evidenceRows = claim.evidence.length
    ? claim.evidence.map((item) => `<tr><td>${safeText(item.description)}</td><td>${safeText(item.source)}</td><td>${safeText(item.status)}</td></tr>`).join("")
    : '<tr><td colspan="3">No evidence rows added.</td></tr>';
  const correspondenceRows = claim.correspondence.length
    ? claim.correspondence.map((item) => `<tr><td>${safeText(item.date)}</td><td>${safeText(item.channel)}</td><td>${safeText(item.contact)}</td><td>${safeText(item.summary)}</td></tr>`).join("")
    : '<tr><td colspan="4">No correspondence rows added.</td></tr>';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DenialFix claim preparation packet</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#17201e;max-width:860px;margin:40px auto;padding:0 24px}h1,h2,h3{font-family:Georgia,serif}h2{margin-top:38px;border-bottom:1px solid #999;padding-bottom:8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:8px;text-align:left;vertical-align:top}blockquote{margin:12px 0;padding:12px 16px;background:#f4f1e8;border-left:3px solid #486} .warning{padding:14px;background:#fff3cd}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body><h1>DenialFix claim preparation packet</h1><p class="warning"><strong>Verify before sharing.</strong> Candidate wording only. This organizer does not decide coverage, calculate deadlines, provide legal advice, or represent you.</p><h2>Claim details</h2><dl><dt>Insurer</dt><dd>${safeText(claim.insurer || "Not entered")}</dd><dt>State</dt><dd>${safeText(claim.state || "Not entered")}</dd><dt>Claim reference</dt><dd>${safeText(claim.claimReference || "Not entered")}</dd><dt>Date of loss</dt><dd>${safeText(claim.lossDate || "Not entered")}</dd><dt>Denial received</dt><dd>${safeText(claim.denialReceived || "Not entered")}</dd><dt>Deadline copied and confirmed by user</dt><dd>${safeText(claim.confirmedDeadline || "Not confirmed")}</dd></dl><h2>Reason and evidence map</h2>${reasonRows}<h2>Candidate policy wording</h2>${policyRows}<h2>Evidence tracker</h2><table><thead><tr><th>Item</th><th>Source</th><th>Status</th></tr></thead><tbody>${evidenceRows}</tbody></table><h2>Correspondence log</h2><table><thead><tr><th>Date</th><th>Channel</th><th>Contact</th><th>Summary</th></tr></thead><tbody>${correspondenceRows}</tbody></table><h2>Free and official next-step routes</h2><ul><li><a href="https://content.naic.org/article/how-file-complaint-and-research-complaints-against-insurance-carriers">Find your state insurance department through NAIC</a></li><li><a href="https://uphelp.org/claim-guidance-publications/resolving-claim-disputes/">United Policyholders dispute guidance</a></li></ul><p>Generated ${safeText(map.generatedAt)}. Keep originals unchanged and confirm policy/state-specific requirements.</p></body></html>`;
}

export const SAMPLE_CASE = Object.freeze({
  insurer: "Example Mutual (sample only)",
  state: "TX",
  claimReference: "SAMPLE-2048",
  lossDate: "2026-06-18",
  denialReceived: "2026-07-02",
  confirmedDeadline: "",
  denialText: "SAMPLE — NOT A REAL CLAIM. We are unable to provide coverage for the bathroom damage. Our inspection indicates repeated seepage or leakage over a period of 14 days or more. See Section I — Exclusions, paragraph 3 and endorsement HO 04 95. Our covered estimate is $4,820 after the $2,500 deductible.",
  policyText: "SAMPLE POLICY EXCERPT — VERIFY YOUR ORIGINAL. SECTION I — EXCLUSIONS. 3. Water damage caused by constant or repeated seepage or leakage over a period of 14 days or more is excluded. HO 04 95 modifies this policy. SECTION I — CONDITIONS. Your Duties After Loss include protecting property and providing records.",
  estimateText: "SAMPLE CONTRACTOR ESTIMATE. Drywall removal $1,250. Flooring $6,400. Cabinet reset $1,100. Total $8,750.",
  evidence: [
    { id: "ev-sample-1", description: "Dated photos of the first visible damage", source: "Homeowner", status: "have" },
    { id: "ev-sample-2", description: "Plumber cause-and-origin statement", source: "Licensed plumber", status: "request" },
  ],
  correspondence: [],
});
