(() => {
  const form = document.getElementById("glp1-checkout");
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "cancelled") {
    status.textContent = "Checkout was cancelled. You were not charged.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    if (!email || !form.elements.email.checkValidity()) {
      status.textContent = "Enter a valid email address for your receipt and backup access link.";
      form.elements.email.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Opening secure checkout…";
    status.textContent = "";

    try {
      const response = await fetch("/api/checkout-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product: "glp1-appeal" }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not start");
      window.location.assign(result.url);
    } catch (_) {
      status.textContent = "Secure checkout could not open. Please try again.";
      button.disabled = false;
      button.textContent = "Get the GLP-1 Appeal Kit — $39";
    }
  });
})();
