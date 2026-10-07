"use strict";

// State rules re-verified against official statute text on 2026-10-07 (see vault: Verified Facts — Security Deposit Withheld).
const STATE_LAWS = Object.freeze({
  CA: { name: "California", statute: "California Civil Code § 1950.5", deadline: "21 calendar days", deadlineDays: 21, penalty: "statutory damages of up to twice the amount of the deposit, in addition to actual damages, for bad-faith retention (§ 1950.5(m))", penaltyMultiplier: 2, penaltyBase: "deposit", penaltyCondition: "bad faith retention", itemization: "an itemized statement, with copies of bills, invoices or receipts and the required photographs when repair and cleaning deductions total more than $125 (§ 1950.5(h)(2), (h)(4)(A))", receiptThreshold: 125, attorneyFees: false, notes: "California photo rules (§ 1950.5(g)): since April 1, 2025 the landlord must photograph the unit after you move out, before any repairs or cleaning it deducts for, and again after that work is done. For tenancies that began on or after July 1, 2025, the landlord must also photograph the unit at move-in. If repair and cleaning deductions total $125 or less, you can still request the receipts and photos within 14 days of receiving the itemized statement (§ 1950.5(h)(5))." },
  NY: { name: "New York", statute: "New York General Obligations Law § 7-108(1-a)", deadline: "14 days", deadlineDays: 14, penalty: "forfeiture of the right to keep any portion of the deposit (§ 7-108(1-a)(e)); actual damages, and punitive damages of up to twice the deposit for a willful violation (§ 7-108(1-a)(g))", penaltyMultiplier: 1, penaltyBase: "deposit", penaltyCondition: "failure to provide the itemized statement and remaining deposit within 14 days", itemization: "an itemized statement indicating the basis for any amount retained", attorneyFees: false, notes: "The landlord bears the burden of proving that the amount retained was reasonable (§ 7-108(1-a)(f))." },
  TX: { name: "Texas", statute: "Texas Property Code §§ 92.103, 92.104, 92.107 and 92.109", deadline: "30 days", deadlineDays: 30, penalty: "$100 plus three times the portion wrongfully withheld, plus reasonable attorney's fees, for bad-faith retention (§ 92.109(a)); bad faith is presumed if the deposit or itemized list is not provided within 30 days (§ 92.109(d))", penaltyMultiplier: 3, penaltyBase: "withheld", penaltyFlat: 100, penaltyCondition: "bad faith retention", itemization: "a written description and itemized list of all deductions", attorneyFees: true, notes: "The landlord does not have to refund or itemize until you give a written forwarding address (§ 92.107); you do not lose the deposit just for not giving one." },
  FL: { name: "Florida", statute: "Florida Statutes § 83.49(3)", deadline: "15 days (full refund) or 30 days (written notice of a claim)", deadlineDays: 30, penalty: "forfeiture of the right to impose a claim on the deposit if the 30-day notice is not sent (§ 83.49(3)(a)); court costs and a reasonable attorney's fee for the prevailing party (§ 83.49(3)(c))", penaltyMultiplier: 1, penaltyBase: "deposit", penaltyCondition: "failure to send the 30-day notice of claim", itemization: "a written notice of intention to impose a claim, sent by certified mail or email", attorneyFees: true, notes: "You have 15 days from receiving the landlord's notice to object in writing, or the landlord may deduct its claim. Missing that window does not waive your right to sue separately (§ 83.49(3)(b))." },
  MA: { name: "Massachusetts", statute: "Massachusetts General Laws c. 186 § 15B", deadline: "30 days", deadlineDays: 30, penalty: "three times the deposit or balance owed, plus 5% interest, court costs and reasonable attorney's fees (§ 15B(7))", penaltyMultiplier: 3, penaltyBase: "withheld", penaltyCondition: "failure to return the deposit or balance owed within 30 days, among the other violations listed in § 15B(6)(a), (d) and (e)", itemization: "an itemized list of damages, sworn under the pains and penalties of perjury, with written evidence of cost such as estimates, bills, invoices or receipts (§ 15B(4)(iii))", attorneyFees: true, notes: "A landlord who does not provide the sworn itemized list within 30 days forfeits the right to keep any part of the deposit (§ 15B(6)(b))." },
  CO: { name: "Colorado", statute: "Colorado Revised Statutes § 38-12-103 (as amended by HB 25-1249, effective January 1, 2026)", deadline: "30 days (or up to 60 days if the lease says so)", deadlineDays: 30, penalty: "three times the portion wrongfully withheld, plus reasonable attorney fees and court costs (§ 38-12-103(3)); missing the deadline or the exact-reasons statement forfeits the right to withhold (§ 38-12-103(2), (2.5))", penaltyMultiplier: 3, penaltyBase: "withheld", penaltyCondition: "wrongful withholding, after a written demand and at least 7 days' notice of intent to sue (§ 38-12-103(3)(a), (3)(c))", itemization: "a written statement listing the exact reasons for any amount retained, with relevant documentation such as photos, receipts, invoices or estimates on your written request (§ 38-12-103(1), (8))", attorneyFees: true, notes: "Since January 1, 2026: no deductions for normal wear and tear or pre-existing damage; an amount retained that is 125% or more of actual damages is presumed to be bad faith; the landlord must prove its actual damages (§ 38-12-103(1), (3.5))." },
  OH: { name: "Ohio", statute: "Ohio Revised Code § 5321.16", deadline: "30 days", deadlineDays: 30, penalty: "the money wrongfully withheld, plus damages equal to the amount wrongfully withheld and reasonable attorney's fees (§ 5321.16(C))", penaltyMultiplier: 1, penaltyBase: "withheld", penaltyCondition: "failure to return the deposit or itemize deductions within 30 days", itemization: "an itemized written notice of deductions", attorneyFees: true, notes: "You must give the landlord your forwarding address in writing. Without it, you cannot recover the damages or attorney's fees (§ 5321.16(B))." },
  VA: { name: "Virginia", statute: "Virginia Code § 55.1-1226", deadline: "45 days", deadlineDays: 45, penalty: "return of the deposit plus actual damages and reasonable attorney fees if the landlord willfully fails to comply (§ 55.1-1226(E))", penaltyMultiplier: 1, penaltyBase: "deposit", penaltyCondition: "willful failure to comply", itemization: "an itemized written notice of deductions", attorneyFees: true },
  ME: { name: "Maine", statute: "14 M.R.S. §§ 6033–6034", deadline: "30 days under a written lease (or a shorter period the lease states), or 21 days for a tenancy at will (month-to-month)", deadlineDays: 30, penalty: "double the amount wrongfully withheld, plus reasonable attorney's fees and court costs (§ 6034(2)); missing the deadline forfeits the right to withhold any portion (§ 6033(3))", penaltyMultiplier: 2, penaltyBase: "withheld", penaltyCondition: "wrongful retention, after 7 days' written notice of intent to sue (§ 6034(1))", itemization: "a written statement itemizing the reasons for any amount retained", attorneyFees: true },
  OTHER: { name: "your state", statute: "your state security deposit statute", deadline: "your state statutory deadline", deadlineDays: 30, penalty: "statutory penalties under your state law", penaltyMultiplier: 1, penaltyBase: "deposit", penaltyCondition: "wrongful retention", itemization: "an itemized statement", attorneyFees: false }
});

