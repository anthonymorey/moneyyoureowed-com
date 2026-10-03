// Google Ads tag for the GLP-1 search test (2026-10-03). Inert until AW_ID is set.
// Conversions are URL-based in Google Ads (/glp1-thanks = sign-up, /glp1-appeal/thank-you = purchase),
// so the base tag on each page is all that is needed.
(function () {
  var AW_ID = "AW-18492662230";
  if (!AW_ID) return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + AW_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", AW_ID);
})();
