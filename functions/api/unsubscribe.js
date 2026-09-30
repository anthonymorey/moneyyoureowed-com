// Cloudflare Pages Function — signed one-click unsubscribe for MYO emails.
//   Links come from the Hermes nurture sender (myo-nurture) and /api/subscribe:
//   /api/unsubscribe?e=<email>&t=<first 32 hex of HMAC-SHA256(UNSUB_SECRET, lowercase email)>
//   GET  -> confirmation page with a button (link scanners must not unsubscribe people).
//   POST -> unsubscribes in MailerLite (also serves RFC 8058 List-Unsubscribe-Post one-click).
// Secrets: UNSUB_SECRET (shared with Hermes /etc/myo-nurture.env), MAILERLITE_TOKEN.

async function valid(env, email, token) {
  if (!env.UNSUB_SECRET || !email || !token) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.toLowerCase()));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return hex === token;
}

function page(title, inner) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title} — Money You're Owed</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a3a3a;background:#f6faf9;margin:0;padding:48px 16px">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e3efec;border-radius:12px;padding:28px">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>${inner}
<p style="margin-top:24px"><a href="/" style="color:#1B6B5F">moneyyoureowed.com</a></p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const email = (u.searchParams.get("e") || "").trim();
  if (!(await valid(env, email, u.searchParams.get("t") || ""))) {
    return page("Link not recognised", "<p>This unsubscribe link is incomplete or has expired. Reply to any of our emails with \"unsubscribe\" and we'll remove you by hand.</p>");
  }
  return page("Unsubscribe?", `<p>Stop all emails to <strong>${esc(email)}</strong>?</p>
<form method="post"><button type="submit" style="background:#1B6B5F;color:#fff;border:0;padding:12px 24px;border-radius:8px;font-weight:700;font-size:16px;cursor:pointer">Yes, unsubscribe me</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const u = new URL(request.url);
  const email = (u.searchParams.get("e") || "").trim();
  if (!(await valid(env, email, u.searchParams.get("t") || ""))) {
    return page("Link not recognised", "<p>This unsubscribe link is incomplete. Reply to any of our emails with \"unsubscribe\" and we'll remove you by hand.</p>");
  }
  const r = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
    body: JSON.stringify({ email, status: "unsubscribed" }),
  });
  if (!r.ok) {
    return page("Something went wrong", "<p>We couldn't process that just now. Please try again in a minute, or reply to any of our emails with \"unsubscribe\".</p>");
  }
  return page("You're unsubscribed", `<p><strong>${esc(email)}</strong> won't get any more emails from us.</p>`);
}