const LIFESPAN = Object.freeze({ carpet: 7, carpets: 7, rug: 7, rugs: 7, paint: 3, painting: 3, repaint: 3, repainting: 3, "wall paint": 3, blinds: 3, curtains: 3, shades: 3, appliance: 10, refrigerator: 10, stove: 10, oven: 10, dishwasher: 10, microwave: 10, " flooring": 10, tile: 10, laminate: 10, vinyl: 10, hardwood: 25, furniture: 7, sofa: 7, couch: 7, mattress: 7, bed: 7, door: 20, doors: 20, window: 20, windows: 20, "light fixture": 10, fan: 10, "ceiling fan": 10, "garbage disposal": 8, "water heater": 10, "smoke detector": 10, "carbon monoxide detector": 10 });
const WEAR_TEAR_KEYWORDS = ["cleaning", "clean", "wash", "wipe", "dust", "sweep", "mop", "tidy"];
const DAMAGE_KEYWORDS = ["burn", "hole", "holes", "tear", "tears", "rip", "stain", "stains", "break", "broken", "crack", "cracked", "pet damage", "scratch", "scratches", "gouge"];

let deductionCounter = 0;
let analysisData = null;
let generatedLetter = "";
let paidEntitlement = false;

function hasPaidEntitlement() {
  return paidEntitlement && localStorage.getItem("dd_verified_purchase") === "1";
}

