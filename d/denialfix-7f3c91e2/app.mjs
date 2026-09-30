import {
  SAMPLE_CASE,
  buildClaimMap,
  buildPacketHtml,
  createPortableRecord,
  normalizeCase,
  normalizeImportedRecord,
  safeText,
} from "./app-core.mjs";

const STORAGE_KEY = "denialfix.case.v1";
const fields = {
  insurer: document.getElementById("insurer"),
  state: document.getElementById("state"),
  claimReference: document.getElementById("claim-reference"),
  lossDate: document.getElementById("loss-date"),
  denialReceived: document.getElementById("denial-received"),
  confirmedDeadline: document.getElementById("confirmed-deadline"),
  denialText: document.getElementById("denial-text"),
  policyText: document.getElementById("policy-text"),
  estimateText: document.getElementById("estimate-text"),
};

const workspaceStatus = document.getElementById("workspace-status");
const exportStatus = document.getElementById("export-status");
let state = normalizeCase({});
let claimMap = buildClaimMap(state);
let lastRemoved = null;
let clearTimer = null;

function readFields() {
  return normalizeCase({
    ...state,
    insurer: fields.insurer.value,
    state: fields.state.value,
    claimReference: fields.claimReference.value,
    lossDate: fields.lossDate.value,
    denialReceived: fields.denialReceived.value,
    confirmedDeadline: fields.confirmedDeadline.value,
    denialText: fields.denialText.value,
    policyText: fields.policyText.value,
    estimateText: fields.estimateText.value,
  });
}

function writeFields(nextState) {
  state = normalizeCase(nextState);
  for (const [name, element] of Object.entries(fields)) element.value = state[name] || "";
  renderEvidence();
  renderCorrespondence();
}

function setStatus(element, message, kind = "") {
  element.dataset.state = kind;
  element.textContent = message;
}

function setButtonState(button, kind, text) {
  button.dataset.state = kind;
  button.disabled = kind === "loading";
  if (text) button.textContent = text;
}

function fileStatus(input, message, kind = "") {
  const id = input.id.replace("-file", "-file-status");
  setStatus(document.getElementById(id), message, kind);
}

async function readPdf(file) {
  const pdfjs = await import("./vendor/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.mjs", import.meta.url).href;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentTask = pdfjs.getDocument({ data: bytes });
  const pdf = await documentTask.promise;
  if (pdf.numPages > 200) throw new Error("This PDF has more than 200 pages. Export only the relevant sections and try again.");
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(`--- Page ${pageNumber} ---\n${content.items.map((item) => item.str || "").join(" ")}`);
    if (pages.join("\n\n").length > 350_000) break;
  }
  return pages.join("\n\n");
}

async function readDocument(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (file.type === "application/pdf" || extension === "pdf") return readPdf(file);
  if (["txt", "md", "csv", "json"].includes(extension) || file.type.startsWith("text/")) return file.text();
  throw new Error("Use a PDF, TXT, or Markdown file. Export DOCX files to PDF first.");
}

for (const input of document.querySelectorAll("[data-file-for]")) {
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      fileStatus(input, "That file is over 30 MB. Export only the relevant pages and try again.", "error");
      input.value = "";
      return;
    }
    fileStatus(input, `Reading ${file.name} on this device…`, "loading");
    try {
      const text = await readDocument(file);
      fields[input.dataset.fileFor].value = text.slice(0, 350_000);
      fileStatus(input, `${file.name} loaded locally · ${text.length.toLocaleString()} characters`, "success");
    } catch (error) {
      fileStatus(input, error.message || "This file could not be read.", "error");
    } finally {
      input.value = "";
    }
  });
}

for (const button of document.querySelectorAll("[data-clear-document]")) {
  button.addEventListener("click", () => {
    const name = button.dataset.clearDocument;
    fields[name].value = "";
    const input = document.querySelector(`[data-file-for="${name}"]`);
    fileStatus(input, "Document text cleared from the workspace.");
  });
}

