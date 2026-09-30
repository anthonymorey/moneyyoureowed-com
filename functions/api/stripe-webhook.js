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
    // Instant sale alert to the owner (hello@ forwards to the owner's inbox). Skipped for e2e tests.
    if (env.RESEND_API_KEY && !md.e2e_test) {
      const amt = `$${((pi.amount_received || pi.amount || 0) / 100).toFixed(2)}`;
      await sendEmail(env.RESEND_API_KEY, "hello@moneyyoureowed.com", `💰 New sale: ${amt} — ${productKey}`,
        `<p><strong>${amt}</strong> — product <strong>${productKey}</strong></p><p>Buyer: ${String(email || "(no email)").replace(/</g, "&lt;")}</p>` +
        `<p>Delivery email is being sent automatically. If you don't get a "[PAID ORDER EMAIL NOT DELIVERED]" alert, it went out.</p>`,
        true).catch(() => {});
    }
    const origin = new URL(request.url).origin;

    // Deposit Defender ($29 vertical) is NOT a MYO Kit product. It must get its OWN
    // confirmation and must NEVER fall through to the Complete Recovery Kit email
    // (that mis-delivery is exactly the bug this guard fixes). The letter itself is
    // unlocked client-side at /deposit-defender/app after the Stripe redirect; this
    // email is the receipt + a link back to it.
    if (productKey === "deposit-defender") {
      if (email && env.RESEND_API_KEY) {
        try {
          await sendEmail(env.RESEND_API_KEY, email, "Deposit Defender — payment confirmed, your letter builder is unlocked",
            ddHtml(origin));
        } catch (_) {}
      }
      return new Response(JSON.stringify({ received: true, product: "deposit-defender" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Claims verticals ($29 fill-on-the-fly letter/packet apps on their own Pages projects).
    // Same SHARED Stripe account => this same webhook fires for them. They must get their OWN
    // receipt and must NEVER fall through to the MYO Recovery Kit bundle email (the shared-webhook
    // mis-delivery bug). The deliverable unlocks client-side at <project>/app after the redirect.
    const CLAIMS = {
      "flight-refund-claim": { name: "Flight Refund Recovery", app: "https://flight-refund-recovery.pages.dev/app", note: "moneyyoureowed.com/flight-refund" },
      "airbnb-claim":        { name: "HostProof",              app: "https://hostproof.pages.dev/app",              note: "moneyyoureowed.com/hostproof" },
    };
    if (CLAIMS[productKey]) {
      const c = CLAIMS[productKey];
      if (email && env.RESEND_API_KEY) {
        try {
          await sendEmail(env.RESEND_API_KEY, email, `${c.name} — payment confirmed, your claim builder is unlocked`, claimHtml(c));
        } catch (_) {}
      }
      return new Response(JSON.stringify({ received: true, product: productKey }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Wedding Command Center ($37 DCE vertical on wedding-command-center.pages.dev, same shared
    // Stripe account). Payment-link metadata stamps product=wedding-command-center (set 2026-07-05).
    // Delivery = the thank-you page after redirect; this email is the backup copy of the download.
    if (productKey === "wedding-command-center") {
      if (email && env.RESEND_API_KEY) {
        try {
          await sendEmail(env.RESEND_API_KEY, email, "Your Wedding Command Center is ready 💍", weddingHtml());
        } catch (_) {}
      }
      return new Response(JSON.stringify({ received: true, product: "wedding-command-center" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const product = PRODUCTS[productKey] || PRODUCTS.bundle;

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
          if (product.delivery === "glp1-appeal") {
            await sendEmail(env.RESEND_API_KEY, email, "Your GLP-1 Appeal Kit is ready",
              glp1AppealHtml(origin));
          } else if (product.delivery === "denialfix") {
            await sendEmail(env.RESEND_API_KEY, email, "Your DenialFix claim workspace is ready",
              denialfixHtml(origin));
          } else if (product.delivery === "airbnb-damage-claim") {
            await sendEmail(env.RESEND_API_KEY, email, "Your Airbnb Damage Claim Builder workspace is ready",
              airbnbDamageHtml(origin));
          } else if (product.isBundle) {
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

// Retries transient Resend failures; a paying customer's delivery email must never be silently lost.
// On final failure it alerts hello@ with the buyer's address so the order can be fulfilled by hand.
async function sendEmail(key, to, subject, html, isAlert) {
  const body = JSON.stringify({ from: FROM, to, subject, html });
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 600 * attempt));
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
      });
      if (r.ok) return true;
      last = `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
    } catch (e) { last = String(e).slice(0, 200); }
  }
  if (!isAlert) {
    await sendEmail(key, "hello@moneyyoureowed.com", `[PAID ORDER EMAIL NOT DELIVERED] ${to}`,
      `<p>A buyer paid but their delivery email "${subject.replace(/</g, "&lt;")}" failed after 3 tries.</p><p>Buyer: ${String(to).replace(/</g, "&lt;")}</p><p>${last.replace(/</g, "&lt;")}</p><p>Send their downloads by hand today.</p>`,
      true).catch(() => {});
  }
  return false;
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

// Deposit Defender confirmation — its own navy/gold identity (a MYO vertical, not the Kit).
function ddHtml(origin) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2942;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#1a2942;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Deposit Defender</div>
    <div style="border:1px solid #e3e7ee;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through. Your <strong>Deposit Defender</strong> demand-letter builder is unlocked.</p>
      <p style="margin-top:14px"><a href="${origin}/deposit-defender/app" style="display:inline-block;background:#d4a843;color:#1a2942;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">▶ Open your letter builder</a></p>
      <p style="margin-top:14px">Enter your landlord's deductions and the app applies your state's legal tests (fair wear &amp; tear, betterment, lifespan tables), then generates a demand letter citing your state's security-deposit statute — ready to sign and send.</p>
      <p style="margin-top:16px"><strong>30-day money-back guarantee.</strong> If it doesn't help you fight your deduction, reply to this email and we'll refund you — no questions asked.</p>
      <p style="margin-top:10px">Save this email — your access link is yours to keep.</p>
      <p>— Deposit Defender, by Money You're Owed</p>
    </div>
    <p style="color:#9aa9a6;font-size:12px;margin-top:16px">Educational content only — not legal advice. You're receiving this because you purchased at moneyyoureowed.com/deposit-defender.</p>
  </div>`;
}

// Claims-vertical confirmation (Flight Refund Recovery / HostProof). Receipt + link back to the
// builder, which is unlocked client-side after the Stripe redirect. Not legal advice.
function claimHtml(c) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#13283d;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#0a2138;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">${c.name}</div>
    <div style="border:1px solid #e3e9ef;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through. Your <strong>${c.name}</strong> claim builder is unlocked.</p>
      <p style="margin-top:14px"><a href="${c.app}" style="display:inline-block;background:#0e8f8a;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">▶ Open your claim builder</a></p>
      <p style="margin-top:14px">Answer a few questions about what happened and the app assembles a ready-to-send claim letter with the matching US&nbsp;DOT rule cited, plus a step-by-step guide on where to send it. You send it yourself and keep 100% of anything you recover.</p>
      <p style="margin-top:16px"><strong>Money-back guarantee.</strong> If the tool can't build a claim that fits your situation, reply to this email within 30 days and we'll refund your $29 in full.</p>
      <p style="margin-top:10px">Save this email — your access link is yours to keep.</p>
      <p>— ${c.name}, by Money You're Owed</p>
    </div>
    <p style="color:#90a8c2;font-size:12px;margin-top:16px">Self-help document tool, not a law firm — not legal advice. You're receiving this because you purchased at ${c.note}.</p>
  </div>`;
}

function weddingHtml() {
  const dl = "https://wedding-command-center.pages.dev/d/wcc-5dfbd1bdf5/Wedding-Command-Center.xlsx";
  const ty = "https://wedding-command-center.pages.dev/thank-you";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c2430;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#93435d;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">The All-in-One Wedding Command Center</div>
    <div style="border:1px solid #eadfd6;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through. Your Wedding Command Center is ready. 💍</p>
      <p style="margin-top:14px"><a href="${dl}" style="display:inline-block;background:#93435d;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">⬇ Download the Command Center (.xlsx)</a></p>
      <p style="margin-top:14px">It opens straight in <strong>Excel</strong>, or upload it to <strong>Google Sheets</strong> in about 30 seconds — <a href="${ty}" style="color:#93435d">your download page</a> shows exactly how, and you can re-download there any time.</p>
      <p style="margin-top:16px"><strong>30-day money-back guarantee.</strong> If it doesn't make your planning simpler and calmer, reply to this email within 30 days for a full refund — and keep the templates.</p>
      <p>— The Wedding Command Center team</p>
    </div>
    <p style="color:#a598ab;font-size:12px;margin-top:16px">Digital template product. Your card statement shows MONEYOWED* WEDDING. Questions: just reply to this email.</p>
  </div>`;
}

function glp1AppealHtml(origin) {
  const kit = `${origin}/d/glp1-b06d903585/`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#152522;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#173f3a;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed — GLP-1 Appeal Kit</div>
    <div style="border:1px solid #d8e1dc;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through and your <strong>GLP-1 Appeal Kit</strong> is ready.</p>
      <p style="margin-top:14px"><a href="${kit}" style="display:inline-block;background:#d6f06b;color:#0f2d29;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">Open the GLP-1 Appeal Kit</a></p>
      <p style="margin-top:14px">Start with the decision map. It routes you to the letter, evidence checklist, and appeal path that match the reason on your denial notice.</p>
      <p style="margin-top:16px"><strong>30-day money-back guarantee.</strong> If the kit does not give you a clear next step for your denial, reply within 30 days for a full refund — no questions asked.</p>
      <p>Save this email so you can return to the kit.</p>
      <p>— Money You're Owed</p>
    </div>
    <p style="color:#73827e;font-size:12px;margin-top:16px">Educational information only — not medical, legal, or insurance advice.</p>
  </div>`;
}

function denialfixHtml(origin) {
  const workspace = `${origin}/d/denialfix-7f3c91e2/`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#152522;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#173f3a;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed — DenialFix</div>
    <div style="border:1px solid #d8e1dc;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through and your <strong>DenialFix claim workspace</strong> is ready.</p>
      <p style="margin-top:14px"><a href="${workspace}" style="display:inline-block;background:#d6f06b;color:#0f2d29;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">Open DenialFix</a></p>
      <p style="margin-top:14px">Start with the fictional sample, then add your denial, relevant policy wording, and estimate. Document text is processed in your browser and is not uploaded to Money You're Owed or an AI service.</p>
      <p style="margin-top:16px"><strong>30-day money-back guarantee.</strong> Reply within 30 days for a full refund. The refund does not depend on your insurer's decision.</p>
      <p>Save this email so you can return to the workspace.</p>
      <p>— Money You're Owed</p>
    </div>
    <p style="color:#73827e;font-size:12px;margin-top:16px">Self-help organization software only — not legal advice, claim representation, a coverage decision, or a payment guarantee.</p>
  </div>`;
}

function airbnbDamageHtml(origin) {
  const workspace = `${origin}/d/adc-58b41e6f/`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#152522;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#173f3a;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed — Airbnb Damage Claim Builder</div>
    <div style="border:1px solid #d8e1dc;border-top:none;border-radius:0 0 10px 10px;padding:24px">
      <p>Thank you — your payment went through and your <strong>private evidence workspace</strong> is ready.</p>
      <p style="margin-top:14px"><a href="${workspace}" style="display:inline-block;background:#d6f06b;color:#0f2d29;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">Open the evidence workspace</a></p>
      <p style="margin-top:14px">Record incident facts, loss items, evidence labels, timeline events and correspondence locally in your browser. Your original files remain in your own storage.</p>
      <p style="margin-top:16px"><strong>30-day money-back guarantee.</strong> Reply within 30 days for a full refund. The refund does not depend on Airbnb's decision.</p>
      <p>Save this email so you can return to the workspace.</p>
      <p>— Money You're Owed</p>
    </div>
    <p style="color:#73827e;font-size:12px;margin-top:16px">Independent self-help software; not affiliated with Airbnb. Not legal advice, claims representation, eligibility, valuation or a guarantee.</p>
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
