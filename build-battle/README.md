# Build Battle: Sales Leaderboard

**Time:** 30 minutes | **Everyone competes** | **All skills from today**

---

## The Rules

1. This is a sales leaderboard dashboard with **bugs hiding in plain sight**
2. There's an **open Issue** describing a feature to build
3. You have 30 minutes to:
   - Find and fix as many bugs as you can
   - Build the requested feature
   - Push a clean PR

## Scoring

A Claude sub-agent reviews every PR automatically and scores on:

| Weight | Category | What It Checks |
|--------|----------|---------------|
| 40% | **Feature** | Does the requested feature work correctly? |
| 30% | **Bugs Fixed** | How many of the planted bugs did you find and fix? |
| 20% | **Code Quality** | Clean code, proper formatting, no new issues introduced |
| 10% | **PR Description** | Clear explanation of what you changed and why |

## How to Submit

```bash
# Make your changes
git add -A
git commit -m "fix: [describe your changes]"
git push origin main
# Open a PR — the reviewer runs automatically
```

You can push multiple times. Each push re-triggers the reviewer. Your highest score counts.

## Tips

- Run `/ship-ready` before pushing — it catches some issues, but not all
- Read the CLAUDE.md first — it tells you the project's conventions
- The bugs range from obvious to subtle. Some are in the JS, some in the data, one is in the CSS.
- Don't just fix bugs — make sure the feature works end-to-end

## Feature Request

> **Add a time-period filter** (This Week / This Month / This Quarter / All Time) that filters the leaderboard data and updates the stats cards. The filter should persist in the URL hash so sharing a link preserves the view.

Good luck.
