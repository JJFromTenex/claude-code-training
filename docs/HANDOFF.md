# Handoff Log — NWP-101 export options

Running log of what's been done in this working copy, kept up to date as work
happens so a new session (or a teammate) can pick up without re-deriving
context. Newest entries at the top.

## Status

- **Branch:** `NWP-101-export-options` (off `main`, not yet pushed)
- **Ticket:** `docs/tickets/NWP-101.md` — payments export column/scope options
- **Stage:** feature built and passing tests. `/ship-ready` run, no blocking
  issues in the changed files. **Nothing committed yet, nothing pushed.**
  Next session should commit, run `/pr`, then push and open the PR.

## Log

- **2026-08-25** — Added two MCP servers to the top-level (`claude-code-training`)
  project scope via `claude mcp add`: `github` (`--transport http`, GitHub
  Copilot's hosted MCP endpoint — will need an OAuth login on first real use)
  and `playwright` (`npx @playwright/mcp@latest`, stdio). Both written to
  `~/.claude.json` under the `/Users/santi/claude-code-training` project key.
  **Neither shows up in `/mcp` in the current session** — `claude mcp add`
  writes straight to disk but a running session only loads its MCP list at
  startup. They'll appear after the next `claude` restart from this repo
  root, likely with an auth prompt for `github` the first time a tool from
  it is called.
- **2026-08-25** — Ran `/ship-ready` over all of `merchant-console/src/`.
  4 findings, all pre-existing (not in NWP-101's file map, not introduced by
  this change): float accumulation in `src/data/metrics.ts:31,34` and
  `src/data/analytics.ts:54,73` (stress-tested for drift — none found at
  current data volume, but violates the money convention and is a latent
  risk); local-time date bucketing in `src/data/metrics.ts:25`
  (`toLocaleDateString` instead of the UTC `createdAt` string — a real
  bucketing bug, wrong calendar day near UTC midnight depending on server
  timezone); ad hoc `store.payments.filter()` calls in `metrics.ts` /
  `analytics.ts` / `MetricsCards.tsx` bypassing `queries.ts` (low-confidence
  finding — these are dashboard aggregates, not the client-facing list
  filtering the "one query builder" rule is really guarding). Everything
  NWP-101 touched passed all 8 checks clean. Not fixed — out of this
  ticket's scope, flagged for visibility only.
- **2026-08-25** — Implemented NWP-101 per the epic below. Changed:
  `src/lib/csv.ts` (`DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`,
  `parseExportScope`, `exportScopeLabel`, `exportFilename` now takes a scope
  label), `src/app/api/payments/export/route.ts` (server-side column
  allowlist validation, 400 on empty selection, scope via
  `filterPayments({})` — same query builder, no second path), new
  `src/app/payments/export-dialog.tsx` (built on the existing `Drawer`
  primitive — column checkboxes, scope radios with row counts, Download
  disabled when nothing's selected), `src/app/payments/page.tsx` (wired the
  dialog in, passes both row counts). Added 15 new/updated cases to
  `src/lib/csv.test.ts` covering column subset+order, `last4` excluded by
  default, empty selection, scope label, and the new filename format.
  `npm test`: 41/41 passing. `tsc --noEmit` and `npm run lint` both clean.
  Verified live against the dev server: default export omits `last4`,
  `?status=disputed` produces `payments-disputed-2026-08-25.csv` matching
  the ticket's example format, `?scope=all` exports the full store not the
  current page, empty/garbage `columns` both 400 rather than an empty file.
  Have **not** clicked through the dialog in an actual browser — only
  verified the route via curl and confirmed the page compiles/renders.
- **2026-08-25** — Wrote the epic to
  `docs/epics/NWP-101-export-options.md`. One open question resolved with
  the user before writing it: the export filename's scope label falls back
  to the literal string `"current"` when scope is "current filter" but no
  status filter narrows it (matches the ticket's own example,
  `payments-disputed-2026-08-13.csv`, for the case where a status filter
  *is* active).
- **2026-08-25** — Restarted rooted at the repo (fixed the working-root issue
  below), but `/epic`, `/pr`, `/ship-ready` still didn't show up. Real root
  cause: the skill files were flat `.claude/skills/epic.md` (etc.) with no
  YAML frontmatter. Claude Code only discovers skills laid out as
  `<name>/SKILL.md` with a `---\nname: ...\ndescription: ...\n---` header —
  cwd being correct doesn't matter without that shape. Fixed by moving each
  to `.claude/skills/<name>/SKILL.md` and adding frontmatter (`git mv` to
  keep history). All three now show up in the skill listing. Staged, not
  committed.
- **2026-08-25** — Discovered `/epic`, `/pr`, `/ship-ready` weren't showing up.
  Root cause: this Claude Code session's working root is `/Users/santi`, not
  the repo — project-scoped skills in `.claude/skills/` only load when Claude
  Code is launched from inside `claude-code-training`. Fix: restart Claude
  Code with `cd /Users/santi/claude-code-training && claude`. Done.
- **2026-08-25** — Added a **Release Standards** section to the root
  `CLAUDE.md`: no direct commits to `main`, test evidence required before
  merge, one-line business impact summary in every PR description.
- **2026-08-25** — Ran `/init`-style review of `build-battle/merchant-console`
  and updated its `CLAUDE.md`: added a Commands section (build/lint/test,
  how to run a single test file) and an Architecture section describing the
  request-flow shape (`store.ts` → `queries.ts` allowlist-and-builder →
  route handlers → `src/lib/` helpers → pages). Existing content (data-in-memory,
  four conventions, card rules, rules table) left as-is.
- **2026-08-25** — Installed dependencies in `build-battle/merchant-console`
  (`npm install`) and started the dev server in the background
  (`npm run dev`, log at `/tmp/merchant-console-dev.log`). Confirmed serving
  at `http://localhost:3000`.
- **2026-08-25** — Cloned `github.com/JJFromTenex/claude-code-training` to
  `/Users/santi/claude-code-training` and created branch
  `NWP-101-export-options` off `main`.
- **2026-08-25** — Read `docs/tickets/NWP-101.md`. Summary: ops needs a
  column-picker (card last-four off by default) and a scope choice (current
  filter vs. all payments, row count shown pre-download) added to the
  existing Export button on `/payments`. Notes warn: validate column names
  server-side (no SQL interpolation), scope must be built server-side since
  the table is paginated and the browser only has the current page, and
  reuse the existing query builder behind `GET /api/payments` rather than
  writing a second one.
- **2026-08-25** — Built an architecture overview artifact covering what the
  app does, the tech stack, `src/` layout, and the payments export flow
  end-to-end (with the NWP-101 gaps annotated inline).

## Uncommitted changes right now

```
renamed:    .claude/skills/epic.md -> .claude/skills/epic/SKILL.md
renamed:    .claude/skills/pr.md -> .claude/skills/pr/SKILL.md
renamed:    .claude/skills/ship-ready.md -> .claude/skills/ship-ready/SKILL.md  (staged)
modified:   CLAUDE.md
modified:   build-battle/merchant-console/CLAUDE.md
modified:   build-battle/merchant-console/package-lock.json
modified:   build-battle/merchant-console/src/app/api/payments/export/route.ts
modified:   build-battle/merchant-console/src/app/payments/page.tsx
modified:   build-battle/merchant-console/src/lib/csv.test.ts
modified:   build-battle/merchant-console/src/lib/csv.ts
new file:   build-battle/merchant-console/src/app/payments/export-dialog.tsx
new file:   docs/HANDOFF.md
new file:   docs/epics/NWP-101-export-options.md
```

Nothing has been committed yet on this branch. Dev server still running in
the background (`npm run dev`, log at `/tmp/merchant-console-dev.log`,
serving `http://localhost:3000`) — may or may not still be alive depending
on whether this machine/terminal stayed up between sessions; check before
relying on it.

## Next steps

1. Restart Claude Code from the repo root — picks up the `/epic`/`/pr`/
   `/ship-ready` skill fix (already done, just needs a fresh session to
   show) and the two new MCP servers (`github`, `playwright`).
2. Optional: eyeball the dialog in an actual browser at `/payments` —
   toggling scope/columns, the disabled-Download state, and the download
   itself have only been checked via curl and static render, not a real
   click-through.
3. Optional: decide whether to act on the 4 `/ship-ready` findings in
   `metrics.ts`/`analytics.ts` — they're pre-existing and out of NWP-101's
   scope, so probably a separate ticket rather than folded into this PR.
4. `git add`, commit (subject prefixed `NWP-101:`), then `/pr` to write the
   description — ticket, epic, and verification evidence are all already in
   context/on disk for it to draw from.
5. Push and open the PR against `main`.