function renderMap() {
  document.getElementById("reason-count").textContent = String(claimMap.reasons.length);
  document.getElementById("reference-count").textContent = String(claimMap.references.length);
  document.getElementById("amount-count").textContent = String(claimMap.estimate.amounts.length);

  const warnings = document.getElementById("map-warnings");
  warnings.innerHTML = claimMap.warnings.map((warning) => `<div class="map-warning"><p>${safeText(warning)}</p></div>`).join("");

  const reasonList = document.getElementById("reason-list");
  reasonList.innerHTML = claimMap.reasons.length
    ? claimMap.reasons.map((reason) => `<article class="reason-row"><div><span class="candidate-label">Pattern to verify</span><h3>${safeText(reason.label)}</h3><p>Matched wording: ${safeText(reason.matchedCues.join(", "))}</p></div><div><p><strong>Question to resolve:</strong> ${safeText(reason.question)}</p><ul class="evidence-chips">${reason.evidence.map((item) => `<li>${safeText(item)}</li>`).join("")}</ul></div></article>`).join("")
    : '<p class="empty-state">No common reason pattern was detected. Preserve the exact wording and request a written explanation rather than guessing.</p>';

  const policyList = document.getElementById("policy-list");
  policyList.innerHTML = claimMap.policyMatches.length
    ? claimMap.policyMatches.map((match, index) => `<article class="policy-row"><span class="candidate-label">Candidate ${index + 1} · verify in original</span><p class="snippet">${safeText(match.snippet)}</p><p>Matched terms: ${safeText(match.matched.join(", "))}</p></article>`).join("")
    : '<p class="empty-state">No matching policy passage is available. Add the complete cited section, definitions, conditions, and endorsements.</p>';

  const amountList = document.getElementById("amount-list");
  amountList.innerHTML = claimMap.estimate.amounts.length
    ? claimMap.estimate.amounts.map((entry) => `<article class="amount-row"><strong>${safeText(entry.raw)}</strong><p>${safeText(entry.context)}</p></article>`).join("")
    : '<p class="empty-state">No dollar amounts were found in the estimate text.</p>';
}

function buildMap({ scroll = true } = {}) {
  state = readFields();
  claimMap = buildClaimMap(state);
  renderMap();
  setStatus(workspaceStatus, "Claim map rebuilt from the current document text. Verify every candidate against the original.", "success");
  if (scroll) document.getElementById("claim-map").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

document.getElementById("build-map").addEventListener("click", () => buildMap());
document.getElementById("load-sample").addEventListener("click", () => {
  writeFields(SAMPLE_CASE);
  buildMap({ scroll: false });
  setStatus(workspaceStatus, "Sample claim loaded. Every sample value is fictional and labeled.", "success");
});

document.getElementById("save-device").addEventListener("click", () => {
  const button = document.getElementById("save-device");
  try {
    state = readFields();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createPortableRecord(state)));
    setButtonState(button, "success", "Saved to this device");
    setStatus(workspaceStatus, "Saved in this browser's local storage. Export a backup before clearing browser data.", "success");
  } catch (error) {
    setButtonState(button, "error", "Could not save");
    setStatus(workspaceStatus, "This browser blocked local storage. Export a JSON backup instead.", "error");
  }
  window.setTimeout(() => setButtonState(button, "", "Save to this device"), 2200);
});

function renderEvidence() {
  const body = document.getElementById("evidence-body");
  if (!state.evidence.length) {
    body.innerHTML = '<tr><td class="empty-state" colspan="4">No evidence items yet.</td></tr>';
    return;
  }
  body.innerHTML = state.evidence.map((item) => `<tr><td data-label="Item">${safeText(item.description)}</td><td data-label="Source">${safeText(item.source || "—")}</td><td data-label="Status">${safeText(item.status.replace("-", " "))}</td><td data-label="Remove"><button type="button" data-remove-evidence="${safeText(item.id)}" aria-label="Remove ${safeText(item.description)}">×</button></td></tr>`).join("");
}

document.getElementById("evidence-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state = readFields();
  const data = new FormData(event.currentTarget);
  const description = String(data.get("description") || "").trim();
  if (!description) return;
  state.evidence.push({ id: `ev-${crypto.randomUUID()}`, description, source: String(data.get("source") || "").trim(), status: String(data.get("status") || "request") });
  event.currentTarget.reset();
  writeFields(state);
  setStatus(workspaceStatus, "Evidence item added.", "success");
});

document.getElementById("evidence-body").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-evidence]");
  if (!button) return;
  state = readFields();
  const index = state.evidence.findIndex((item) => item.id === button.dataset.removeEvidence);
  if (index < 0) return;
  const [item] = state.evidence.splice(index, 1);
  lastRemoved = { kind: "evidence", item, index };
  writeFields(state);
  showUndo("Evidence item removed.");
});

function renderCorrespondence() {
  const body = document.getElementById("correspondence-body");
  if (!state.correspondence.length) {
    body.innerHTML = '<tr><td class="empty-state" colspan="5">No correspondence entries yet.</td></tr>';
    return;
  }
  body.innerHTML = state.correspondence.map((item) => `<tr><td data-label="Date">${safeText(item.date || "—")}</td><td data-label="Channel">${safeText(item.channel)}</td><td data-label="Contact">${safeText(item.contact || "—")}</td><td data-label="Summary">${safeText(item.summary)}</td><td data-label="Remove"><button type="button" data-remove-correspondence="${safeText(item.id)}" aria-label="Remove log entry from ${safeText(item.date || "this date")}">×</button></td></tr>`).join("");
}

