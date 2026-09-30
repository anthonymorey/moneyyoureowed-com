#!/usr/bin/env python3
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("GUIDE_EXIT_BASE_URL", "http://guide-exit.test").rstrip("/")
URL = f"{BASE}/guides/medicare-glp1-bridge.html"
KEY = "myo.glp1-checklist.exit.suppressedUntil"


def engage_desktop(page):
    page.keyboard.press("ArrowDown")
    page.evaluate("window.__testNow += 15000")
    page.evaluate("""
      document.dispatchEvent(new MouseEvent('mouseleave', {clientY: 0, relatedTarget: null}));
    """)


def serve_project(route):
    path = urlparse(route.request.url).path.lstrip("/")
    candidate = (ROOT / path).resolve()
    if ROOT not in candidate.parents or not candidate.is_file():
        route.fulfill(status=404, body="Not found")
        return
    route.fulfill(
        status=200,
        content_type=mimetypes.guess_type(candidate)[0] or "application/octet-stream",
        body=candidate.read_bytes(),
    )


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or None,
    )
    context = browser.new_context()
    context.add_init_script("window.__testNow = 1000000000000; Date.now = () => window.__testNow;")
    if "GUIDE_EXIT_BASE_URL" not in os.environ:
        context.route(f"{BASE}/**", serve_project)

    desktop = context.new_page()
    desktop.set_viewport_size({"width": 1000, "height": 800})
    desktop.goto(URL, wait_until="networkidle")
    dialog = desktop.get_by_role("dialog")
    assert dialog.is_hidden()
    desktop.mouse.move(400, 0)
    assert dialog.is_hidden(), "must not show before meaningful engagement"
    opener = desktop.locator("main a").first
    opener.focus()
    engage_desktop(desktop)
    assert dialog.is_visible()
    assert desktop.locator("#guide-exit-email").evaluate("el => el === document.activeElement")
    desktop.get_by_role("button", name="Close checklist offer").click()
    assert dialog.is_hidden()
    assert opener.evaluate("el => el === document.activeElement")

    desktop.close()

    escape_page = context.new_page()
    escape_page.set_viewport_size({"width": 1000, "height": 800})
    escape_page.goto(URL, wait_until="networkidle")
    escape_page.evaluate("key => localStorage.removeItem(key)", KEY)
    opener = escape_page.locator("main a").first
    opener.focus()
    engage_desktop(escape_page)
    assert escape_page.get_by_role("dialog").is_visible()
    reload_without_close = context.new_page()
    reload_without_close.set_viewport_size({"width": 1000, "height": 800})
    reload_without_close.goto(URL, wait_until="networkidle")
    engage_desktop(reload_without_close)
    assert reload_without_close.get_by_role("dialog").is_hidden(), "display alone must start 14-day suppression"
    reload_without_close.close()
    escape_page.keyboard.press("Escape")
    assert escape_page.get_by_role("dialog").is_hidden()
    assert opener.evaluate("el => el === document.activeElement")
    escape_page.close()

    backdrop_page = context.new_page()
    backdrop_page.set_viewport_size({"width": 1000, "height": 800})
    backdrop_page.goto(URL, wait_until="networkidle")
    backdrop_page.evaluate("key => localStorage.removeItem(key)", KEY)
    engage_desktop(backdrop_page)
    backdrop_page.locator("[data-guide-exit-backdrop]").click(position={"x": 5, "y": 5})
    assert backdrop_page.get_by_role("dialog").is_hidden()
    backdrop_page.close()

    suppressed = context.new_page()
    suppressed.set_viewport_size({"width": 1000, "height": 800})
    suppressed.goto(URL, wait_until="networkidle")
    assert suppressed.evaluate("(key) => Number(localStorage.getItem(key)) > Date.now()", KEY)
    engage_desktop(suppressed)
    assert suppressed.get_by_role("dialog").is_hidden()
    suppressed.close()

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mobile_context.add_init_script("window.__testNow = 1000000000000; Date.now = () => window.__testNow;")
    if "GUIDE_EXIT_BASE_URL" not in os.environ:
        mobile_context.route(f"{BASE}/**", serve_project)
    mobile = mobile_context.new_page()
    mobile.goto(URL, wait_until="networkidle")
    mobile.evaluate("key => localStorage.removeItem(key)", KEY)
    mobile.evaluate("window.__testNow += 29000")
    mobile.evaluate("document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 700); dispatchEvent(new Event('scroll'))")
    assert mobile.get_by_role("dialog").is_hidden()
    mobile.evaluate("window.__testNow += 1000; dispatchEvent(new Event('scroll'))")
    assert mobile.get_by_role("dialog").is_hidden(), "the engagement gesture must not synchronously open the dialog"
    mobile.wait_for_timeout(2100)
    assert mobile.get_by_role("dialog").is_visible()
    mobile.close()

    first_tap = mobile_context.new_page()
    first_tap.goto(URL, wait_until="networkidle")
    first_tap.evaluate("key => localStorage.removeItem(key)", KEY)
    first_tap.evaluate("window.__testNow += 30000")
    first_tap.locator("aside.cta a.button").first.dispatch_event("pointerdown")
    assert first_tap.get_by_role("dialog").is_hidden(), "a paid-CTA pointerdown must not be intercepted"
    first_tap.wait_for_timeout(2100)
    assert first_tap.get_by_role("dialog").is_visible()
    first_tap.close()
    mobile_context.close()

    submit = context.new_page()
    submit.set_viewport_size({"width": 1000, "height": 800})
    requests = []

    def mock_subscribe(route):
        requests.append(route.request.post_data_json)
        route.fulfill(status=200, content_type="application/json", body='{"ok":true}')

    submit.route("**/api/subscribe", mock_subscribe)
    submit.goto(URL, wait_until="networkidle")
    submit.evaluate("key => localStorage.removeItem(key)", KEY)
    engage_desktop(submit)
    submit.locator("#guide-exit-email").fill("reader@example.test")
    submit.get_by_role("button", name="Send me the free checklist").click()
    submit.locator("[data-guide-exit-status][data-state='success']").wait_for()
    assert requests == [{
        "email": "reader@example.test",
        "group": "193450189555500253",
    }]
    assert submit.evaluate("(key) => Number(localStorage.getItem(key)) > Date.now()", KEY)
    close_control = submit.get_by_role("button", name="Close checklist offer")
    assert close_control.evaluate("el => el === document.activeElement")
    submit.keyboard.press("Tab")
    assert close_control.evaluate("el => el === document.activeElement"), "success state must keep focus inside the dialog"
    submit.close()
    context.close()
    browser.close()

print(json.dumps({"ok": True, "checks": [
    "desktop engagement and real exit",
    "close, Escape, backdrop and focus return",
    "14-day localStorage suppression",
    "mobile engaged-session fallback",
    "mocked successful subscribe POST",
]}))
