import {
  SAMPLE_CASE,
  buildEvidencePacketHtml,
  calculateActionWindows,
  computeReadiness,
  createPortableRecord,
  lineItemTotal,
  normalizeCase,
  normalizeImportedRecord,
  readinessLabel,
  safeText,
} from "./app-core.mjs";

const STORAGE_KEY = "myo_airbnb_damage_claim_v1";
let state = normalizeCase({});
let clearArmed = false;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function fieldValue(form, name) {
  return new FormData(form).get(name) || "";
}

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setStatus(message, stateName = "") {
  const node = document.getElementById("save-status");
  node.textContent = message;
  node.dataset.state = stateName;
}

function hydrateCaseForm() {
  const form = document.getElementById("case-form");
  for (const control of form.querySelectorAll("[data-case]")) {
    control[control.type === "checkbox" ? "checked" : "value"] = control.type === "checkbox" ? Boolean(state[control.name]) : state[control.name] || "";
  }
}

function syncCaseForm() {
  const form = document.getElementById("case-form");
  const next = { ...state };
  for (const control of form.querySelectorAll("[data-case]")) next[control.name] = control.type === "checkbox" ? control.checked : control.value;
  state = normalizeCase(next);
  render();
}

document.getElementById("case-form").addEventListener("input", syncCaseForm);
document.getElementById("case-form").addEventListener("change", syncCaseForm);
document.getElementById("case-form").addEventListener("submit", (event) => event.preventDefault());

function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}">${safeText(message)}</td></tr>`;
}

function renderLosses() {
  document.getElementById("loss-rows").innerHTML = state.lineItems.length ? state.lineItems.map((item) => `<tr><td><strong>${safeText(item.description)}</strong><br>${safeText(item.makeModel || "")}</td><td>${safeText(item.conditionBefore || "—")} → ${safeText(item.conditionAfter || "—")}</td><td>${safeText(item.remedy)}</td><td>${safeText(money.format(item.amount))}</td><td>${safeText(item.ownershipProof || "—")}<br>${safeText(item.estimateProof || "—")}<br>${safeText(item.evidenceRefs || "—")}</td><td class="no-print"><button type="button" data-delete="lineItems" data-id="${safeText(item.id)}">Remove</button></td></tr>`).join("") : emptyRow(6, "No loss items recorded.");
  document.getElementById("loss-total").textContent = money.format(lineItemTotal(state.lineItems));
}

function renderEvidence() {
  document.getElementById("evidence-rows").innerHTML = state.evidence.length ? state.evidence.map((item) => `<tr><td>${safeText(item.id)}</td><td><strong>${safeText(item.label)}</strong><br>${safeText(item.type)}</td><td>${safeText(item.capturedAt || "—")}<br>${safeText(item.source || "—")}</td><td>${safeText(item.proves || "—")}</td><td>${safeText(item.originalStatus)}</td><td class="no-print"><button type="button" data-delete="evidence" data-id="${safeText(item.id)}">Remove</button></td></tr>`).join("") : emptyRow(6, "No evidence rows recorded.");
}

function renderTimeline() {
  document.getElementById("timeline-rows").innerHTML = state.timeline.length ? state.timeline.map((item) => `<tr><td>${safeText(item.at || "—")}</td><td>${safeText(item.fact || "—")}</td><td>${safeText(item.source || "—")}</td><td class="no-print"><button type="button" data-delete="timeline" data-id="${safeText(item.id)}">Remove</button></td></tr>`).join("") : emptyRow(4, "No timeline rows recorded.");
}

function renderCorrespondence() {
  document.getElementById("correspondence-rows").innerHTML = state.correspondence.length ? state.correspondence.map((item) => `<tr><td>${safeText(item.at || "—")}</td><td>${safeText(item.party || "—")}</td><td>${safeText(item.channel || "—")}</td><td>${safeText(item.fact || "—")}</td><td class="no-print"><button type="button" data-delete="correspondence" data-id="${safeText(item.id)}">Remove</button></td></tr>`).join("") : emptyRow(5, "No correspondence rows recorded.");
}

