// Cloudflare Pages Function — server-side opt-in handler.
//   1) Adds the subscriber to the right MailerLite group (token = MAILERLITE_TOKEN secret).
//   2) Fully-automatic delivery email via Resend (RESEND_API_KEY secret) — the doc link + the offer.
//      Zero dashboard: a new magnet = one line in MAGNETS below, nothing else.
// Secrets:
//   npx wrangler pages secret put MAILERLITE_TOKEN --project-name=myo-landing-pages
//   npx wrangler pages secret put RESEND_API_KEY  --project-name=myo-landing-pages
// Client sends JSON: { "email": "...", "name": "...", "group": "<group_id>" }

const FROM = "Money You're Owed <hello@moneyyoureowed.com>";
const OFFER_URL = "https://moneyyoureowed.com/#offer";

// group_id -> the lead magnet it delivers. Add a new magnet here = it's automatically wired. waitlist has no doc.
const MAGNETS = {
  "189379076374398313": { title: "50-State Unclaimed Money Checklist", file: "/downloads/50-State-Unclaimed-Money-Checklist.pdf" },
  "189606595562309447": { title: "Airline Refund Cheat-Sheet",        file: "/downloads/Airline-Refund-Cheat-Sheet.pdf" },
  "189909462722544704": { title: "11-Way Money Checklist",            file: "/downloads/11-Way-Money-Checklist.pdf" },
  "189909462863054164": { title: "EITC Eligibility Checklist",        file: "/downloads/EITC-Eligibility-Checklist.pdf" },
  "189966496569492517": { waitlist: true },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }

  const email = (body.email || "").trim();
  const name = (body.name || "").trim();
  const group = (body.group || "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422, cors);
  }
  if (!env.MAILERLITE_TOKEN) return json({ error: "Server not configured" }, 500, cors);

  // 1) MailerLite (capture is the critical path)
  const payload = { email, fields: name ? { name } : {} };
  if (group) payload.groups = [group];
  const ml = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
    body: JSON.stringify(payload),
  });
  if (!ml.ok) {
    const text = await ml.text();
    return json({ error: "Subscribe failed", detail: text.slice(0, 300) }, 502, cors);
  }

  // 2) Delivery email via Resend (non-blocking: never fails the capture). Skips silently until RESEND_API_KEY is set.
  try {
    const m = MAGNETS[group];
    if (env.RESEND_API_KEY && m && !m.waitlist) {
      const origin = new URL(request.url).origin; // https://moneyyoureowed.com
      await sendEmail(env.RESEND_API_KEY, email, `Here's your free ${m.title}`, magnetHtml(m.title, origin + m.file));
    } else if (env.RESEND_API_KEY && m && m.waitlist) {
      await sendEmail(env.RESEND_API_KEY, email, "You're on the Recovery Kit waitlist", waitlistHtml());
    }
  } catch (_) { /* email is a bonus; capture already succeeded */ }

  return json({ ok: true }, 200, cors);
}

async function sendEmail(key, to, subject, html) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

function shell(inner) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a3a3a;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#1B6B5F;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed</div>
    <div style="border:1px solid #e3efec;border-top:none;border-radius:0 0 10px 10px;padding:24px">${inner}</div>
    <p style="color:#9aa9a6;font-size:12px;margin-top:16px">You're getting this because you grabbed a free resource at moneyyoureowed.com. Educational content only — not financial or legal advice.</p>
  </div>`;
}
function btn(href, label) {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#1B6B5F;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;display:inline-block">${label}</a></p>`;
}
function magnetHtml(title, fileUrl) {
  return shell(`<p>Hi,</p>
    <p>Here's your free <strong>${title}</strong> — thanks for grabbing it.</p>
    ${btn(fileUrl, "⬇ Download your PDF")}
    <p>That's the <em>map</em> — what you're owed and where to look. When you'd rather have it <strong>done for you</strong> — the exact fill-in letters, word-for-word phone scripts, and a tracker across every category — that's the Complete Recovery Kit.</p>
    ${btn(OFFER_URL, "See the Complete Recovery Kit →")}
    <p>— Money You're Owed</p>`);
}
function waitlistHtml() {
  return shell(`<p>Hi,</p>
    <p>You're on the list for the <strong>Complete Recovery Kit</strong> — you'll be first to know the moment it launches, at the launch price.</p>
    <p>In the meantime, the free checklists at moneyyoureowed.com will show you exactly what you're owed.</p>
    <p>— Money You're Owed</p>`);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function json(obj, status, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });
}
