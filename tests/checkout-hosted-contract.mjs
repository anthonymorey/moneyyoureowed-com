import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../site.js", import.meta.url), "utf8");
const checkout = await readFile(new URL("../functions/api/checkout-start.js", import.meta.url), "utf8");
const webhook = await readFile(new URL("../functions/api/stripe-webhook.js", import.meta.url), "utf8");

assert.match(client, /fetch\(['"]\/api\/checkout-start['"]/,
  "homepage must call the hosted checkout Function");
assert.match(client, /window\.location\.(?:assign\(body\.url\)|href\s*=\s*body\.url)/,
  "homepage must redirect to the URL returned by Stripe Hosted Checkout");

for (const obsolete of [
  "https://js.stripe.com/v3/",
  "payment-element",
  "checkout-step2",
  "checkout-success",
  "co-pay",
  "co-back",
  "co-error2",
  "stripe.confirmPayment",
]) {
  assert.ok(!html.includes(obsolete), `obsolete embedded checkout code must be absent: ${obsolete}`);
}

assert.match(checkout, /api\.stripe\.com\/v1\/checkout\/sessions/,
  "server must create a Stripe Checkout Session");
assert.match(checkout, /return json\(\{ url: session\.url, sessionId: session\.id/,
  "server must return the hosted Checkout URL");
assert.ok(!checkout.includes("api.stripe.com/v1/payment_intents"),
  "server must not create the retired standalone PaymentIntent flow");
assert.ok(!checkout.includes("STRIPE_PUBLISHABLE_KEY"),
  "hosted checkout must not depend on an unused publishable key");
assert.ok(!checkout.includes("client_secret") && !checkout.includes("clientSecret"),
  "hosted checkout must not expose a Payment Element client secret");

assert.ok(checkout.includes('payment_intent_data[metadata][product]'),
  "Checkout Session must preserve product metadata on the PaymentIntent");
assert.match(webhook, /payment_intent\.succeeded/,
  "fulfilment webhook must still consume successful PaymentIntent events");
assert.match(webhook, /metadata(?:\?\.)?\.product|metadata\.product/,
  "fulfilment webhook must still select delivery from product metadata");

console.log(JSON.stringify({ ok: true, contract: "hosted-checkout-only" }));
