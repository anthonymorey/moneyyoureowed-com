(() => {
  "use strict";

  const backdrop = document.querySelector("[data-guide-exit-backdrop]");
  if (!backdrop) return;

  const dialog = backdrop.querySelector('[role="dialog"]');
  const form = backdrop.querySelector("form");
  const email = backdrop.querySelector('input[type="email"]');
  const submit = form.querySelector('button[type="submit"]');
  const status = backdrop.querySelector("[data-guide-exit-status]");
  const closeButton = backdrop.querySelector("[data-guide-exit-close]");
  const storageKey = "myo.glp1-checklist.exit.suppressedUntil";
  const suppressionMs = 14 * 24 * 60 * 60 * 1000;
  const coarsePointer = matchMedia("(pointer: coarse)").matches;
  const requiredMs = coarsePointer ? 30000 : 15000;
  const startedAt = Date.now();
  let engaged = false;
  let displayed = false;
  let previousFocus = null;
  let mobileFallbackTimer = null;

  function isSuppressed() {
    try {
      return Number(localStorage.getItem(storageKey)) > Date.now();
    } catch {
      return displayed;
    }
  }

  function suppress() {
    displayed = true;
    try {
      localStorage.setItem(storageKey, String(Date.now() + suppressionMs));
    } catch {
      // Session state still prevents another display on this page.
    }
  }

  function eligible() {
    return engaged && Date.now() - startedAt >= requiredMs && !displayed && !isSuppressed();
  }

  function show() {
    if (!eligible()) return;
    suppress();
    previousFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    email.focus();
  }

  function close({ remember = true } = {}) {
    if (backdrop.hidden) return;
    if (remember) suppress();
    backdrop.hidden = true;
    document.body.style.overflow = "";
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function markEngaged() {
    engaged = true;
    if (coarsePointer && eligible() && mobileFallbackTimer === null) {
      mobileFallbackTimer = window.setTimeout(() => {
        mobileFallbackTimer = null;
        show();
      }, 2000);
    }
  }

  function onScroll() {
    if (scrollY >= Math.min(500, document.documentElement.scrollHeight * 0.2)) markEngaged();
  }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("pointerdown", markEngaged, { once: true, passive: true });
  addEventListener("keydown", markEngaged, { once: true });

  if (coarsePointer) {
    setTimeout(() => {
      if (eligible()) show();
    }, requiredMs);
  } else {
    document.addEventListener("mouseleave", (event) => {
      if (event.clientY <= 0 && event.relatedTarget === null) show();
    });
  }

  closeButton.addEventListener("click", () => close());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled)")]
      .filter((control) => !control.closest("[hidden]") && control.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.dataset.state = "";
    if (!email.checkValidity()) {
      status.textContent = "Enter a valid email address.";
      status.dataset.state = "error";
      email.focus();
      return;
    }

    submit.disabled = true;
    status.textContent = "Sending…";
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: (new URLSearchParams(window.location.search).get('src') || '').slice(0, 40),
          email: email.value.trim(),
          group: "193450189555500253",
        }),
      });
      if (!response.ok) throw new Error("Subscribe request failed");
      suppress();
      form.hidden = true;
      status.textContent = "Check your inbox for the free checklist.";
      status.dataset.state = "success";
      closeButton.focus();
    } catch {
      status.textContent = "We could not send it right now. Please try again.";
      status.dataset.state = "error";
      submit.disabled = false;
    }
  });
})();
