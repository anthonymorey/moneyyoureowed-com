// Deposit Defender checkout — STEP 1. Modeled on the working /api/checkout-start
// (no _products import; hardcoded to the single DD product, $29). Creates a Stripe
// PaymentIntent in USD and returns client_secret + publishable key for the Payment Element.
// Secrets (Pages env, already set for this project): STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, MAILERLITE_TOKEN
// Client sends JSON: { "email": "...", "name": "..."(optional) }

const CURRENCY = "usd";
const DD_AMOUNT = 2900; // $29 one-time
const DD_NAME = "Deposit Defender — Security Deposit Dispute Builder";
const ML_DD_CHECKOUT = "189993107837683062"; // reuse MYO "checkout started" pool

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const email = (body.email || "").trim();
  const name = (body.name || "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422);
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) {
    return json({ error: "Payments not configured" }, 500);
  }

  // 1) MailerLite capture (best-effort — never blocks the sale).
  try {
    if (env.MAILERLITE_TOKEN) {
      await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
        body: JSON.stringify({ email, fields: name ? { name } : {}, groups: [ML_DD_CHECKOUT] }),
      });
    }
  } catch (_) { /* capture is a bonus; do not fail the checkout */ }

  // 2) Stripe HOSTED CHECKOUT SESSION (USD). Replaces the embedded Payment Element, whose
  //    client-side confirm was silently HANGING (0 charges for ~a week; see vault DD ad note
  //    2026-07-04). Hosted Checkout lets Stripe handle card/3DS/SCA/wallets/Link on its own
  //    trusted page — no embedded-confirm to hang. Card only (no phone; Amazon Pay/international
  //    excluded) via payment_method_types=card; Apple/Google Pay still surface on card in-page.
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[]", "card");
  form.set("line_items[0][price_data][currency]", CURRENCY);
  form.set("line_items[0][price_data][unit_amount]", String(DD_AMOUNT));
  form.set("line_items[0][price_data][product_data][name]", DD_NAME);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", email);
  form.set("success_url", origin + "/deposit-defender/app.html?session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", origin + "/deposit-defender/app.html?dd_cancelled=1");
  form.set("metadata[product]", "deposit-defender");
  form.set("metadata[email]", email);
  if (name) form.set("metadata[name]", name);
  form.set("payment_intent_data[metadata][product]", "deposit-defender");
  form.set("payment_intent_data[description]", DD_NAME);

  let session;
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    session = await r.json();
    if (!r.ok) {
      return json({ error: "Could not start checkout", detail: (session.error && session.error.message) || "" }, 502);
    }
  } catch (e) {
    return json({ error: "Could not start checkout", detail: String(e) }, 502);
  }

  return json({ url: session.url, sessionId: session.id, amount: DD_AMOUNT, productName: DD_NAME }, 200);
}

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}
