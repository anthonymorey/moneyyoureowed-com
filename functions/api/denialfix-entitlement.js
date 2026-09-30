const PRIVATE_ROUTE = "/d/denialfix-7f3c91e2/";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sessionId = (url.searchParams.get("session_id") || "").trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json({ error: "A valid Stripe Checkout Session is required." }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Purchase verification is temporarily unavailable." }, 500);

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) return json({ error: "Purchase could not be verified." }, 502);

  const session = await response.json();
  const entitled = session.payment_status === "paid" && session.status === "complete" && session.metadata?.product === "denialfix";
  if (!entitled) return json({ error: "This session is not an eligible DenialFix purchase." }, 403);

  return json({ entitled: true, downloadUrl: PRIVATE_ROUTE });
}
