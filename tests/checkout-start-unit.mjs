import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/checkout-start.js";

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify({
    id: "cs_test_contract",
    url: "https://checkout.stripe.com/c/pay/cs_test_contract",
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const request = new Request("https://moneyyoureowed.com/api/checkout-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@example.test", name: "Buyer", product: "bundle" }),
  });
  const response = await onRequestPost({ request, env: { STRIPE_SECRET_KEY: "sk_test_contract" } });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    url: "https://checkout.stripe.com/c/pay/cs_test_contract",
    sessionId: "cs_test_contract",
    amount: 5900,
    productName: "Complete Recovery Kit",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions");

  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("mode"), "payment");
  assert.deepEqual(form.getAll("payment_method_types[]"), ["card", "link"],
    "hosted Checkout must offer Stripe Link while preserving card checkout");
  assert.equal(form.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "5900");
  assert.equal(form.get("customer_email"), "buyer@example.test");
  assert.equal(form.get("success_url"), "https://moneyyoureowed.com/kit-thanks?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(form.get("cancel_url"), "https://moneyyoureowed.com/?checkout=cancelled");
  assert.equal(form.get("metadata[product]"), "bundle");
  assert.equal(form.get("payment_intent_data[metadata][product]"), "bundle");
  assert.equal(form.get("payment_intent_data[metadata][email]"), "buyer@example.test");
  assert.equal(form.get("payment_intent_data[metadata][name]"), "Buyer");

  const missingSecret = await onRequestPost({
    request: new Request("https://moneyyoureowed.com/api/checkout-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@example.test", product: "bundle" }),
    }),
    env: {},
  });
  assert.equal(missingSecret.status, 500);
  assert.equal(calls.length, 1, "missing secret must fail before any external request");

  for (const malformedBody of [null, { email: 123, product: "bundle" }]) {
    const malformed = await onRequestPost({
      request: new Request("https://moneyyoureowed.com/api/checkout-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(malformedBody),
      }),
      env: { STRIPE_SECRET_KEY: "«redacted:sk_test_…»" },
    });
    assert.equal(malformed.status, 400, "valid JSON with the wrong shape must fail closed");
  }

  console.log(JSON.stringify({ ok: true, stripeCalls: calls.length, bundleAmount: 5900 }));
} finally {
  globalThis.fetch = originalFetch;
}