function renderReview() {
  const readiness = computeReadiness(state);
  const node = document.getElementById("readiness");
  const ready = readiness.status.startsWith("REVIEW_READY");
  node.dataset.state = ready ? "ready" : "incomplete";
  document.getElementById("readiness-status").textContent = readinessLabel(readiness.status);
  document.getElementById("readiness-detail").innerHTML = readiness.missing.length ? `<p>Empty organizer categories:</p><ul>${readiness.missing.map((item) => `<li>${safeText(item)}</li>`).join("")}</ul>` : "<p>No organizer category is empty. This is not an eligibility, verification or payment decision.</p>";
  const windows = readiness.windows;
  document.getElementById("guest-date").textContent = windows.guestActionBy || "—";
  document.getElementById("formal-date").textContent = windows.formalRequestBy || "—";
  document.getElementById("review-facts").textContent = state.factualSummary || "Not entered.";
  document.getElementById("review-dates").textContent = windows.checkoutDate ? `Checkout ${windows.checkoutDate}; 14-day reference ${windows.guestActionBy}; 30-day reference ${windows.formalRequestBy}. Verify live terms before relying.` : "No checkout date entered.";
  document.getElementById("review-losses").textContent = state.lineItems.length ? `${state.lineItems.length} line item(s), ${money.format(readiness.total)} entered total. Arithmetic only.` : "No line items.";
  document.getElementById("review-evidence").textContent = `${state.evidence.length} evidence row(s), ${state.timeline.length} timeline fact(s), ${state.correspondence.length} correspondence row(s).`;
}

function bindDeleteButtons() {
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    const collection = button.dataset.delete;
    state = normalizeCase({ ...state, [collection]: state[collection].filter((item) => item.id !== button.dataset.id) });
    render();
  }));
}

function render() {
  renderLosses();
  renderEvidence();
  renderTimeline();
  renderCorrespondence();
  renderReview();
  bindDeleteButtons();
}

function addForm(id, collection, build) {
  const form = document.getElementById(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state = normalizeCase({ ...state, [collection]: [...state[collection], build(form)] });
    form.reset();
    render();
    setStatus("Record changed. Save locally or export a backup.");
  });
}

addForm("line-item-form", "lineItems", (form) => ({ id: `item-${Date.now()}`, description: fieldValue(form, "description"), makeModel: fieldValue(form, "makeModel"), purchaseDate: fieldValue(form, "purchaseDate"), conditionBefore: fieldValue(form, "conditionBefore"), conditionAfter: fieldValue(form, "conditionAfter"), remedy: fieldValue(form, "remedy"), amount: fieldValue(form, "amount"), ownershipProof: fieldValue(form, "ownershipProof"), estimateProof: fieldValue(form, "estimateProof"), evidenceRefs: fieldValue(form, "evidenceRefs") }));
addForm("evidence-form", "evidence", (form) => ({ id: fieldValue(form, "id"), type: fieldValue(form, "type"), label: fieldValue(form, "label"), capturedAt: fieldValue(form, "capturedAt"), source: fieldValue(form, "source"), proves: fieldValue(form, "proves"), originalStatus: fieldValue(form, "originalStatus") }));
addForm("timeline-form", "timeline", (form) => ({ id: `TL-${Date.now()}`, at: fieldValue(form, "at"), fact: fieldValue(form, "fact"), source: fieldValue(form, "source") }));
addForm("correspondence-form", "correspondence", (form) => ({ id: `CO-${Date.now()}`, at: fieldValue(form, "at"), party: fieldValue(form, "party"), channel: fieldValue(form, "channel"), fact: fieldValue(form, "fact") }));

document.getElementById("load-sample").addEventListener("click", () => { state = normalizeCase(SAMPLE_CASE); hydrateCaseForm(); render(); setStatus("Fictional sample loaded. It has not been saved."); });
document.getElementById("save-record").addEventListener("click", () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(createPortableRecord(state))); setStatus("Saved on this device.", "success"); } catch (_) { setStatus("Browser storage blocked. Download a JSON backup instead.", "error"); } });
document.getElementById("export-json").addEventListener("click", () => download("airbnb-damage-claim-record.json", "application/json", JSON.stringify(createPortableRecord(state), null, 2)));
document.getElementById("download-html").addEventListener("click", () => download("airbnb-damage-evidence-packet.html", "text/html;charset=utf-8", buildEvidencePacketHtml(state)));
document.getElementById("print-record").addEventListener("click", () => window.print());
document.getElementById("restore-json").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; try { state = normalizeImportedRecord(JSON.parse(await file.text())); hydrateCaseForm(); render(); setStatus("Backup restored in this browser. Save locally if wanted.", "success"); } catch (_) { setStatus("That file is not a supported builder backup.", "error"); } finally { event.target.value = ""; } });
document.getElementById("clear-record").addEventListener("click", (event) => { if (!clearArmed) { clearArmed = true; event.currentTarget.textContent = "Click again to clear everything"; setTimeout(() => { clearArmed = false; event.currentTarget.textContent = "Clear all local data"; }, 5000); return; } try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} state = normalizeCase({}); hydrateCaseForm(); render(); clearArmed = false; event.currentTarget.textContent = "Clear all local data"; setStatus("Local record cleared.", "success"); });

try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { state = normalizeImportedRecord(JSON.parse(saved)); setStatus("Saved local record restored.", "success"); } } catch (_) { setStatus("Browser storage is unavailable. Use JSON backup for persistence.", "error"); }
hydrateCaseForm();
render();
