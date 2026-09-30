#!/usr/bin/env python3
"""Read-only mobile observer for an already-created Stripe Checkout Session."""

import asyncio
import json
import os
import re
import sys
from urllib.parse import urlparse

VIEWPORTS = (375, 390, 430)
LINK_PATTERN = re.compile(r"\bLink\b", re.IGNORECASE)
FINAL_ACTION_PATTERN = re.compile(
    r"^(pay|submit|complete|place order|buy|purchase)(?:\b|\s)", re.IGNORECASE
)


def redact(value):
    text = str(value)
    text = re.sub(r"https?://[^\s\"']+", "[redacted-url]", text)
    text = re.sub(r"\bcs_(?:test_|live_)?[A-Za-z0-9_]+", "[redacted-session]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[redacted-email]", text)
    return text[:300]


def checkout_url():
    raw = os.environ.get("STRIPE_CHECKOUT_URL", "").strip()
    if not raw:
        raise ValueError("STRIPE_CHECKOUT_URL is required (use an already-created Session URL)")
    parsed = urlparse(raw)
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or not (hostname == "checkout.stripe.com" or hostname.endswith(".checkout.stripe.com"))
    ):
        raise ValueError("STRIPE_CHECKOUT_URL must be an HTTPS Stripe Checkout host URL")
    return raw


async def inspect_viewport(browser, url, width):
    context = await browser.new_context(
        viewport={"width": width, "height": 844},
        is_mobile=True,
        has_touch=True,
    )
    page = await context.new_page()
    browser_errors = []
    failed_requests = []
    bad_responses = []

    page.on("pageerror", lambda error: browser_errors.append(redact(error)))
    page.on(
        "console",
        lambda message: browser_errors.append(redact(message.text))
        if message.type == "error" else None,
    )
    page.on(
        "requestfailed",
        lambda request: failed_requests.append({
            "resource": request.resource_type,
            "error": redact(request.failure or "request failed"),
        }),
    )
    page.on(
        "response",
        lambda response: bad_responses.append({
            "status": response.status,
            "resource": response.request.resource_type,
        }) if response.status >= 400 else None,
    )

    # Install before Stripe code: even accidental automation changes cannot submit
    # a form. The observer itself performs no clicks, typing, or form interaction.
    await page.add_init_script("""
      window.__codexSafety = { submitAttempted: false };
      addEventListener("submit", event => {
        window.__codexSafety.submitAttempted = true;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      HTMLFormElement.prototype.submit = function () {
        window.__codexSafety.submitAttempted = true;
      };
      HTMLFormElement.prototype.requestSubmit = function () {
        window.__codexSafety.submitAttempted = true;
      };
    """)

    navigation_error = None
    status = None
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
        status = response.status if response else None
        await page.wait_for_timeout(4_000)
    except Exception as error:
        navigation_error = redact(error)

    frame_observations = []
    if navigation_error is None:
        for frame in page.frames:
            try:
                frame_observations.append(await frame.evaluate("""
      () => {
        const emailInputs = Array.from(
          document.querySelectorAll('input[type="email"], input[autocomplete="email"]'));
        const controls = Array.from(
          document.querySelectorAll('button, input[type="submit"], [role="button"]'))
          .map(node => (node.innerText || node.value || node.getAttribute("aria-label") || "").trim())
          .filter(Boolean);
        return {
          text: document.body?.innerText || "",
          emailPresent: emailInputs.length > 0,
          emailPrefilled: emailInputs.some(input => Boolean(input.value)),
          controls,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          safetyTriggered: Boolean(window.__codexSafety?.submitAttempted),
        };
      }
                """))
            except Exception as error:
                browser_errors.append(redact(error))

    visible_text = "\n".join(item["text"] for item in frame_observations)
    controls = [
        label
        for item in frame_observations
        for label in item["controls"]
    ]
    email_present = any(item["emailPresent"] for item in frame_observations)
    email_prefilled = any(item["emailPrefilled"] for item in frame_observations)
    overflow = frame_observations[0]["overflow"] if frame_observations else False
    safety_triggered = any(item["safetyTriggered"] for item in frame_observations)
    result = {
        "viewportWidth": width,
        "httpStatus": status,
        "checkoutLoaded": navigation_error is None and status is not None and status < 400,
        "link": "visibly-offered" if LINK_PATTERN.search(visible_text) else "not-offered-or-eligibility-unknown",
        "emailFieldObservable": email_present,
        "emailPrefilledIfObservable": (
            email_prefilled if email_present else None
        ),
        "horizontalOverflow": overflow,
        "finalActionPresent": any(FINAL_ACTION_PATTERN.search(label) for label in controls),
        "submitAttempted": safety_triggered,
        "browserErrors": browser_errors,
        "failedRequestCount": len(failed_requests),
        "badResponseCount": len(bad_responses),
        "navigationError": navigation_error,
    }
    await context.close()
    return result


async def main():
    try:
        url = checkout_url()
    except ValueError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        return 2

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print(json.dumps({"ok": False, "error": "Playwright for Python is not installed"}))
        return 3

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or None,
        )
        try:
            results = [
                await inspect_viewport(browser, url, width)
                for width in VIEWPORTS
            ]
        finally:
            await browser.close()

    safety_failed = any(result["submitAttempted"] for result in results)
    checkout_broken = any(
        not result["checkoutLoaded"]
        or result["horizontalOverflow"]
        or not result["finalActionPresent"]
        or result["browserErrors"]
        for result in results
    )
    link_observed = any(result["link"] == "visibly-offered" for result in results)
    report = {
        "ok": not safety_failed and not checkout_broken and link_observed,
        "checkout": "broken" if checkout_broken else "loaded",
        "link": "visibly-offered" if link_observed else "not-offered-or-eligibility-unknown",
        "safety": "failed" if safety_failed else "no-submission-attempted",
        "results": results,
    }
    print(json.dumps(report, indent=2))
    if safety_failed or checkout_broken:
        return 1
    if not link_observed:
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
