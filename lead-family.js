"use strict";

const LEAD_ROUTES = Object.freeze({
  "/unclaimed": { group: "189379076374398313" },
  "/unclaimed.html": { group: "189379076374398313" },
  "/airline": { group: "189606595562309447" },
  "/airline.html": { group: "189606595562309447" },
  "/eitc": { group: "189909462863054164", success: "/eitc-thanks" },
  "/eitc.html": { group: "189909462863054164", success: "/eitc-thanks" },
  "/medical": { group: "190642621849273424", success: "/medical-thanks" },
  "/medical.html": { group: "190642621849273424", success: "/medical-thanks" },
  "/propertytax": { group: "190644041404122322", success: "/propertytax-thanks" },
  "/propertytax.html": { group: "190644041404122322", success: "/propertytax-thanks" },
  "/salary": { group: "189909462722544704", magnet: "salary", success: "/salary-thanks" },
  "/salary.html": { group: "189909462722544704", magnet: "salary", success: "/salary-thanks" },
  "/warranty": { group: "189909462722544704", magnet: "warranty", success: "/warranty-thanks" },
  "/warranty.html": { group: "189909462722544704", magnet: "warranty", success: "/warranty-thanks" },
  "/car-deal": { group: "189909462722544704", magnet: "car-deal", success: "/car-deal-thanks" },
  "/car-deal.html": { group: "189909462722544704", magnet: "car-deal", success: "/car-deal-thanks" },
  "/claim": { group: "189379076374398313" },
  "/claim.html": { group: "189379076374398313" },
});

function configForPath() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return LEAD_ROUTES[path] || null;
}

function statusFor(form) {
  let status = form.querySelector(".form-status");
  if (!status) {
    status = document.createElement("p");
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.append(status);
  }
  return status;
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "lead-form") return;
  const config = configForPath();
  if (!config) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const button = form.querySelector('button[type="submit"]');
  const status = statusFor(form);
  const email = form.querySelector('input[type="email"]')?.value.trim() || "";
  const name = form.querySelector('input[type="text"]')?.value.trim() || "";
  const original = button?.textContent || "Submit";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    status.dataset.state = "error";
    status.textContent = "Enter a valid email address.";
    form.querySelector('input[type="email"]')?.focus();
    return;
  }

  if (button) { button.disabled = true; button.textContent = "Sending…"; }
  status.dataset.state = "";
  status.textContent = "Submitting securely…";

  try {
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, group: config.group, ...(config.magnet ? { magnet: config.magnet } : {}), src: signupSource() }),
    });
    if (!response.ok) throw new Error("We could not submit that address");
    status.dataset.state = "success";
    status.textContent = "Success. Your resource is ready.";
    if (config.success) {
      window.setTimeout(() => window.location.assign(config.success), 450);
      return;
    }
    const content = document.getElementById("form-content");
    const success = document.getElementById("success-message") || document.getElementById("success");
    if (content && success) { content.hidden = true; success.style.display = "block"; success.focus?.(); }
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = original; }
    status.dataset.state = "error";
    status.textContent = `${error.message || "Submission failed"}. Please try again.`;
  }
}, true);

// Traffic source for attribution (e.g. ?src=ig-bio from the Instagram bio hub). Server whitelists the format.
function signupSource() {
  try { return (new URLSearchParams(window.location.search).get("src") || "").slice(0, 40); } catch (_) { return ""; }
}
