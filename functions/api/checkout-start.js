// Cloudflare Pages Function — hosted checkout for the bundle or an à-la-carte product.
//   1) Captures the buyer into MailerLite "Kit - Checkout Started" (abandoned-cart pool).
//   2) Creates a Stripe Checkout Session in USD and returns its hosted URL.
// Secrets (Pages env): STRIPE_SECRET_KEY, MAILERLITE_TOKEN
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid request body" }, 400);
  }
  for (const field of ["email", "name", "product", "attemptId", "utmSource", "utmMedium", "utmCampaign"]) {
    if (field in body && typeof body[field] !== "string") {
      return json({ error: `Invalid ${field}` }, 400);
    }
  }

  const email = (body.email || "").trim();
  const name = (body.name || "").trim();
  const productKey = (body.product || "bundle").trim();
  const attemptId = (body.attemptId || "").trim();
  const product = PRODUCTS[productKey];
  const tracking = {
    utm_source: cleanMetadata(body.utmSource),
    utm_medium: cleanMetadata(body.utmMedium),
    utm_campaign: cleanMetadata(body.utmCampaign),
  };

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422);
  }
  if (!product) return json({ error: "Unknown product" }, 422);
  if (productKey === "airbnb-damage-claim" && !/^[a-zA-Z0-9_-]{16,80}$/.test(attemptId)) {
    return json({ error: "Valid checkout attempt required" }, 422);
  }
  if (!env.STRIPE_SECRET_KEY) {
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

  // 2) Stripe HOSTED CHECKOUT SESSION (USD) for the chosen product. Replaces the embedded
  //    Payment Element (whose client-side confirm hung on DD — see vault DD ad note 2026-07-04).
  //    metadata.product is set on the PaymentIntent (payment_intent_data) so the existing
  //    payment_intent.succeeded webhook still delivers the files unchanged. Card + Link only (no
  //    phone, Amazon Pay or international clutter); Apple/Google Pay still surface on Stripe's page.
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[]", "card");
  form.append("payment_method_types[]", "link");
  form.set("line_items[0][price_data][currency]", CURRENCY);
  form.set("line_items[0][price_data][unit_amount]", String(product.price));
  form.set("line_items[0][price_data][product_data][name]", `Money You're Owed — ${product.name}`);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", email);
  const successPath = product.successPath || "/kit-thanks";
  const cancelPath = product.cancelPath || "/?checkout=cancelled";
  form.set("success_url", origin + successPath + "?session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", origin + cancelPath);
  form.set("metadata[product]", productKey);
  form.set("payment_intent_data[description]", `Money You're Owed — ${product.name}`);
  form.set("payment_intent_data[receipt_email]", email);
  form.set("payment_intent_data[metadata][product]", productKey);
  form.set("payment_intent_data[metadata][email]", email);
  if (name) form.set("payment_intent_data[metadata][name]", name);
  for (const [key, value] of Object.entries(tracking)) {
    if (!value) continue;
    form.set(`metadata[${key}]`, value);
    form.set(`payment_intent_data[metadata][${key}]`, value);
  }

  const stripeHeaders = { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" };
  if (productKey === "airbnb-damage-claim") {
    stripeHeaders["Idempotency-Key"] = `${productKey}:${attemptId}`;
  }
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: stripeHeaders,
    body: form.toString(),
  });
  const session = await r.json();
  if (!r.ok) {
    return json({ error: "Could not start checkout", detail: (session.error && session.error.message) || "" }, 502);
  }

  return json({ url: session.url, sessionId: session.id, amount: product.price, productName: product.name }, 200);
}

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function cleanMetadata(value) {
  return String(value || "").replace(/[^a-zA-Z0-9._~:/-]/g, "_").slice(0, 120);
}
