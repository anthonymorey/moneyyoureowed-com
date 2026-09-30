"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("lead-preview");
  if (!form) return;
  const email = document.getElementById("email");
  const name = document.getElementById("name");
  const help = document.getElementById("email-help");
  const status = document.getElementById("lead-status");
  const result = document.getElementById("lead-preview-result");
  const submit = document.getElementById("lead-submit");
  let touched = false;

  const validate = () => {
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim());
    email.setAttribute("aria-invalid", String(!valid));
    help.dataset.state = valid ? "success" : "error";
    help.textContent = valid ? "Valid email format." : email.value.trim() ? "Enter a complete email such as name@example.com." : "Email is required.";
    return valid;
  };

  email.addEventListener("blur", () => { touched = true; validate(); });
  email.addEventListener("input", () => { if (touched) validate(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    touched = true;
    if (!validate()) { status.dataset.state = "error"; status.textContent = "Fix the email field to continue."; email.focus(); return; }
    submit.disabled = true;
    submit.dataset.state = "loading";
    submit.textContent = "Sending your checklist…";
    status.textContent = "";
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), name: name.value.trim(), group: "189909462722544704", src: (new URLSearchParams(window.location.search).get("src") || "").slice(0, 40) })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not request the checklist");
      result.hidden = false;
      result.querySelector("strong").textContent = name.value.trim() ? `Checklist requested, ${name.value.trim()}.` : "Checklist requested.";
      status.dataset.state = "success";
      status.textContent = "Success. Opening the download page…";
      window.setTimeout(() => window.location.assign("/11ways-thanks"), 700);
    } catch (error) {
      submit.disabled = false;
      submit.dataset.state = "error";
      submit.textContent = "Try sending the checklist again";
      status.dataset.state = "error";
      status.textContent = `${error.message || "Could not request the checklist"}. Please try again.`;
    }
  });
  document.getElementById("lead-edit").addEventListener("click", () => { result.hidden = true; submit.disabled = false; submit.dataset.state = "default"; submit.textContent = "Email my free checklist"; email.focus(); });
  document.getElementById("lead-reset").addEventListener("click", () => { form.reset(); touched = false; email.setAttribute("aria-invalid", "false"); help.dataset.state = ""; help.textContent = "Required to deliver your checklist."; status.dataset.state = ""; status.textContent = ""; result.hidden = true; submit.disabled = false; submit.dataset.state = "default"; submit.textContent = "Email my free checklist"; });
});