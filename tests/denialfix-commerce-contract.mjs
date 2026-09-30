import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestPost } from "../functions/api/checkout-start.js";
import { onRequestGet as verifyDenialFix } from "../functions/api/denialfix-entitlement.js";

const products = await readFile(new URL("../functions/api/_products.js", import.meta.url), "utf8");
const checkout = await readFile(new URL("../functions/api/checkout-start.js", import.meta.url), "utf8");
const webhook = await readFile(new URL("../functions/api/stripe-webhook.js", import.meta.url), "utf8");
const entitlement = await readFile(new URL("../functions/api/denialfix-entitlement.js", import.meta.url), "utf8");
const landing = await readFile(new URL("../denialfix/index.html", import.meta.url), "utf8");
const landingScript = await readFile(new URL("../denialfix/landing.mjs", import.meta.url), "utf8");
const thankYou = await readFile(new URL("../denialfix/thank-you.html", import.meta.url), "utf8");
const thankYouScript = await readFile(new URL("../denialfix/thank-you.mjs", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

assert.match(products, /\bdenialfix\s*:\s*\{/);
assert.match(products, /price:\s*4700/);
assert.match(products, /successPath:\s*"\/denialfix\/thank-you"/);
assert.match(products, /cancelPath:\s*"\/denialfix\/?\?checkout=cancelled"/);
assert.match(checkout, /payment_intent_data\[metadata\]\[product\]/);
assert.match(webhook, /product\.delivery\s*===\s*"denialfix"/);
assert.match(entitlement, /payment_status\s*===\s*"paid"/);
assert.match(entitlement, /status\s*===\s*"complete"/);
assert.match(entitlement, /metadata\?\.product\s*===\s*"denialfix"/);
assert.match(entitlement, /\/d\/denialfix-7f3c91e2\//);
assert.match(landingScript, /product:\s*"denialfix"/);
assert.match(landing, /\$47/);
assert.match(thankYouScript, /denialfix-entitlement/);
assert.ok(!sitemap.includes("denialfix-7f3c91e2"), "private buyer route must not be in the sitemap");
assert.ok(!landing.includes("denialfix-7f3c91e2"), "public landing page must not expose the buyer route");

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify({ id: "cs_test_denialfix", url: "https://checkout.stripe.com/c/pay/cs_test_denialfix" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  const response = await onRequestPost({
    request: new Request("https://moneyyoureowed.com/api/checkout-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@example.test", product: "denialfix", utmSource: "youtube organic", utmCampaign: "denialfix_launch" }),
    }),
    env: { STRIPE_SECRET_KEY: "sk_test_contract" },
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.amount, 4700);
  assert.equal(calls.length, 1);
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "4700");
  assert.equal(form.get("success_url"), "https://moneyyoureowed.com/denialfix/thank-you?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(form.get("cancel_url"), "https://moneyyoureowed.com/denialfix/?checkout=cancelled");
  assert.equal(form.get("metadata[product]"), "denialfix");
  assert.equal(form.get("payment_intent_data[metadata][product]"), "denialfix");
  assert.equal(form.get("metadata[utm_source]"), "youtube_organic");
  assert.equal(form.get("payment_intent_data[metadata][utm_campaign]"), "denialfix_launch");
} finally {
  globalThis.fetch = originalFetch;
}

let sessionProduct = "denialfix";
globalThis.fetch = async () => new Response(JSON.stringify({
  id: "cs_test_denialfix",
  payment_status: "paid",
  status: "complete",
  metadata: { product: sessionProduct },
}), { status: 200, headers: { "Content-Type": "application/json" } });
try {
  const entitledResponse = await verifyDenialFix({
    request: new Request("https://moneyyoureowed.com/api/denialfix-entitlement?session_id=cs_test_denialfix"),
    env: { STRIPE_SECRET_KEY: "sk_test_contract" },
  });
  assert.equal(entitledResponse.status, 200);
  assert.deepEqual(await entitledResponse.json(), { entitled: true, downloadUrl: "/d/denialfix-7f3c91e2/" });
  sessionProduct = "glp1-appeal";
  const wrongProductResponse = await verifyDenialFix({
    request: new Request("https://moneyyoureowed.com/api/denialfix-entitlement?session_id=cs_test_other"),
    env: { STRIPE_SECRET_KEY: "sk_test_contract" },
  });
  assert.equal(wrongProductResponse.status, 403);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ ok: true, product: "denialfix", amount: 4700, stripeCalls: calls.length, entitlement: "verified" }));
