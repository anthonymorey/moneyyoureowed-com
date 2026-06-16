// Cloudflare Pages Function — STEP 1 of checkout (bundle OR single à-la-carte product).
//   1) Captures the buyer into MailerLite "Kit - Checkout Started" (abandoned-cart pool).
//   2) Creates a Stripe PaymentIntent in USD for the chosen product and returns its
//      client_secret + publishable key so the client can mount the Payment Element.
// Secrets (Pages env): STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, MAILERLITE_TOKEN
// Client sends JSON: { "email": "...", "name": "...", "product": "bundle"|"medical"|... }

import { PRODUCTS, ML_CHECKOUT_STARTED } from "./_products.js";

const CURRENCY = "usd";
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
  const productKey = (body.product || "bundle").trim();
  const product = PRODUCTS[productKey];

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422);
  }
  if (!product) return json({ error: "Unknown product" }, 422);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) {
    return json({ error: "Payments not configured" }, 500);
  }

  // 1) MailerLite capture (best-effort — never blocks the sale).
  try {
    if (env.MAILERLITE_TOKEN) {
      await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
        body: JSON.stringify({ email, fields: name ? { name } : {}, groups: [ML_CHECKOUT_STARTED] }),
      });
    }
  } catch (_) { /* capture is a bonus; do not fail the checkout */ }

  // 2) Stripe PaymentIntent (USD) for the chosen product. Server price is authoritative.
  const form = new URLSearchParams();
  form.set("amount", String(product.price));
  form.set("currency", CURRENCY);
  form.set("automatic_payment_methods[enabled]", "true");
  form.set("description", `Money You're Owed — ${product.name}`);
  form.set("receipt_email", email);
  form.set("metadata[product]", productKey);
  form.set("metadata[email]", email);
  if (name) form.set("metadata[name]", name);

  const r = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const pi = await r.json();
  if (!r.ok) {
    return json({ error: "Could not start checkout", detail: (pi.error && pi.error.message) || "" }, 502);
  }

  return json({
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    amount: product.price,
    productName: product.name,
  }, 200);
}

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}
