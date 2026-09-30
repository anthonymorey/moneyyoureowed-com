// Site-wide landing-view beacon (added 2026-09-29). Appends a 1x1 pixel to every HTML page so the
// daily scoreboard can count unique visitors per page, plus a second pixel per traffic source (?src=ig-bio etc.).
// Beacon: beacon.moneyyoureowed.com/b (Hermes, via the postiz Cloudflare tunnel). No cookies, no PII
// (the beacon stores a salted daily IP+UA hash only). Never blocks or alters the page if anything fails.

const BEACON = "https://beacon.moneyyoureowed.com/b?site=";

export async function onRequest(context) {
  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html") || context.request.method !== "GET") return res;
  try {
    const url = new URL(context.request.url);
    if (url.pathname.startsWith("/sm/") || url.pathname.startsWith("/api/")) return res;
    const page = "myo" + (url.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/home");
    const src = url.searchParams.get("src");
    let pixels = `<img src="${BEACON}${encodeURIComponent(page)}" alt="" width="1" height="1" style="position:absolute;left:-9999px" referrerpolicy="no-referrer">`;
    if (src && /^[a-z0-9-]{1,40}$/.test(src)) {
      pixels += `<img src="${BEACON}${encodeURIComponent("src:" + src)}" alt="" width="1" height="1" style="position:absolute;left:-9999px" referrerpolicy="no-referrer">`;
    }
    return new HTMLRewriter().on("body", { element(el) { el.append(pixels, { html: true }); } }).transform(res);
  } catch (_) {
    return res;
  }
}
