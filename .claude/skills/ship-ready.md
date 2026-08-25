---
description: Pre-ship quality check — money math, UTC, duplicate logic, unvalidated input
user_invocable: true
---

# /ship-ready

Run a pre-ship quality check on the merchant console before opening a pull request. Scan the TypeScript and TSX files under `merchant-console/src/` and report issues.

## Checks to Run

1. **Money handling** — Flag arithmetic on an amount that is not integer minor units: float math, `parseFloat` on an amount, dividing by 100 outside a formatter, or `toFixed` used to produce a stored value rather than a displayed one. This is the check that matters most in this codebase.
2. **Date handling** — Flag bucketing, grouping, or comparison that uses server local time instead of UTC. A bare `new Date()` near a query is suspicious.
3. **Query reuse** — Flag a second implementation of payment filtering. One query builder sits behind `GET /api/payments`, and everything should go through it.
4. **Input validation** — Flag any value that arrives from the client and reaches a query, a filename, or a file write without being checked against an allowlist.
5. **TODO/FIXME scan** — Find TODO, FIXME, HACK, and XXX comments. List each with file and line number.
6. **Console audit** — Find `console.log`, `console.warn`, and `console.error` that should not ship.
7. **Accessibility basics** — Dialogs have accessible names, inputs have labels, buttons have discernible text, and heading levels do not skip.
8. **Tests** — Report whether `npm test` passes, and whether the change you are shipping is covered by one.

## Output Format

Print a summary report with:
- A pass/fail status for each check
- Total issue count
- The specific issues, grouped by check, each with file and line

If all checks pass, print: "Ship it. All checks passed."
