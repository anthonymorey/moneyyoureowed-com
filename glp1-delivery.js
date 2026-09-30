(() => {
  const status = document.getElementById("purchase-status");
  const download = document.getElementById("kit-download");
  const params = new URLSearchParams(window.location.search);
  const querySession = params.get("session_id") || "";
  const storedSession = localStorage.getItem("myo_glp1_checkout_session") || "";
  const sessionId = querySession || storedSession;

  if (!sessionId) {
    status.textContent = "We could not verify a completed purchase. Return to checkout or use the backup access link in your receipt email.";
    return;
  }

  fetch(`/api/glp1-entitlement?session_id=${encodeURIComponent(sessionId)}`)
    .then(async (response) => ({ response, result: await response.json() }))
    .then(({ response, result }) => {
      if (!response.ok || !result.entitled || !result.deliveryUrl) throw new Error("Not entitled");
      localStorage.setItem("myo_glp1_checkout_session", sessionId);
      download.href = result.deliveryUrl;
      download.hidden = false;
      status.textContent = "Payment verified. Your kit is ready.";
    })
    .catch(() => {
      status.textContent = "We could not verify a completed GLP-1 Appeal Kit purchase. If you paid, use the backup access link in your receipt email or reply to it for help.";
    });
})();
