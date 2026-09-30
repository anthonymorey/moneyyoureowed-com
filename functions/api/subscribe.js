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
const LM01_GROUP = "189379076374398313"; // 50-State checklist -> Hermes nurture sequence

// group_id -> the lead magnet it delivers. Add a new magnet here = it's automatically wired. waitlist has no doc.
const MAGNETS = {
  "189379076374398313": { title: "50-State Unclaimed Money Checklist", file: "/downloads/50-State-Unclaimed-Money-Checklist.pdf" },
  "189606595562309447": { title: "Airline Refund Cheat-Sheet",        file: "/downloads/Airline-Refund-Cheat-Sheet.pdf",
    offer: { url: "https://flight-refund-recovery.pages.dev/",
             label: "Check My Flight Free →",
             line: "That's the <em>map</em> — what the airline may owe and the first steps to take. If the airline still has your money, <strong>Flight Refund Recovery</strong> starts with a free eligibility quiz, then builds a ready-to-send US airline claim letter for qualifying situations. The claim builder is $29 one time; results are not guaranteed." } },
  "189909462722544704": { title: "11-Way Money Checklist",            file: "/downloads/11-Way-Money-Checklist.pdf" },
  "189909462863054164": { title: "EITC Eligibility Checklist",        file: "/downloads/EITC-Eligibility-Checklist.pdf" },
  "190642621849273424": { title: "Surprise Medical Bill Rights Cheat-Sheet", file: "/downloads/Surprise-Medical-Bill-Rights-Cheat-Sheet.pdf" },
  "190644041404122322": { title: "Property Tax Appeal Kit",                 file: "/downloads/Property-Tax-Appeal-Kit.pdf" },
  "193450189555500253": { title: "GLP-1 Coverage Checklist",                file: "/downloads/GLP-1-Coverage-Checklist.pdf",
    offer: { url: "https://moneyyoureowed.com/glp1-appeal/",
             label: "See the GLP-1 Appeal Kit ($39) →",
             line: "That's the <em>map</em> — it helps you identify your coverage path and next step. If you need more guidance, the <strong>GLP-1 Appeal Kit</strong> gives you practical tools to take that step: fill-in letters for common denial reasons, a prior-authorization worksheet for your doctor’s office, and step-by-step playbooks for major insurers. You complete and submit everything yourself." } },
  "189966496569492517": { waitlist: true },
};

// New video resources can share the general MYO checklist group while still
// receiving the correct document. The client may only choose these fixed keys;
// it cannot provide an arbitrary file or URL.
const MAGNET_KEYS = {
  "warranty": { title: "Warranty Claim Pack", file: "/downloads/Warranty-Claim-Pack.pdf" },
  "salary": { title: "Salary Negotiation Pack", file: "/downloads/Salary-Negotiation-Pack.pdf" },
  "car-deal": { title: "Out-the-Door Car Deal Checklist", file: "/downloads/Out-the-Door-Car-Deal-Checklist.pdf" },
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
  const magnet = (body.magnet || "").trim();
  const src = /^[a-z0-9-]{1,40}$/.test(body.src || "") ? body.src : ""; // e.g. ig-bio, ig-claim, yt-v01

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422, cors);
  }
  if (group && !Object.prototype.hasOwnProperty.call(MAGNETS, group)) {
    return json({ error: "Unknown subscriber group" }, 422, cors);
  }
  if (magnet && !Object.prototype.hasOwnProperty.call(MAGNET_KEYS, magnet)) {
    return json({ error: "Unknown magnet" }, 422, cors);
  }
  if (magnet && group !== "189909462722544704") {
    return json({ error: "Magnet is not valid for this group" }, 422, cors);
  }
  if (!env.MAILERLITE_TOKEN) return json({ error: "Server not configured" }, 500, cors);

  // 1) MailerLite (capture is the critical path)
  const payload = { email, fields: { ...(name ? { name } : {}), ...(src ? { signup_source: src } : {}) } };
  if (group) payload.groups = [group];
  const ml = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
    body: JSON.stringify(payload),
  });
  // Fail OPEN: if MailerLite refuses (e.g. account paused, found 2026-09-29), the visitor still gets
  // their checklist, and the lead is emailed to hello@ so it isn't lost. The nurture sequence only
  // reaches leads that MailerLite accepted.
  let captured = ml.ok;
  if (!ml.ok) {
    const detail = (await ml.text()).slice(0, 300);
    if (env.RESEND_API_KEY) {
      try {
        await sendEmail(env.RESEND_API_KEY, "hello@moneyyoureowed.com", `[lead not captured] ${email}`,
          `<p>MailerLite refused this sign-up (HTTP ${ml.status}), so it is NOT on the list or in the nurture sequence.</p>
           <p>Email: ${email.replace(/</g, "&lt;")}<br>Name: ${name.replace(/</g, "&lt;")}<br>Group: ${group}<br>Magnet: ${magnet}</p>
           <p>MailerLite said: ${detail.replace(/</g, "&lt;")}</p>`);
      } catch (_) { /* best effort */ }
    }
  }

  // 2) Delivery email via Resend (non-blocking: never fails the capture). Skips silently until RESEND_API_KEY is set.
  try {
    const m = MAGNET_KEYS[magnet] || MAGNETS[group];
    if (env.RESEND_API_KEY && m && !m.waitlist && group === LM01_GROUP && !magnet && env.UNSUB_SECRET) {
      // LM01 opens the Hermes nurture sequence (myo-nurture): Email 1 delivers value only, no pitch.
      const origin = new URL(request.url).origin;
      const unsub = await unsubUrl(env, origin, email);
      await sendEmail(env.RESEND_API_KEY, email, "Your 50-state checklist (and the 5-minute way to use it)",
        lm01Html(origin + m.file, unsub, captured), { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    } else if (env.RESEND_API_KEY && m && !m.waitlist) {
      const origin = new URL(request.url).origin; // https://moneyyoureowed.com
      await sendEmail(env.RESEND_API_KEY, email, `Here's your free ${m.title}`, magnetHtml(m.title, origin + m.file, m.offer));
    } else if (env.RESEND_API_KEY && m && m.waitlist) {
      await sendEmail(env.RESEND_API_KEY, email, "You're on the Recovery Kit waitlist", waitlistHtml());
    }
  } catch (_) { /* email is a bonus; capture already succeeded */ }

  return json({ ok: true, captured }, 200, cors);
}

// Retries transient failures (found 2026-09-29: one delivery email silently dropped in a 10-send test).
// Returns true once Resend accepts the email; on final failure, alerts hello@ so no lead goes unserved.
async function sendEmail(key, to, subject, html, headers, isAlert) {
  const body = JSON.stringify(headers ? { from: FROM, to, subject, html, headers } : { from: FROM, to, subject, html });
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
    await sendEmail(key, "hello@moneyyoureowed.com", `[email NOT delivered] ${to}`,
      `<p>Resend refused the email "${subject.replace(/</g, "&lt;")}" to ${String(to).replace(/</g, "&lt;")} after 3 tries.</p><p>${last.replace(/</g, "&lt;")}</p><p>Send them their resource by hand.</p>`,
      null, true).catch(() => {});
  }
  return false;
}

