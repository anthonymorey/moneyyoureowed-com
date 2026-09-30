import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestPost } from "../functions/api/checkout-start.js";
import { onRequestGet as verifyAirbnbDamage } from "../functions/api/airbnb-damage-entitlement.js";

const products = await readFile(new URL("../functions/api/_products.js", import.meta.url), "utf8");
const webhook = await readFile(new URL("../functions/api/stripe-webhook.js", import.meta.url), "utf8");
const landing = await readFile(new URL("../airbnb-damage-claim/index.html", import.meta.url), "utf8");
const landingScript = await readFile(new URL("../airbnb-damage-claim/landing.mjs", import.meta.url), "utf8");
const thankYou = await readFile(new URL("../airbnb-damage-claim/thank-you.html", import.meta.url), "utf8");
const thankYouScript = await readFile(new URL("../airbnb-damage-claim/thank-you.mjs", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

assert.match(products, /"airbnb-damage-claim"\s*:\s*\{/);
assert.match(products, /name:\s*"Airbnb Damage Claim Builder"/);
assert.match(products, /price:\s*4700/);
assert.match(products, /successPath:\s*"\/airbnb-damage-claim\/thank-you"/);
assert.match(products, /cancelPath:\s*"\/airbnb-damage-claim\/?\?checkout=cancelled"/);
assert.match(webhook, /product\.delivery\s*===\s*"airbnb-damage-claim"/);
assert.match(landingScript, /product:\s*"airbnb-damage-claim"/);
assert.match(landingScript, /attemptId/);
assert.match(landing, /\$47/);
assert.match(landing, /not affiliated with Airbnb/i);
assert.match(thankYouScript, /airbnb-damage-entitlement/);
assert.match(thankYou, /Stripe session/i);
assert.ok(sitemap.includes("/airbnb-damage-claim/"));
assert.ok(!sitemap.includes("adc-58b41e6f"), "private buyer route must not be in sitemap");
assert.ok(!landing.includes("adc-58b41e6f"), "public landing must not expose buyer route");

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify({ id: "cs_test_airbnb_damage", url: "https://checkout.stripe.com/c/pay/cs_test_airbnb_damage" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
try {
  const response = await onRequestPost({
    request: new Request("https://moneyyoureowed.com/api/checkout-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@example.test", product: "airbnb-damage-claim", attemptId: "adc_test_attempt_20260726", utmSource: "youtube", utmCampaign: "airbnb_damage_launch" }),
    }),
    env: { STRIPE_SECRET_KEY: "«redacted:sk_test_…»" },
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.amount, 4700);
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "4700");
  assert.equal(form.get("success_url"), "https://moneyyoureowed.com/airbnb-damage-claim/thank-you?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(form.get("cancel_url"), "https://moneyyoureowed.com/airbnb-damage-claim/?checkout=cancelled");
  assert.equal(form.get("metadata[product]"), "airbnb-damage-claim");
  assert.equal(form.get("payment_intent_data[metadata][product]"), "airbnb-damage-claim");
  assert.equal(calls[0].options.headers["Idempotency-Key"], "airbnb-damage-claim:adc_test_attempt_20260726");
} finally {
  globalThis.fetch = originalFetch;
}

let sessionProduct = "airbnb-damage-claim";
globalThis.fetch = async () => new Response(JSON.stringify({
  id: "cs_test_airbnb_damage",
  payment_status: "paid",
  status: "complete",
  metadata: { product: sessionProduct },
}), { status: 200, headers: { "Content-Type": "application/json" } });
try {
  const entitledResponse = await verifyAirbnbDamage({
    request: new Request("https://moneyyoureowed.com/api/airbnb-damage-entitlement?session_id=cs_test_airbnb_damage"),
    env: { STRIPE_SECRET_KEY: "«redacted:sk_test_…»" },
  });
  assert.equal(entitledResponse.status, 200);
  assert.deepEqual(await entitledResponse.json(), { entitled: true, downloadUrl: "/d/adc-58b41e6f/" });
  sessionProduct = "denialfix";
  const wrongProductResponse = await verifyAirbnbDamage({
    request: new Request("https://moneyyoureowed.com/api/airbnb-damage-entitlement?session_id=cs_test_wrong"),
    env: { STRIPE_SECRET_KEY: "«redacted:sk_test_…»" },
  });
  assert.equal(wrongProductResponse.status, 403);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ ok: true, product: "airbnb-damage-claim", amount: 4700, checkoutCalls: calls.length }));
