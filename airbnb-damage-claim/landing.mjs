const tabs = [...document.querySelectorAll('[role="tab"]')];
const panes = [...document.querySelectorAll('[role="tabpanel"]')];
const checkoutAttemptKey = "myo:airbnb-damage-checkout-attempt";
let volatileCheckoutAttempt = null;

function getCheckoutAttempt(email) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(checkoutAttemptKey) || "null");
    if (saved && saved.email === email && /^[a-zA-Z0-9_-]{16,80}$/.test(saved.id || "")) return saved.id;
    const next = { email, id: crypto.randomUUID() };
    sessionStorage.setItem(checkoutAttemptKey, JSON.stringify(next));
    return next.id;
  } catch (_) {
    if (!volatileCheckoutAttempt || volatileCheckoutAttempt.email !== email) {
      volatileCheckoutAttempt = { email, id: crypto.randomUUID() };
    }
    return volatileCheckoutAttempt.id;
  }
}

function selectTab(nextTab) {
  for (const tab of tabs) {
    const selected = tab === nextTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const pane of panes) {
    const active = pane.getAttribute("aria-labelledby") === nextTab.id;
    pane.dataset.active = String(active);
    pane.hidden = !active;
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
    selectTab(tabs[next]);
    tabs[next].focus();
  });
}

const form = document.getElementById("airbnb-damage-checkout");
if (form) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "cancelled") {
    try { sessionStorage.removeItem(checkoutAttemptKey); } catch (_) { volatileCheckoutAttempt = null; }
    status.dataset.state = "error";
    status.textContent = "Checkout was cancelled. You were not charged.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    if (!email || !form.elements.email.checkValidity()) {
      form.elements.email.setAttribute("aria-invalid", "true");
      status.dataset.state = "error";
      status.textContent = "Enter a complete email address for your receipt and access link.";
      form.elements.email.focus();
      return;
    }
    form.elements.email.removeAttribute("aria-invalid");
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "Opening secure checkout…";
    status.textContent = "";
    try {
      const attemptId = getCheckoutAttempt(email);
      const response = await fetch("/api/checkout-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product: "airbnb-damage-claim", attemptId, utmSource: params.get("utm_source") || "", utmMedium: params.get("utm_medium") || "", utmCampaign: params.get("utm_campaign") || "" }),
      });
      const result = await response.json();
      if (!response.ok || !/^https:\/\/checkout\.stripe\.com\//.test(result.url || "")) throw new Error(result.error || "Checkout could not start");
      window.location.assign(result.url);
    } catch (_) {
      button.disabled = false;
      button.dataset.state = "error";
      button.textContent = "Try secure checkout again · $47";
      status.dataset.state = "error";
      status.textContent = "Secure checkout could not open. Please try again. You were not charged.";
    }
  });
}
