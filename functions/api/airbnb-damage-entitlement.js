const PRODUCT = "airbnb-damage-claim";
const BUYER_ROUTE = "/d/adc-58b41e6f/";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function paidAndComplete(session) {
  return session?.payment_status === "paid" && session?.status === "complete" && session?.metadata?.product === PRODUCT;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const sessionId = url.searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json({ entitled: false, error: "Invalid session" }, 400);
  if (!context.env.STRIPE_SECRET_KEY) return json({ entitled: false, error: "Payment verification is not configured" }, 503);

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) return json({ entitled: false, error: "Session verification failed" }, 502);
  const session = await response.json();
  if (!paidAndComplete(session)) return json({ entitled: false, error: "Paid access not verified" }, 403);
  return json({ entitled: true, downloadUrl: BUYER_ROUTE });
}
