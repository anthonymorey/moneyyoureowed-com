"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-site-nav]");
  if (menu && nav) {
    menu.addEventListener("click", () => {
      const open = nav.dataset.open !== "true";
      nav.dataset.open = String(open);
      menu.setAttribute("aria-expanded", String(open));
      menu.textContent = open ? "Close" : "Menu";
    });
  }

  const form = document.getElementById("recovery-checkout");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("checkout-email");
    const name = document.getElementById("checkout-name");
    const button = document.getElementById("checkout-submit");
    const status = document.getElementById("checkout-status");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
      email.setAttribute("aria-invalid", "true");
      status.dataset.state = "error";
      status.textContent = "Enter a complete email address.";
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "Starting secure checkout…";
    status.textContent = "";
    try {
      const response = await fetch("/api/checkout-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), name: name.value.trim(), product: "bundle" })
      });
      const body = await response.json();
      if (!response.ok || !/^https:\/\/checkout\.stripe\.com\//.test(body.url || "")) throw new Error(body.error || "Could not start checkout");
      window.location.assign(body.url);
    } catch (error) {
      button.disabled = false;
      button.dataset.state = "error";
      button.textContent = "Try secure checkout again · $59";
      status.dataset.state = "error";
      status.textContent = `${error.message || "Could not start checkout"}. Please try again.`;
    }
  });
});