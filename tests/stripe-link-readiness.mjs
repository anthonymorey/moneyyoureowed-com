import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkout = await readFile(
  new URL("../functions/api/checkout-start.js", import.meta.url),
  "utf8",
);
const client = await readFile(
  new URL("../glp1-checkout.js", import.meta.url),
  "utf8",
);
const mobileObserver = await readFile(
  new URL("./stripe-link-mobile.py", import.meta.url),
  "utf8",
);

const checks = {
  createsCheckoutSession: /fetch\(["']https:\/\/api\.stripe\.com\/v1\/checkout\/sessions["']/.test(checkout),
  paymentMode: /form\.set\(["']mode["'],\s*["']payment["']\)/.test(checkout),
  prefilledCustomerEmail: /form\.set\(["']customer_email["'],\s*email\)/.test(checkout),
  returnsHostedUrl: /return json\(\{\s*url:\s*session\.url\b/.test(checkout),
  clientRequiresReturnedUrl: /!response\.ok\s*\|\|\s*!result\.url/.test(client),
  clientNavigatesToReturnedUrl: /window\.location\.assign\(result\.url\)/.test(client),
};

for (const [name, passed] of Object.entries(checks)) {
  assert.ok(passed, `Stripe Link readiness prerequisite failed: ${name}`);
}

// The URL originates from Stripe's HTTPS API response and is passed through rather
// than assembled locally. Runtime host/scheme validation belongs in production code.
assert.match(checkout, /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/);
assert.match(mobileObserver, /"ok": not safety_failed and not checkout_broken and link_observed/,
  "mobile observer must not claim success unless Link is visibly offered");
assert.match(mobileObserver, /if not link_observed:[\s\S]*return 4/,
  "Link-not-observed must be a distinct inconclusive failure");

for (const retired of [
  "https://js.stripe.com/v3/",
  "payment-element",
  "stripe.confirmPayment",
  "client_secret",
  "clientSecret",
  "api.stripe.com/v1/payment_intents",
]) {
  assert.ok(
    !checkout.includes(retired) && !client.includes(retired),
    `retired embedded Payment Element signal must be absent: ${retired}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "stripe-link-hosted-checkout-readiness",
  checks,
  note: "Link display remains controlled by Stripe eligibility and requires live read-only observation",
}));
