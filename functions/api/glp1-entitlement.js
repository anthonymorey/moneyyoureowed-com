const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{8,}$/.test(sessionId)) {
    return json({ entitled: false, error: "Valid Checkout Session required" }, 422);
  }
  if (!env.STRIPE_SECRET_KEY) {
    return json({ entitled: false, error: "Payments not configured" }, 500);
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const session = await response.json();
    if (!response.ok) {
      return json({ entitled: false }, response.status === 404 ? 404 : 502);
    }

    const entitled = session.payment_status === "paid"
      && session.status === "complete"
      && session.metadata?.product === "glp1-appeal";
    return json(entitled
      ? { entitled: true, deliveryUrl: "/d/glp1-b06d903585/" }
      : { entitled: false }, 200);
  } catch (_) {
    return json({ entitled: false, error: "Could not verify purchase" }, 502);
  }
}

export function onRequestOptions() {
  return new Response(null, { headers: cors });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