function saveCheckoutSnapshot() {
  try { localStorage.setItem("dd_checkout_snapshot", JSON.stringify({ analysisData, tenancyEnd: document.getElementById("tenancy-end").value })); }
  catch (_) { /* browser storage can be unavailable */ }
}

function restoreCheckoutSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem("dd_checkout_snapshot") || "null");
    if (snapshot?.analysisData) { analysisData = snapshot.analysisData; renderAnalysis(analysisData); if (snapshot.tenancyEnd) document.getElementById("tenancy-end").value = snapshot.tenancyEnd; }
  } catch (_) { /* ignore corrupt local snapshots */ }
}

async function verifyCheckoutEntitlement() {
  const sessionId = new URLSearchParams(window.location.search).get("session_id") || localStorage.getItem("dd_verified_session");
  if (!sessionId) return false;
  try {
    const response = await fetch(`/api/dd-entitlement?session_id=${encodeURIComponent(sessionId)}`);
    const body = await response.json();
    if (!response.ok || !body.entitled) return false;
    paidEntitlement = true;
    localStorage.setItem("dd_verified_purchase", "1");
    localStorage.setItem("dd_verified_session", sessionId);
    restoreCheckoutSnapshot();
    return true;
  } catch (_) { return false; }
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function goToStep(step) {
  document.querySelectorAll(".app-step").forEach((el) => { el.dataset.active = "false"; });
  const target = document.getElementById(step === "output" ? "step-output" : `step-${step}`);
  if (!target) return false;
  target.dataset.active = "true";
  document.querySelectorAll("[data-step-progress]").forEach((el) => {
    const n = Number(el.dataset.stepProgress);
    el.dataset.active = String(step === "output" || n <= Number(step));
  });
  target.querySelector("h1")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
  return true;
}

function addDeduction(seed = {}) {
  deductionCounter += 1;
  const id = `deduction-${deductionCounter}`;
  const item = document.createElement("fieldset");
  item.className = "deduction-item";
  item.id = id;
  item.innerHTML = `<legend class="sr-only">Deduction ${deductionCounter}</legend>
    <button class="remove-button" type="button" aria-label="Remove deduction ${deductionCounter}">×</button>
    <div class="deduction-head">
      <div class="field"><label for="${id}-name">What was deducted?</label><input id="${id}-name" class="item-name-input" type="text" value="${escapeHtml(seed.name || "")}" placeholder="Carpet replacement"><div class="field-help"></div></div>
      <div class="field"><label for="${id}-amount">Amount ($)</label><input id="${id}-amount" class="item-amount-input" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(seed.amount || "")}" placeholder="400"><div class="field-help"></div></div>
    </div>
    <div class="field"><label for="${id}-reason">Landlord’s reason</label><input id="${id}-reason" class="item-reason-input" type="text" value="${escapeHtml(seed.reason || "")}" placeholder="Burns and stains"><div class="field-help"></div></div>
    <div class="form-row"><div class="field"><label for="${id}-age">Item age</label><select id="${id}-age" class="item-age-input"><option value="unknown">I don’t know</option>${Array.from({ length: 11 }, (_, age) => `<option value="${age}">${age === 0 ? "New (less than 1 year)" : age === 10 ? "10+ years" : `${age} year${age === 1 ? "" : "s"}`}</option>`).join("")}</select><div class="field-help"></div></div>
    <div class="field"><label for="${id}-evidence">Evidence</label><select id="${id}-evidence" class="item-evidence-input"><option value="photos">Photos</option><option value="inventory">Inventory references</option><option value="receipt">Receipts</option><option value="email">Emails/texts</option><option value="none">No evidence</option></select><div class="field-help"></div></div></div>`;
  if (seed.age != null) item.querySelector(".item-age-input").value = String(seed.age);
  if (seed.evidence) item.querySelector(".item-evidence-input").value = seed.evidence;
  item.querySelector(".remove-button").addEventListener("click", () => item.remove());
  document.getElementById("deductions-container").appendChild(item);
  return item;
}

function analyzeItem(name, amount, reason, ageInput, evidence, hasInventory, receipts, law, itemized, deductionTotal = amount) {
  const nameLower = name.toLowerCase();
  const combined = `${nameLower} ${reason.toLowerCase()}`;
  let verdict = "challengeable";
  const rules = [];
  let estimatedRecovery = amount;
  const isCleaning = WEAR_TEAR_KEYWORDS.some((word) => combined.includes(word));
  const hasDamage = DAMAGE_KEYWORDS.some((word) => combined.includes(word));
  let lifespan = null;
  for (const [key, years] of Object.entries(LIFESPAN)) if (nameLower.includes(key)) { lifespan = years; break; }

  if (isCleaning) {
    rules.push({ rule: "Normal Wear and Tear", text: "Cleaning charges are generally not deductible if the unit was left in reasonably clean condition. After a full tenancy, some cleaning is normal wear and tear — the landlord cannot charge to return the unit to \"as new\" condition (betterment)." });
    if (evidence === "receipt") { rules.push({ rule: "Evidence Supports Challenge", text: "You have a receipt showing the unit was professionally cleaned — this directly counters a cleaning claim." }); verdict = "strong"; }
    else if (hasInventory === "no" || hasInventory === "not-sure") { rules.push({ rule: "Weak Landlord Evidence", text: "Without a check-in inventory, the landlord cannot prove the unit was cleaner at move-in than at move-out. This significantly weakens their cleaning claim." }); verdict = "strong"; }
  }
  if (lifespan) {
    const age = ageInput === "unknown" ? null : Number.parseInt(ageInput, 10);
    if (age !== null && age >= lifespan) { rules.push({ rule: "End of Useful Life", text: `Standard lifespan for ${nameLower} is ${lifespan} years. The item was ${age} years old — at or beyond its useful life. The landlord cannot charge for replacement as this is betterment (improving the property beyond its condition when you moved in). Full challenge recommended.` }); verdict = "strong"; estimatedRecovery = amount; }
    else if (age !== null && age > 0) { const remainingLife = Math.max(0, lifespan - age); const proratedCharge = Math.round((amount * remainingLife / lifespan) * 100) / 100; const recoverable = Math.max(0, amount - proratedCharge); rules.push({ rule: "Depreciation / Proration", text: `Standard lifespan for ${nameLower} is ${lifespan} years. At ${age} years old, the landlord can only charge for ${remainingLife} years of remaining life — approximately $${proratedCharge.toFixed(2)}, not $${amount.toFixed(2)}. The difference ($${recoverable.toFixed(2)}) is challengeable as betterment.` }); estimatedRecovery = recoverable; if (recoverable > amount * 0.5) verdict = "strong"; }
    else { rules.push({ rule: "Lifespan Applies", text: `Standard lifespan for ${nameLower} is ${lifespan} years. If the item was near or beyond this age, the landlord cannot charge for full replacement. Request proof of the item's age (purchase receipts, installation date).` }); }
  }
  if (hasInventory === "no" && !isCleaning) { rules.push({ rule: "No Check-in Inventory", text: "Without a check-in inventory, the landlord cannot prove the item was in better condition at move-in. This significantly weakens their claim for any damage deduction." }); verdict = "strong"; }
  if (receipts === "no" && law.receiptThreshold) {
    if (deductionTotal > law.receiptThreshold) rules.push({ rule: "No Receipts Provided", text: `The listed deductions total $${deductionTotal.toFixed(2)}. Under ${law.statute}(h)(2) and (h)(4)(A), when repair and cleaning deductions together total more than $${law.receiptThreshold}, the landlord must send copies of the bills, invoices or receipts, and the photographs required by § 1950.5(g), with the itemized statement. No receipts were provided.` });
    else rules.push({ rule: "Request Receipts", text: `The listed deductions total $${deductionTotal.toFixed(2)}, which is not more than $${law.receiptThreshold}, so receipts did not have to be sent automatically. Under ${law.statute}(h)(5), the tenant can request the receipts and photographs within 14 days of receiving the itemized statement, and the landlord must provide them within 14 days of the request.` });
  }
  if (itemized === "no") { rules.push({ rule: "Failure to Itemize", text: `Under ${law.statute}, the landlord must provide ${law.itemization} within ${law.deadline}. No itemized statement was provided — this may trigger the statutory penalty (${law.penalty}).` }); verdict = "strong"; }
  if (hasDamage && !isCleaning && verdict === "strong") rules.push({ rule: "Possible Legitimate Damage", text: "The landlord claims actual damage (not just wear). If the damage is genuine and beyond normal wear, this portion may be legitimate. Challenge the amount and demand proof." });
  if (rules.length === 0) rules.push({ rule: "General Challenge", text: "Challenge this deduction. Demand proof of the original condition (inventory, photos) and receipts for the claimed cost. The burden is on the landlord to justify the deduction." });
  return { verdict, verdictClass: verdict, rules, estimatedRecovery };
}

function collectAnalysis() {
  const stateCode = document.getElementById("state-select").value;
  if (!stateCode || !STATE_LAWS[stateCode]) return { error: "Choose a state rule set before analysis." };
  const law = STATE_LAWS[stateCode];
  const deposit = Number.parseFloat(document.getElementById("deposit-amount").value);
  if (!Number.isFinite(deposit) || deposit <= 0) return { error: "Enter a deposit amount greater than zero." };
  const hasInventory = document.getElementById("check-in-inventory").value;
  const itemized = document.getElementById("itemized-statement").value;
  const receipts = document.getElementById("receipts-provided").value;
  const rows = [];
  document.querySelectorAll(".deduction-item").forEach((item) => {
    const name = item.querySelector(".item-name-input").value.trim();
    const amount = Number.parseFloat(item.querySelector(".item-amount-input").value);
    const reason = item.querySelector(".item-reason-input").value.trim();
    const age = item.querySelector(".item-age-input").value;
    const evidence = item.querySelector(".item-evidence-input").value;
    if (name && Number.isFinite(amount) && amount > 0) rows.push({ name, amount, reason, age, evidence });
  });
  const deductionTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const deductions = rows.map((row) => ({ ...row, analysis: analyzeItem(row.name, row.amount, row.reason, row.age, row.evidence, hasInventory, receipts, law, itemized, deductionTotal) }));
  if (deductions.length === 0) return { error: "Add at least one named deduction with an amount greater than zero." };
  return { stateCode, law, deposit, hasInventory, itemized, receipts, deductions };
}

function renderAnalysis(data) {
  const container = document.getElementById("analysis-results");
  container.replaceChildren();
  data.deductions.forEach((deduction, index) => {
    const result = document.createElement("article");
    result.className = "result";
    result.innerHTML = `<h2>${index + 1}. ${escapeHtml(deduction.name)} · $${deduction.amount.toFixed(2)}</h2><span class="verdict ${deduction.analysis.verdict === "strong" ? "verdict--strong" : ""}">${deduction.analysis.verdict === "strong" ? "Strong challenge signal" : "Challengeable"}</span><p class="muted">Landlord’s reason: ${escapeHtml(deduction.reason || "not provided")}</p>${deduction.analysis.rules.map((entry) => `<div class="rule"><strong>${escapeHtml(entry.rule)}:</strong> ${escapeHtml(entry.text)}</div>`).join("")}<p class="recovery">Source-engine estimate: $${deduction.analysis.estimatedRecovery.toFixed(2)}</p><p class="fine"><strong>Verify:</strong> current official statute, local interpretation, evidence, and amount.</p>`;
    container.appendChild(result);
  });
  const total = data.deductions.reduce((sum, item) => sum + item.analysis.estimatedRecovery, 0);
  document.getElementById("total-recovery-box").hidden = false;
  document.getElementById("total-recovery-amount").textContent = `$${total.toFixed(2)}`;
  document.getElementById("penalty-info").textContent = data.itemized === "no" || data.itemized === "late" ? `Source notes ${data.law.penalty} under ${data.law.statute}. Verify applicability and current wording.` : `Source: ${data.law.statute}. Verify before use.`;
  if (data.law.notes) document.getElementById("penalty-info").textContent += ` ${data.law.notes}`;
}

function value(id, fallback) { return document.getElementById(id)?.value.trim() || fallback; }

function generateLetter(data) {
  const law = data.law;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const userName = value("user-name", "[Your Name]");
  const userPhone = value("user-phone", "[Your Phone]");
  const userEmail = value("user-email", "[Your Email]");
  const userAddress = value("user-address", "[Your Forwarding Address]");
  const landlordName = value("landlord-name", "[Landlord/Property Manager Name]");
  const landlordAddress = value("landlord-address", "[Landlord Address]");
  const rentalAddress = value("rental-address", "[Your Rental Address]");
  let letter = `VERIFICATION REQUIRED BEFORE SENDING\nConfirm all statutes, deadlines, penalties, amounts, names, addresses, and local procedure from current official sources.\n\n${today}\n\n${landlordName}\n${landlordAddress}\n\nRE: Return of Security Deposit — ${rentalAddress}\n\nDear ${landlordName},\n\n`;
  letter += `I am writing about my security deposit of $${data.deposit.toFixed(2)} and to formally demand the return of the amounts you improperly withheld, as set out below, pursuant to ${law.statute}.\n\n`;
  letter += `My tenancy at ${rentalAddress} ended on ${document.getElementById("tenancy-end").value || "[move-out date]"}. Under ${law.statute}, you were required to return my deposit or provide ${law.itemization}. The deadline is ${law.deadline}, counted from my move-out or the end of the tenancy as the statute specifies.\n\n`;
  if (data.itemized === "no") letter += `STATUTORY VIOLATION: You did not provide an itemized statement of deductions as required by ${law.statute}. Under this statute, failure to comply may result in ${law.penalty}. I reserve all rights under this statute.\n\n`;
  else if (data.itemized === "late") letter += `STATUTORY VIOLATION: The itemized statement was provided after the deadline (${law.deadline}) required by ${law.statute}. Under this statute, late compliance may result in ${law.penalty}.\n\n`;
  letter += "OBJECTIONS TO DEDUCTIONS:\n\n";
  data.deductions.forEach((deduction, index) => { letter += `${index + 1}. ${deduction.name} — $${deduction.amount.toFixed(2)}\n   I dispute this deduction for the following reasons:\n`; deduction.analysis.rules.forEach((entry) => { letter += `   • ${entry.rule}: ${entry.text}\n`; }); letter += `   Estimated improperly withheld: $${deduction.analysis.estimatedRecovery.toFixed(2)}\n\n`; });
  const total = data.deductions.reduce((sum, item) => sum + item.analysis.estimatedRecovery, 0);
  letter += `TOTAL IMPROPERLY WITHHELD: $${total.toFixed(2)}\n\nDEMAND:\n\nI demand that you return $${total.toFixed(2)} of my security deposit within 10 days of the date of this letter.\n\n`;
  if (data.itemized === "no" || data.itemized === "late") { const penaltyBase = law.penaltyBase === "withheld" ? total : data.deposit; const penaltyAmount = (law.penaltyFlat || 0) + penaltyBase * law.penaltyMultiplier; letter += `If you do not comply, I will file a claim in small claims court seeking:\n   • Return of the improperly withheld deposit: $${total.toFixed(2)}\n   • Statutory penalty under ${law.statute}: ${law.penalty}`; if (law.penaltyMultiplier > 1) letter += ` (up to about $${penaltyAmount.toFixed(2)} on these figures, if a court finds it applies)`; letter += "\n   • Court filing fees and costs\n"; if (law.attorneyFees) letter += "   • Attorney's fees where permitted by statute\n"; letter += "\n"; }
  else letter += `If you do not comply, I will file a claim in small claims court seeking the return of the improperly withheld amounts, plus any statutory penalties and costs available under ${law.statute}.\n\n`;
  letter += `This letter is my formal demand before filing in small claims court. I hope we can resolve this without court intervention.\n\nPlease send the refund check to:\n${userName}\n${userAddress}\n\nSincerely,\n\n${userName}\n${userPhone}\n${userEmail}\n\n---\nDisclaimer: This letter was generated by Deposit Defender, educational document preparation software. It is not legal advice. Review with a local attorney if your situation is complex. Statutes change — verify current law for your state.\n`;
  return letter;
}

function resetApp() {
  document.querySelectorAll("input, textarea").forEach((el) => { el.value = ""; });
  document.querySelectorAll("select").forEach((el) => { el.selectedIndex = 0; });
  document.getElementById("deductions-container").replaceChildren();
  deductionCounter = 0; analysisData = null; generatedLetter = ""; addDeduction(); goToStep(1);
}

document.addEventListener("DOMContentLoaded", () => {
  addDeduction();
  document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => goToStep(button.dataset.next)));
  document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => goToStep(button.dataset.back)));
  document.getElementById("add-deduction").addEventListener("click", () => addDeduction());
  document.getElementById("analyze-button").addEventListener("click", () => {
    const status = document.getElementById("analysis-status");
    const result = collectAnalysis();
    if (result.error) { status.dataset.state = "error"; status.textContent = result.error; return; }
    status.textContent = ""; analysisData = result; renderAnalysis(result); goToStep(4);
  });
  document.getElementById("dd-checkout-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (hasPaidEntitlement()) { goToStep(5); return; }
    const email = document.getElementById("dd-checkout-email");
    const button = document.getElementById("preview-letter-button");
    const status = document.getElementById("checkout-status");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { status.dataset.state = "error"; status.textContent = "Enter a complete email address."; email.focus(); return; }
    button.disabled = true; button.dataset.state = "loading"; button.textContent = "Starting secure checkout…"; status.textContent = "";
    saveCheckoutSnapshot();
    try {
      const response = await fetch("/api/dd-checkout-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value.trim() }) });
      const body = await response.json();
      if (!response.ok || !/^https:\/\/checkout\.stripe\.com\//.test(body.url || "")) throw new Error(body.error || "Could not start checkout");
      window.location.assign(body.url);
    } catch (error) { button.disabled = false; button.dataset.state = "error"; button.textContent = "Retry checkout · $29"; status.dataset.state = "error"; status.textContent = `${error.message || "Could not start checkout"}. Please try again.`; }
  });
  document.getElementById("generate-letter").addEventListener("click", () => { if (!analysisData) { goToStep(3); return; } generatedLetter = generateLetter(analysisData); document.getElementById("letter-output").textContent = generatedLetter; goToStep("output"); });
  document.getElementById("copy-letter").addEventListener("click", async () => { const status = document.getElementById("letter-status"); try { await navigator.clipboard.writeText(generatedLetter); status.dataset.state = "success"; status.textContent = "Copied locally."; } catch { status.dataset.state = "error"; status.textContent = "Clipboard access was blocked. Select the letter text and copy manually."; } });
  document.getElementById("download-letter").addEventListener("click", () => { const blob = new Blob([generatedLetter], { type: "text/plain;charset=utf-8" }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.href = url; link.download = "deposit-demand-letter.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); document.getElementById("letter-status").textContent = "Text-file download started."; });
  document.getElementById("print-letter").addEventListener("click", () => window.print());
  document.getElementById("start-over").addEventListener("click", resetApp);
  verifyCheckoutEntitlement().then((verified) => { if (verified) { document.getElementById("checkout-status").dataset.state = "success"; document.getElementById("checkout-status").textContent = "Purchase verified. Letter builder unlocked."; goToStep(5); } });
});

window.__DD_TEST__ = Object.freeze({ STATE_LAWS, LIFESPAN, analyzeItem, generateLetter, collectAnalysis, addDeduction, goToStep });
