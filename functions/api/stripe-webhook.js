// Cloudflare Pages Function — Stripe webhook = the RELIABLE delivery trigger.
// On payment_intent.succeeded: tag the buyer in MailerLite and email their download links
// via Resend. Delivers the whole bundle OR a single à-la-carte product per metadata.product.
// Secrets (Pages env): STRIPE_WEBHOOK_SECRET, MAILERLITE_TOKEN, RESEND_API_KEY
// Stripe webhook endpoint -> https://moneyyoureowed.com/api/stripe-webhook (event: payment_intent.succeeded)

import { PRODUCTS, FILES_BASE, MASTER_GUIDE, MASTER_DASH, OTHER_TRACKERS, GUIDE_FILES } from "./_products.js";

const FROM = "Money You're Owed <hello@moneyyoureowed.com>";

export async function onRequestPost(context) {
  const { request, env } = context;
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("not configured", { status: 500 });
  const ok = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("bad signature", { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return new Response("bad json", { status: 400 }); }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const md = pi.metadata || {};
    const email = md.email || pi.receipt_email;
    const name = md.name || "";
    const productKey = md.product || "bundle";
    const product = PRODUCTS[productKey] || PRODUCTS.bundle;
    const origin = new URL(request.url).origin;

    if (email) {
      // Tag in MailerLite (best-effort).
      try {
        if (env.MAILERLITE_TOKEN) {
          await fetch("https://connect.mailerlite.com/api/subscribers", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
            body: JSON.stringify({ email, fields: name ? { name } : {}, groups: [product.ml] }),
          });
        }
      } catch (_) {}

      // Deliver the files (best-effort).
      try {
        if (env.RESEND_API_KEY) {
          if (product.isBundle) {
            await sendEmail(env.RESEND_API_KEY, email, "Your Money You're Owed Recovery Kit — download links inside",
              bundleHtml(origin));
          } else {
            await sendEmail(env.RESEND_API_KEY, email, `Your ${product.name} — download links inside`,
              singleHtml(product, origin));
          }
        }
      } catch (_) {}
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10));
  if (Number.isNaN(age) || age > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(key, to, subject, html) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

function link(origin, [title, file]) {
  return `<p style="margin:10px 0"><a href="${origin}${FILES_BASE}/${file}" style="color:#1B6B5F;font-weight:700;text-decoration:none">⬇ ${title}</a></p>`;
}
function shell(inner) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a3a3a;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#1B6B5F;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed</div>
    <div style="border:1px solid #e3efec;border-top:none;border-radius:0 0 10px 10px;padding:24px">${inner}
      <p style="margin-top:18px"><strong>30-day money-back guarantee.</strong> If you don't find at least something worth more than what you paid, reply to this email and we'll refund you — no questions asked.</p>
      <p>Save everything somewhere safe — these links are yours to keep.</p>
      <p>— Money You're Owed</p>
    </div>
    <p style="color:#9aa9a6;font-size:12px;margin-top:16px">Educational content only — not financial or legal advice. You're receiving this because you purchased at moneyyoureowed.com.</p>
  </div>`;
}

// Founding-member review ask — the "in exchange for an honest review" half of the $59 deal.
// Reply-to-email on purpose: zero infrastructure, matches the existing refund-by-reply channel,
// and replies push our domain toward the Primary inbox (per Rishi 2026-06-14 deliverability note).
// Operator manually curates good replies into the homepage testimonials grid (first name only, real only).
function reviewAsk() {
  return `<div style="margin-top:22px;background:#fff7e6;border:1px solid #f0d9a8;border-radius:10px;padding:16px 18px">
      <p style="margin:0 0 6px;font-weight:700;color:#b5701a">🌱 You're a founding member — the one thing we ask in return</p>
      <p style="margin:0">You got the Kit at the founding price of <strong>$59</strong> (it's $79 once the first 50 spots are gone). In return, once you've used it and claimed something back, <strong>just hit reply and send us your honest review</strong> — what you recovered and what worked. A sentence or two is plenty. With your okay we may feature it on the site (first name only), and it genuinely helps us make the Kit better.</p>
    </div>`;
}

function bundleHtml(origin) {
  const otherTrackerRows = OTHER_TRACKERS.map((f) => link(origin, f)).join("");
  const guideRows = GUIDE_FILES.map((f) => link(origin, f)).join("");
  return shell(`
      <p>Thank you — your payment went through and your <strong>Complete Recovery Kit</strong> is ready.</p>
      <p style="margin-top:18px;font-weight:700;color:#1B6B5F">▶ Start here</p>
      <p style="margin:4px 0 8px">Read the quick-start, then open your <strong>Master Tracker dashboard</strong> — the hub that organises every claim the rest of the Kit generates.</p>
      ${link(origin, MASTER_GUIDE)}
      ${link(origin, MASTER_DASH)}
      <p style="margin-top:20px;font-weight:700;color:#1B6B5F">📊 Your other fillable trackers <span style="font-weight:400;color:#566">(open in Excel or upload to Google Sheets)</span></p>
      ${otherTrackerRows}
      <p style="margin-top:20px;font-weight:700;color:#1B6B5F">📄 Your guides, letters &amp; scripts (PDF)</p>
      ${guideRows}
      ${reviewAsk()}`);
}

function singleHtml(product, origin) {
  const rows = product.files.map((f) => link(origin, f)).join("");
  return shell(`
      <p>Thank you — your payment went through and your <strong>${product.name}</strong> is ready.</p>
      <p style="margin:10px 0 8px">Download below. Spreadsheets (.xlsx) open in Excel or upload straight to Google Sheets.</p>
      ${rows}
      <p style="margin-top:16px;color:#566">Want the rest? The full <strong>Complete Recovery Kit</strong> (all 6 tools) is <a href="${origin}/#offer" style="color:#1B6B5F;font-weight:700">$59 for founding members</a> — less than buying them separately.</p>
      <p style="margin-top:10px;color:#566">Used it and it helped? Just hit reply and tell us what you recovered — we'd genuinely love to hear it (and may feature it, first name only).</p>`);
}
