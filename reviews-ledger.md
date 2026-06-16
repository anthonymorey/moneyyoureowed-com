# Reviews ledger — maintained by the weekly cloud routine

This file is written by the **MYO weekly review harvester** routine. It is in `paths-ignore`
for the deploy workflow, so updating it never triggers a redeploy (only `index.html` review
inserts deploy). It serves two purposes: a **dedupe list** of Gmail message ids already
processed, and a **heartbeat** proving the routine can push each week.

## Heartbeat (last run)
- (none yet)

## Processed Gmail message IDs
<!-- one id per line; the routine skips any id already here -->

## Published reviews (audit trail)
<!-- firstname | amount | date | gmail-msgid -->

## Skipped (negative/unclear/not-a-review — never published)
<!-- firstname-or-sender | reason | gmail-msgid -->