document.getElementById("correspondence-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state = readFields();
  const data = new FormData(event.currentTarget);
  const summary = String(data.get("summary") || "").trim();
  if (!summary) return;
  state.correspondence.push({ id: `co-${crypto.randomUUID()}`, date: String(data.get("date") || ""), channel: String(data.get("channel") || ""), contact: String(data.get("contact") || "").trim(), summary });
  event.currentTarget.reset();
  writeFields(state);
  setStatus(workspaceStatus, "Correspondence entry added.", "success");
});

document.getElementById("correspondence-body").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-correspondence]");
  if (!button) return;
  state = readFields();
  const index = state.correspondence.findIndex((item) => item.id === button.dataset.removeCorrespondence);
  if (index < 0) return;
  const [item] = state.correspondence.splice(index, 1);
  lastRemoved = { kind: "correspondence", item, index };
  writeFields(state);
  showUndo("Correspondence entry removed.");
});

function showUndo(message) {
  workspaceStatus.dataset.state = "success";
  workspaceStatus.replaceChildren(document.createTextNode(`${message} `));
  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "action action--quiet action--small";
  undo.textContent = "Undo removal";
  undo.addEventListener("click", () => {
    if (!lastRemoved) return;
    state[lastRemoved.kind].splice(lastRemoved.index, 0, lastRemoved.item);
    lastRemoved = null;
    writeFields(state);
    setStatus(workspaceStatus, "Item restored.", "success");
  }, { once: true });
  workspaceStatus.append(undo);
}

function downloadBlob(filename, type, content) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function datedFilename(stem, extension) {
  return `${stem}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

document.getElementById("download-packet").addEventListener("click", () => {
  state = readFields();
  claimMap = buildClaimMap(state);
  downloadBlob(datedFilename("denialfix-claim-packet", "html"), "text/html", buildPacketHtml(state, claimMap));
  setStatus(exportStatus, "Claim packet downloaded. Review and redact it before sharing.", "success");
});

document.getElementById("print-map").addEventListener("click", () => {
  buildMap({ scroll: false });
  window.print();
});

document.getElementById("export-json").addEventListener("click", () => {
  state = readFields();
  downloadBlob(datedFilename("denialfix-backup", "json"), "application/json", `${JSON.stringify(createPortableRecord(state), null, 2)}\n`);
  setStatus(exportStatus, "Backup exported. It may contain sensitive claim text—store it securely.", "success");
});

document.getElementById("import-json").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = normalizeImportedRecord(JSON.parse(await file.text()));
    writeFields(imported);
    buildMap({ scroll: false });
    setStatus(exportStatus, "Backup restored into this browser. Review the source documents before relying on the map.", "success");
  } catch (error) {
    setStatus(exportStatus, error.message || "That backup could not be imported.", "error");
  } finally {
    event.target.value = "";
  }
});

const clearButton = document.getElementById("clear-workspace");
clearButton.addEventListener("click", () => {
  if (clearButton.dataset.confirm !== "true") {
    clearButton.dataset.confirm = "true";
    setButtonState(clearButton, "error", "Confirm clear all data");
    setStatus(exportStatus, "Click again within five seconds to clear this workspace and its saved device copy.", "error");
    clearTimer = window.setTimeout(() => {
      clearButton.dataset.confirm = "false";
      setButtonState(clearButton, "", "Clear this workspace");
      setStatus(exportStatus, "Clear cancelled. Nothing changed.");
    }, 5000);
    return;
  }
  window.clearTimeout(clearTimer);
  localStorage.removeItem(STORAGE_KEY);
  writeFields({});
  claimMap = buildClaimMap(state);
  renderMap();
  clearButton.dataset.confirm = "false";
  setButtonState(clearButton, "success", "Workspace cleared");
  setStatus(exportStatus, "All DenialFix data in this workspace and its saved device copy was cleared.", "success");
  window.setTimeout(() => setButtonState(clearButton, "", "Clear this workspace"), 2200);
});

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    writeFields(normalizeImportedRecord(JSON.parse(saved)));
    buildMap({ scroll: false });
    setStatus(workspaceStatus, "Restored the DenialFix record you previously saved in this browser.", "success");
  } else {
    writeFields({});
    renderMap();
  }
} catch (_) {
  writeFields({});
  renderMap();
  setStatus(workspaceStatus, "A saved record could not be restored. Import a JSON backup if you have one.", "error");
}
