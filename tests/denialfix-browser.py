#!/usr/bin/env python3
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("DENIALFIX_BASE_URL", "http://127.0.0.1:8765").rstrip("/")
VIEWPORTS = [320, 375, 414, 768, 1280]
OUT = Path(os.environ.get("DENIALFIX_QA_DIR", "/tmp/denialfix-qa"))
OUT.mkdir(parents=True, exist_ok=True)

results = []
with sync_playwright() as p:
    launch_options: dict[str, object] = {"headless": True}
    if executable := os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
        launch_options["executable_path"] = executable
    browser = p.chromium.launch(**launch_options)
    pdf_path = OUT / "fixture-denial.pdf"
    fixture_page = browser.new_page()
    fixture_page.set_content("<html><body><p>PDF IMPORT TEST. Claim denied for repeated seepage under Section I Exclusions.</p></body></html>")
    fixture_page.pdf(path=str(pdf_path), format="Letter")
    fixture_page.close()

    pdf_page = browser.new_page(viewport={"width": 768, "height": 900})
    pdf_page.goto(f"{BASE}/d/denialfix-7f3c91e2/", wait_until="networkidle")
    pdf_page.set_input_files("#denial-file", str(pdf_path))
    pdf_page.locator("#denial-file-status[data-state='success']").wait_for(timeout=20000)
    assert "PDF IMPORT TEST" in pdf_page.locator("#denial-text").input_value()
    pdf_page.get_by_role("button", name="Load sample claim").click()
    pdf_page.get_by_role("button", name="Build my claim map").click()
    pdf_page.locator("#evidence-description").fill("Second contractor estimate")
    pdf_page.locator("#evidence-source").fill("Licensed contractor")
    pdf_page.get_by_role("button", name="Add evidence item").click()
    assert pdf_page.locator("#evidence-body tr").count() == 3
    pdf_page.locator("#correspondence-date").fill("2026-07-26")
    pdf_page.locator("#correspondence-summary").fill("Requested the complete cited policy wording in writing.")
    pdf_page.get_by_role("button", name="Add log entry").click()
    assert pdf_page.locator("#correspondence-body tr").count() == 1
    pdf_page.get_by_role("button", name="Save to this device").click()
    assert pdf_page.evaluate("Boolean(localStorage.getItem('denialfix.case.v1'))")
    with pdf_page.expect_download() as packet_download:
        pdf_page.get_by_role("button", name="Download claim packet").click()
    assert packet_download.value.suggested_filename.endswith(".html")
    pdf_page.evaluate("window.__denialfixPrinted = false; window.print = () => { window.__denialfixPrinted = true; }")
    pdf_page.get_by_role("button", name="Print current map").click()
    assert pdf_page.evaluate("window.__denialfixPrinted") is True
    with pdf_page.expect_download() as backup_download:
        pdf_page.get_by_role("button", name="Export backup").click()
    backup_path = OUT / "roundtrip-backup.json"
    backup_download.value.save_as(str(backup_path))
    pdf_page.get_by_role("button", name="Clear this workspace").click()
    pdf_page.get_by_role("button", name="Confirm clear all data").click()
    assert pdf_page.locator("#insurer").input_value() == ""
    assert not pdf_page.evaluate("Boolean(localStorage.getItem('denialfix.case.v1'))")
    pdf_page.set_input_files("#import-json", str(backup_path))
    expect(pdf_page.locator("#insurer")).to_have_value("Example Mutual (sample only)")
    results.append({"route": "buyer", "flow": "pdf-map-track-save-download-print-export-clear-import", "passed": True})
    pdf_page.close()

    for width in VIEWPORTS:
        page = browser.new_page(viewport={"width": width, "height": 900})
        errors = []
        page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"page:{exc}"))
        page.goto(f"{BASE}/d/denialfix-7f3c91e2/", wait_until="networkidle")
        page.get_by_role("button", name="Load sample claim").click()
        page.get_by_role("button", name="Build my claim map").click()
        page.get_by_role("heading", name="Your claim map").wait_for()
        assert page.get_by_text("Repeated or gradual water").count() == 1
        assert page.get_by_text("Candidate policy wording").count() >= 1
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not overflow, f"horizontal overflow at {width}px"
        skip_box = page.locator(".skip-link").evaluate("el => ({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})")
        assert skip_box["width"] <= 1 and skip_box["height"] <= 1, f"skip link leaked into the unfocused page at {width}px: {skip_box}"
        broken = page.evaluate("""Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).map(img => img.src)""")
        assert not broken, f"broken images at {width}px: {broken}"
        labels = page.locator("button, a.action").evaluate_all("""els => els.map(el => ({text:(el.textContent||'').trim(), h:el.getBoundingClientRect().height, sw:el.scrollWidth, cw:el.clientWidth})).filter(x => x.text)""")
        for control in labels:
            assert control["h"] >= 44, f"short control at {width}px: {control}"
            assert control["sw"] <= control["cw"] + 1, f"clipped control at {width}px: {control}"
        if width in (320, 768, 1280):
            page.screenshot(path=str(OUT / f"buyer-{width}.png"), full_page=True)
        assert not errors, f"browser errors at {width}px: {errors}"
        results.append({"route": "buyer", "width": width, "overflow": overflow, "errors": errors})
        page.close()

    for width in VIEWPORTS:
        page = browser.new_page(viewport={"width": width, "height": 900})
        errors = []
        page.on("console", lambda msg: errors.append(f"console:{msg.type}:{msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"page:{exc}"))
        page.goto(f"{BASE}/denialfix/", wait_until="networkidle")
        assert page.get_by_role("heading", name="Put the denial, policy and estimate on one map.").is_visible()
        assert page.get_by_role("button", name="Get DenialFix — $47").is_visible()
        assert page.locator('a[href*="denialfix-7f3c91e2"]').count() == 0
        assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        broken = page.evaluate("""Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).map(img => img.src)""")
        assert not broken, f"broken landing images at {width}px: {broken}"
        skip_box = page.locator(".skip-link").evaluate("el => ({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom})")
        assert skip_box["bottom"] <= 0, f"skip link leaked into the unfocused landing page at {width}px: {skip_box}"
        assert not errors, f"landing browser errors at {width}px: {errors}"
        if width in (320, 768, 1280):
            page.screenshot(path=str(OUT / f"landing-{width}.png"), full_page=True)
        results.append({"route": "landing", "width": width, "buyer_route_exposed": False, "errors": errors})
        page.close()

    page = browser.new_page(viewport={"width": 375, "height": 900})
    checkout_payloads = []

    def mock_checkout(route):
        checkout_payloads.append(route.request.post_data_json)
        route.fulfill(status=503, content_type="application/json", body='{"error":"safe QA stop"}')

    page.route("**/api/checkout-start", mock_checkout)
    page.goto(f"{BASE}/denialfix/?utm_source=qa&utm_medium=browser&utm_campaign=denialfix-live", wait_until="networkidle")
    page.locator("#checkout-email").fill("qa@example.test")
    page.get_by_role("button", name="Get DenialFix — $47").click()
    page.locator(".status[data-state='error']").wait_for()
    assert checkout_payloads == [{
        "email": "qa@example.test",
        "product": "denialfix",
        "utmSource": "qa",
        "utmMedium": "browser",
        "utmCampaign": "denialfix-live",
    }]
    results.append({"route": "landing-checkout", "width": 375, "checkout_payload_mocked": True})
    page.close()
    browser.close()

print(json.dumps({"ok": True, "checks": results, "screenshots": str(OUT)}, indent=2))
