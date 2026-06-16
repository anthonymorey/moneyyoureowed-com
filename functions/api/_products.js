// Shared product catalog — single source of truth for checkout-start + stripe-webhook.
// (Underscore prefix => Cloudflare Pages does NOT treat this as a route.)
// Option A (2026-06-11): every product individually buyable at its real à-la-carte price,
// the $79 bundle stays the obvious deal. The $131 "if bought separately" anchor is now TRUE.

export const FILES_BASE = "/kit-files/kit-fa7cd3897c7ae013";

export const ML_CHECKOUT_STARTED = "189993107837683062"; // any checkout begun (abandoned-cart pool)
export const ML_KIT_PURCHASED = "189993108002309699";     // bought the bundle
export const ML_SINGLE_PURCHASED = "190011904531367566";  // bought a single à-la-carte product

// Bundle delivery is sectioned (Start here -> trackers -> guides) — operator-locked layout.
export const MASTER_GUIDE = ["Money You're Owed Master Tracker — quick-start guide", "Money-You-re-Owed-Master-Tracker.pdf"];
export const MASTER_DASH  = ["Master Tracker — your claim dashboard (spreadsheet)", "Money-Youre-Owed-Master-Tracker.xlsx"];
export const OTHER_TRACKERS = [
  ["Medical Bill Dispute Tracker", "Medical-Bill-Dispute-Tracker.xlsx"],
  ["Airline Refund Claim Tracker", "Airline-Refund-Claim-Tracker.xlsx"],
  ["Subscription Tracker", "Subscription-Tracker.xlsx"],
  ["Free-Trial Tracker", "Free-Trial-Tracker.xlsx"],
];
export const GUIDE_FILES = [
  ["Medical Bill Dispute Kit", "Medical-Bill-Dispute-Kit.pdf"],
  ["Airline & Travel Refund Toolkit", "Airline-Travel-Refund-Toolkit.pdf"],
  ["Bank & Card Fee Reversal Scripts", "Bank-Card-Fee-Reversal-Scripts.pdf"],
  ["Subscription Audit & Cancel System", "Subscription-Audit-Cancel-System.pdf"],
  ["Refund & Dispute Letter Vault", "Refund-Dispute-Letter-Vault.pdf"],
];

// price = cents (USD). files = [label, filename] delivered for a SINGLE purchase.
export const PRODUCTS = {
  // FOUNDING-MEMBER price: $59 for the first 50 buyers (then revert to 7900). Set 2026-06-14 per Rishi mentorship.
  // TO END THE FOUNDING WINDOW: change 5900 -> 7900 here, and update index.html (founding-banner, product-price,
  // value-breakdown, bundle-save, bundle-cta, the "no fake countdowns" paragraph, FAQ, cta-band, and JS PRICES.bundle).
  bundle: { name: "Complete Recovery Kit", price: 5900, ml: ML_KIT_PURCHASED, isBundle: true },
  medical: {
    name: "Medical Bill Dispute Kit", price: 1900, ml: ML_SINGLE_PURCHASED,
    files: [["Medical Bill Dispute Kit (guide)", "Medical-Bill-Dispute-Kit.pdf"], ["Medical Bill Dispute Tracker", "Medical-Bill-Dispute-Tracker.xlsx"]],
  },
  airline: {
    name: "Airline & Travel Refund Toolkit", price: 1700, ml: ML_SINGLE_PURCHASED,
    files: [["Airline & Travel Refund Toolkit (guide)", "Airline-Travel-Refund-Toolkit.pdf"], ["Airline Refund Claim Tracker", "Airline-Refund-Claim-Tracker.xlsx"]],
  },
  bank: {
    name: "Bank & Card Fee Reversal Scripts", price: 1200, ml: ML_SINGLE_PURCHASED,
    files: [["Bank & Card Fee Reversal Scripts (guide)", "Bank-Card-Fee-Reversal-Scripts.pdf"], ["Bank Fee Reversal Log", "Bank-Fee-Reversal-Log.xlsx"]],
  },
  subscription: {
    name: "Subscription Audit & Cancel System", price: 1500, ml: ML_SINGLE_PURCHASED,
    files: [["Subscription Audit & Cancel System (guide)", "Subscription-Audit-Cancel-System.pdf"], ["Subscription Tracker", "Subscription-Tracker.xlsx"], ["Free-Trial Tracker", "Free-Trial-Tracker.xlsx"]],
  },
  lettervault: {
    name: "Refund & Dispute Letter Vault", price: 3900, ml: ML_SINGLE_PURCHASED,
    files: [["Refund & Dispute Letter Vault", "Refund-Dispute-Letter-Vault.pdf"]],
  },
  mastertracker: {
    name: "Money You're Owed Master Tracker", price: 2900, ml: ML_SINGLE_PURCHASED,
    files: [["Master Tracker — your claim dashboard (spreadsheet)", "Money-Youre-Owed-Master-Tracker.xlsx"], ["Master Tracker — quick-start guide", "Money-You-re-Owed-Master-Tracker.pdf"]],
  },
};
