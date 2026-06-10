// Cloudflare Pages Function — server-side MailerLite proxy.
// Lives at /api/subscribe (POST). The MailerLite token is read from the
// environment variable MAILERLITE_TOKEN (a Pages secret) and NEVER sent to the browser.
//
// Set the secret with:
//   npx wrangler pages secret put MAILERLITE_TOKEN --project-name=myo-landing-pages
//
// Client sends JSON: { "email": "...", "name": "...", "group": "<group_id>" }

export async function onRequestPost(context) {
  const { request, env } = context;

  // Basic CORS / same-origin handling
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, cors);
  }

  const email = (body.email || "").trim();
  const name = (body.name || "").trim();
  const group = (body.group || "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Valid email required" }, 422, cors);
  }
  if (!env.MAILERLITE_TOKEN) {
    return json({ error: "Server not configured" }, 500, cors);
  }

  const payload = {
    email,
    fields: name ? { name } : {},
  };
  if (group) payload.groups = [group];

  const ml = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.MAILERLITE_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!ml.ok) {
    const text = await ml.text();
    return json({ error: "Subscribe failed", detail: text.slice(0, 300) }, 502, cors);
  }

  return json({ ok: true }, 200, cors);
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}