// Must match myo-nurture/nurture.py unsub_url() and functions/api/unsubscribe.js.
async function unsubUrl(env, origin, email) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase()));
  const t = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return `${origin}/api/unsubscribe?${new URLSearchParams({ e: email, t })}`;
}

function lm01Html(fileUrl, unsub, captured) {
  return shell(`<p>Hi,</p>
    <p>Here's your free <strong>50-State Unclaimed Money Checklist</strong>.</p>
    ${btn(fileUrl, "⬇ Download the checklist")}
    <p>If you only do one thing today, do this. Open <strong>missingmoney.com</strong> and search your name. It's the free, official multi-state search the state treasurers run. It takes about five minutes.</p>
    <p>Then check your <strong>current state's own site</strong> from Step 2 of the checklist. Not every state feeds the national search in real time.</p>
    <p>${captured ? "That's it for today. Tomorrow I'll send the one step most people skip, which is where a lot of forgotten money actually turns up."
      : "One more tip: search every state you've lived, worked or banked in, and every version of your name. That's where a lot of forgotten money actually turns up."}</p>
    <p>— Money You're Owed</p>`, unsub);
}

function shell(inner, unsub) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a3a3a;max-width:560px;margin:0 auto;line-height:1.6">
    <div style="background:#1B6B5F;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">Money You're Owed</div>
    <div style="border:1px solid #e3efec;border-top:none;border-radius:0 0 10px 10px;padding:24px">${inner}</div>
    <p style="color:#9aa9a6;font-size:12px;margin-top:16px">You're getting this because you grabbed a free resource at moneyyoureowed.com. Educational content only — not financial or legal advice.${unsub ? ` <a href="${unsub}" style="color:#9aa9a6">Unsubscribe</a>` : ""}</p>
  </div>`;
}
function btn(href, label) {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#1B6B5F;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;display:inline-block">${label}</a></p>`;
}
function magnetHtml(title, fileUrl, offer) {
  const pitchLine = offer ? offer.line
    : "That's the <em>map</em> — what you're owed and where to look. When you'd rather have it <strong>done for you</strong> — the exact fill-in letters, word-for-word phone scripts, and a tracker across every category — that's the Complete Recovery Kit.";
  const pitchBtn = offer ? btn(offer.url, offer.label) : btn(OFFER_URL, "See the Complete Recovery Kit →");
  return shell(`<p>Hi,</p>
    <p>Here's your free <strong>${title}</strong> — thanks for grabbing it.</p>
    ${btn(fileUrl, "⬇ Download your PDF")}
    <p>${pitchLine}</p>
    ${pitchBtn}
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
