const state = document.getElementById("delivery-state");
const actions = document.getElementById("delivery-actions");
const openLink = document.getElementById("open-denialfix");
const sessionId = new URLSearchParams(window.location.search).get("session_id");

async function verify() {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    state.dataset.state = "error";
    state.textContent = "This access link is incomplete. Open the link from your Stripe receipt email or contact support.";
    return;
  }

  try {
    const response = await fetch(`/api/denialfix-entitlement?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.entitled || !result.downloadUrl) throw new Error(result.error || "Purchase could not be verified");
    openLink.href = result.downloadUrl;
    actions.hidden = false;
    state.dataset.state = "success";
    state.textContent = "Purchase verified. Your private browser workspace can now open.";
  } catch (_) {
    state.dataset.state = "error";
    state.textContent = "We could not verify this session yet. Refresh once, then use the access-help link if it still fails.";
  }
}

verify();
