import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { onRequestPost } from "../functions/api/stripe-webhook.js";

const secret = "whsec_test_airbnb_damage_contract";
const payload = JSON.stringify({
  id: "evt_test_airbnb_damage",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_test_airbnb_damage",
      receipt_email: "buyer@example.test",
      metadata: { product: "airbnb-damage-claim", email: "buyer@example.test" },
    },
  },
});
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  return new Response(JSON.stringify({ id: "email_test_airbnb_damage" }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  const response = await onRequestPost({
    request: new Request("https://moneyyoureowed.com/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}`, "Content-Type": "application/json" },
      body: payload,
    }),
    env: { STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: "re_test_contract" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  const email = JSON.parse(calls[0].options.body);
  assert.equal(email.to, "buyer@example.test");
  assert.equal(email.subject, "Your Airbnb Damage Claim Builder workspace is ready");
  assert.match(email.html, /\/d\/adc-58b41e6f\//);
  assert.match(email.html, /not affiliated with Airbnb/i);
  assert.doesNotMatch(email.html, /claim letter|reimbursement promise|guaranteed/i);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ ok: true, event: "payment_intent.succeeded", delivery: "airbnb-damage-claim", mockedExternalCalls: calls.length }));
