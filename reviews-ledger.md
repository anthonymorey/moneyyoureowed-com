# Reviews ledger — maintained by the weekly cloud routine

This file is written by the **MYO weekly review harvester** routine. It is in `paths-ignore`
for the deploy workflow, so updating it never triggers a redeploy (only `index.html` review
inserts deploy). It serves two purposes: a **dedupe list** of Gmail message ids already
processed, and a **heartbeat** proving the routine can push each week.

## Heartbeat (last run)
- 2026-10-05 (run 15) — ran; 0 new MYO Recovery Kit sales or review emails found this week; nothing published

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
19f7bcfe123871cd
19f804177afe5f4c
19f81ca4dd46a860
19fc20c1246be0dc
19f9a3e519cb9e55
19f82b23b2dba7a4
19fb379fe8a1ba51
19fb2fba791df509
19fb2f10c06b012c
1a005ca4ee963c67
1a0159184482c901
1a032962ff914d4a
1a0617a0f4ef93d4
1a0b536799dcb4c3
1a0d2b1faa059eb8
1a0e085499f8c87d
1a0e1c55b767a809
1a0e33844d88d4ef
1a0a3f38b635738c
1a091f33b5e758ef
1a0ec9832ce6b972
1a0ed8d9f516266d
1a1031dc707574fa
1a102a6f01a4c389

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
hello@moneyyoureowed.com | Owner test — MYO system delivery of new GLP-1 Coverage Checklist product to owner's own alias (amorey74+glp1test@gmail.com); not a customer review | 19f7bcfe123871cd
hello@agentry.com | Agentry.com agent listing confirmation for "Money You're Owed Agent" — not a customer review | 19f804177afe5f4c
notifications@github.com | GitHub PR merge notification for A2A directory listing (sing1ee/a2a-directory #39) — not a customer review | 19f81ca4dd46a860
invoice+statements+acct_1REyrSBNUnCSzfs9@stripe.com | Owner's Anthropic Ireland subscription receipt #2905-3963 — not an MYO sale | 19fc20c1246be0dc
invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com | Owner's Eleven Labs subscription receipt #2759-4824-8504 — not an MYO sale | 19f9a3e519cb9e55
invoice+statements+acct_1PksddHJohyvID2c@stripe.com | Owner's Grok xAI subscription receipt #2309-6203 — not an MYO sale | 19f82b23b2dba7a4
noreply@moneyyoureowed.com | MYO internal system email re: Senlac Garage visibility sheet — not a customer review | 19fb2f10c06b012c
noreply@moneyyoureowed.com | MYO internal system email re: Senlac pitch + Companies House — not a customer review | 19fb2fba791df509
noreply@moneyyoureowed.com | MYO internal system email re: Senlac sheet rebuilt with real review counts — not a customer review | 19fb379fe8a1ba51
amorey74@gmail.com | Owner's channel performance digest to self (2026-08-15) — not a customer review | 1a005ca4ee963c67
invoice+statements+acct_1PksddHJohyvID2c@stripe.com | Owner's Grok xAI subscription receipt #2052-0920 — not an MYO sale | 1a0159184482c901
amorey74@gmail.com | Owner's Growth & Tools Brief digest to self (2026-08-24) — not a customer review | 1a032962ff914d4a
invoice+statements+acct_1REyrSBNUnCSzfs9@stripe.com | Owner's Anthropic Ireland subscription receipt #2857-1144 — not an MYO sale | 1a0617a0f4ef93d4
invoice+statements+acct_1PksddHJohyvID2c@stripe.com | Owner's Grok xAI subscription receipt #2660-0854 — not an MYO sale | 1a0b536799dcb4c3
invoice+statements+acct_1REyrSBNUnCSzfs9@stripe.com | Owner's Anthropic Ireland subscription receipt #2857-8175 — not an MYO sale | 1a0d2b1faa059eb8
welcome@openrouter.ai | OpenRouter product email — not an MYO sale or review | 1a0e085499f8c87d
amorey74@gmail.com | Owner's daily scoreboard to self (2026-09-27) — not a customer review | 1a0e1c55b767a809
amorey74@gmail.com | Owner's channel performance digest to self (2026-09-27) — not a customer review | 1a0e33844d88d4ef
hi@eonnext.com | EOn Next energy tariff notification — not an MYO sale or review | 1a0a3f38b635738c
p.rivard@fi.com | Fisher Investments portfolio review — not an MYO sale or review | 1a091f33b5e758ef
hello@moneyyoureowed.com | Internal [TEST] email from MYO system to owner re "Did you find anything?" follow-up sequence — not a customer review | 1a0ec9832ce6b972
info@mailerlite.com | Owner's MailerLite subscription payment receipt (246.24 EUR, moneyyoureowed account) — not an MYO customer sale | 1a0ed8d9f516266d
payments-noreply@google.com | Google Ads payments profile linked to Moneyyoureowed (304-281-5480) — not an MYO sale or review | 1a1031dc707574fa
ads-account-noreply@google.com | Google Ads manager account (Moneyyoureowed 304-281-5480) linked to new sub-account — not an MYO sale or review | 1a102a6f01a4c389
