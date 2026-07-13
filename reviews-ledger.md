# Reviews ledger — maintained by the weekly cloud routine

This file is written by the **MYO weekly review harvester** routine. It is in `paths-ignore`
for the deploy workflow, so updating it never triggers a redeploy (only `index.html` review
inserts deploy). It serves two purposes: a **dedupe list** of Gmail message ids already
processed, and a **heartbeat** proving the routine can push each week.

## Heartbeat (last run)
- 2026-07-13 (run 6) — ran; 0 new MYO sales or review emails found this week; nothing published

## Processed Gmail message IDs
<!-- one id per line; the routine skips any id already here -->
19eb7e67d789de4d
19eb7e67c3654ffa
19eb82b09102e4c9
19eb6d37d424c189
19edc4bdd423b8f2
19f0f79b3e2bfb05
19f0f79acb3ff734
19f31f6eda350ba5
19f08c66ae91b0ad
19f098e49fd58b4f
19f12e5054fe16dc

## Published reviews (audit trail)
<!-- firstname | amount | date | gmail-msgid -->

## Skipped (negative/unclear/not-a-review — never published)
<!-- firstname-or-sender | reason | gmail-msgid -->
notifications@stripe.com | TEST purchase pi_3ThD8uFY3wO0S3cG0Q5Qyk03 — excluded per instructions | 19eb7e67d789de4d
receipts+acct_1Th93MFY3wO0S3cG@stripe.com | TEST receipt #1623-1349 — excluded per instructions | 19eb7e67c3654ffa
amorey74@gmail.com | Owner's own test email to hello@moneyyoureowed.com (subject: "boohoohoo hoo") | 19eb82b09102e4c9
amorey74@gmail.com | Owner's own test email to hello@moneyyoureowed.com (subject: "boo hoo!") | 19eb6d37d424c189
hello@moneyyoureowed.com | Outbound marketing/delivery email from MYO system to owner — not a customer review | 19edc4bdd423b8f2
receipts+acct_1Th93MFY3wO0S3cG@stripe.com | Genuine sale receipt #1669-6542 $29.00 "Deposit Defender" Jun 28 2026 — logged as sale (not a review, not the Recovery Kit product; no review email from buyer) | 19f0f79b3e2bfb05
hello@moneyyoureowed.com | MYO delivery email to owner (amorey74@gmail.com) for Jun 28 sale — not a customer review | 19f0f79acb3ff734
amorey74@gmail.com | Owner's test email to maya@moneyyoureowed.com (subject: "Yes ddd") — not a customer | 19f31f6eda350ba5
amorey74@gmail.com | Owner's internal email to self about Facebook ads fix — not a customer review | 19f08c66ae91b0ad
amorey74@gmail.com | Owner's internal email to self about MYO Phase 0 ad page — not a customer review | 19f098e49fd58b4f
amorey74@gmail.com | Owner's internal email to self about Google Ads API setup — not a customer review | 19f12e5054fe16dc
