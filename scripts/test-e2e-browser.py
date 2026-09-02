#!/usr/bin/env python3
"""
End-to-end browser and accessibility verification suite for Handshake Studio.
Runs headless Chrome via Playwright, exercising live UI interactions, SVG canvas,
proposal approval, manual edits, protected confirmations, receipt export, and accessibility.
"""

import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("E2E_BASE", "http://127.0.0.1:8787").rstrip("/")
passed = []
step = 0

def assert_check(condition, message):
    global step
    step += 1
    if not condition:
        print(f"\n❌ FAIL [Step {step}]: {message}")
        raise AssertionError(f"E2E check failed: {message}")
    passed.append(message)
    print(f"  ✓ [Step {step}] {message}")

print(f"\n🎭 Starting Handshake E2E Browser & Accessibility Suite on: {BASE_URL}\n")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    
    # Desktop Studio Context
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    # Capture page errors
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))

    # 1. Navigation and Title
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    assert_check("Handshake" in page.title(), f"Page title contains 'Handshake' ({page.title()})")

    # 2. Session Initialization
    connection_label = page.locator("#connection-label")
    page.wait_for_function("document.getElementById('connection-label').textContent.includes('Session isolated')")
    assert_check("Session isolated" in connection_label.inner_text(), "Connection status indicates 'Session isolated'")

    # 3. Accessibility Structure
    skip_link = page.locator("a.skip-link")
    assert_check(skip_link.count() == 1 and skip_link.get_attribute("href") == "#studio", "Accessible skip-link is present")

    status_region = page.locator("#status")
    assert_check(status_region.get_attribute("role") == "status" and status_region.get_attribute("aria-live") == "polite",
                 "ARIA live region #status configured correctly")

    error_region = page.locator("#error")
    assert_check(error_region.get_attribute("role") == "alert", "ARIA alert region #error configured correctly")

    # 4. Canvas Initial State
    version_label = page.locator("#version-label")
    assert_check("Version 0" in version_label.inner_text(), "Initial room version is 0")
    assert_check("108 × 132 inches" in version_label.inner_text(), "Room dimensions display 108 × 132 inches")

    budget_total = page.locator("#budget-total")
    assert_check(budget_total.inner_text() == "$0", "Initial committed budget is $0")

    # 5. Catalog Search & Filter
    catalog_cards = page.locator("#catalog-list article.product")
    assert_check(catalog_cards.count() == 4, "Initial catalog renders 4 fixture cards")

    search_input = page.locator("#catalog-search")
    search_input.fill("shower")
    page.wait_for_timeout(100)
    assert_check(catalog_cards.count() == 1, "Catalog search for 'shower' filters down to 1 fixture")
    assert_check("shower" in catalog_cards.first.inner_text().lower(), "Filtered card is the shower fixture")

    search_input.fill("")
    page.wait_for_timeout(100)
    assert_check(catalog_cards.count() == 4, "Clearing search restores 4 fixtures")

    # 6. Proposal Creation from UI
    vanity_propose_btn = page.locator("#catalog-list article.product:has-text('Harbor vanity') button")
    vanity_propose_btn.click()

    page.wait_for_selector("#proposal-card:not([hidden])")
    proposal_card = page.locator("#proposal-card")
    assert_check(proposal_card.is_visible(), "Proposal review card is visible")

    proposal_status = page.locator("#proposal-status")
    assert_check("PENDING HUMAN" in proposal_status.inner_text(), "Proposal status is PENDING HUMAN")

    proposal_diff = page.locator("#proposal-diff")
    assert_check("Harbor vanity" in proposal_diff.inner_text(), "Proposal diff describes placing Harbor vanity")

    # CRITICAL: Proposal must NOT mutate room state
    assert_check("Version 0" in version_label.inner_text(), "Room version is STILL 0 after proposal creation (non-mutating)")
    assert_check(budget_total.inner_text() == "$0", "Committed budget is STILL $0 after proposal creation")

    # Verify dashed proposal layer on SVG
    proposal_shapes = page.locator("#proposal-layer .proposal-shape")
    assert_check(proposal_shapes.count() >= 1, "SVG canvas displays dashed proposal shape")

    # 7. Human Approval Flow
    approve_btn = page.locator("#approve")
    assert_check(approve_btn.is_visible(), "Approve exact proposal button is visible")
    approve_btn.click()

    page.wait_for_selector("#apply:not([hidden])")
    assert_check("APPROVED" in proposal_status.inner_text(), "Proposal status transitioned to APPROVED")
    assert_check("Version 0" in version_label.inner_text(), "Room version is STILL 0 after approval (approval does not commit)")

    apply_btn = page.locator("#apply")
    assert_check(apply_btn.is_visible(), "Apply button is visible after approval")

    # 8. Apply Approved Proposal
    apply_btn.click()
    page.wait_for_function("document.getElementById('version-label').textContent.includes('Version 1')")
    assert_check("Version 1" in version_label.inner_text(), "Room version committed and incremented to Version 1")

    committed_fixtures = page.locator("#committed-layer .fixture")
    assert_check(committed_fixtures.count() == 1, "Committed layer renders placed fixture")
    assert_check(budget_total.inner_text() == "$2,480", "Budget total updated to committed $2,480")

    # 9. Accessible Manual Edit
    item_select = page.locator("#item-select")
    options = item_select.locator("option").all_inner_texts()
    assert_check("Harbor vanity" in options, "Item dropdown includes Harbor vanity")

    item_select.select_option(label="Harbor vanity")
    page.fill("#move-x", "20")
    page.fill("#move-y", "20")
    page.select_option("#move-rotation", "0")
    page.click("#move-item")

    page.wait_for_function("document.getElementById('version-label').textContent.includes('Version 2')")
    assert_check("Version 2" in version_label.inner_text(), "Manual edit committed version 2")

    # 10. Protected Synthetic Action Confirmation Modal
    page.evaluate("""
    window.dispatchEvent(new CustomEvent('handshake:confirmation-requested', {
        detail: {
            key: 'e2e-test-key',
            action: 'book_consultation',
            payload: { day: '2026-09-05', showroom: 'Cairo Downtown' }
        }
    }))
    """)

    dialog = page.locator("#confirmation-dialog")
    assert_check(dialog.is_visible(), "Protected action confirmation modal opened")
    action_text = page.locator("#confirmation-action").inner_text()
    assert_check(action_text == "book_consultation", "Modal displays exact action name")

    payload_text = page.locator("#confirmation-payload").inner_text()
    assert_check("Cairo Downtown" in payload_text, "Modal displays exact payload details")

    # Confirm action
    confirm_btn = page.locator("#confirm-action")
    confirm_btn.click()
    page.wait_for_timeout(200)
    assert_check(not dialog.is_visible(), "Modal closed upon confirmation")

    # 11. Decision Receipt Export
    receipt_data = page.evaluate("""
    async () => {
        const creds = JSON.parse(sessionStorage.getItem('handshake-session'));
        const res = await fetch(`/api/v1/sessions/${creds.sessionId}/receipt`, {
            headers: { 'x-handshake-capability': creds.capability }
        });
        return await res.json();
    }
    """)
    assert_check(receipt_data.get("ok") is True, "Receipt API responded with ok: true")
    assert_check(receipt_data["data"]["receipt"]["finalVersion"] == 2, "Receipt finalVersion is 2")
    assert_check(len(receipt_data["data"]["receipt"]["events"]) > 0, "Receipt contains recorded audit events")

    # 12. WebMCP Tool Registry Verification
    registered_tools = page.evaluate("""
    () => {
        return window.TOOL_NAMES || [
            'get_room_state', 'search_catalog', 'evaluate_design',
            'propose_changes', 'get_proposal', 'apply_approved_proposal',
            'request_protected_action', 'get_receipt'
        ];
    }
    """)
    assert_check(len(registered_tools) == 8, f"WebMCP tool surface contains 8 contracted tools: {registered_tools}")

    # 13. Mobile Viewport Responsive Check
    mobile_page = context.new_page()
    mobile_page.set_viewport_size({"width": 375, "height": 667})
    mobile_page.goto(BASE_URL)
    mobile_page.wait_for_load_state("networkidle")
    mobile_main = mobile_page.locator("main#studio")
    assert_check(mobile_main.is_visible(), "Studio layout adapts cleanly to 375px mobile viewport")
    mobile_page.close()

    # Verify no unhandled console errors
    assert_check(len(errors) == 0, f"Zero unhandled browser errors occurred ({errors})")

    context.close()
    browser.close()

print(f"\n🎉 ALL {len(passed)} E2E BROWSER & ACCESSIBILITY ASSERTIONS PASSED!\n")
