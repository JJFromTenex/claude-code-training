# Station 1: Hook a Real Repo

**Time:** 30 minutes | **Focus:** Engineering | **Concepts:** CLAUDE.md, Skills, Hooks

---

## What You'll Build

You'll take a vanilla dashboard app and wire it up with Claude Code's core engineering features: a project-aware CLAUDE.md, a reusable `/ship-ready` skill, and a pre-commit hook that enforces quality automatically.

## Setup

```bash
cd station-1
```

Open `index.html` in your browser to see the dashboard. Then open Claude Code in this directory.

---

## Step 1: Clone + Explore (10 min)

1. Open Claude Code in this folder
2. Ask Claude: **"Read the CLAUDE.md and summarize the rules for this project"**
3. Use **plan mode** to propose a redesign of the stat cards section — maybe a new layout, better data display, or an additional metric
4. Review Claude's plan, approve it, and ship the diff
5. Refresh your browser to see the change

> **What you're learning:** CLAUDE.md gives Claude persistent context about your project. It reads these rules every session without you repeating them.

## Step 2: Build a Skill (10 min)

1. Look at the pre-built skill: `.claude/skills/ship-ready.md`
2. Ask Claude: **"Run /ship-ready and show me the results"**
3. Review what it checks (TODOs, console.logs, missing docs, accessibility)
4. Now build your own skill — create a new file `.claude/skills/your-skill.md` that does something useful:
   - A `/refactor` skill that finds functions over 25 lines and suggests splits
   - A `/dark-mode` skill that generates a dark color scheme
   - A `/perf-check` skill that looks for performance issues
   - Or anything else you want to automate

> **What you're learning:** Skills are reusable slash commands defined in markdown. Any repeatable workflow becomes a one-command shortcut.

## Step 3: Wire a Hook (10 min)

1. Ask Claude: **"Add a pre-commit hook that runs /ship-ready before every commit"**
2. Claude will create or update `.claude/settings.json` with a hook configuration
3. Make a change to the code (add a `console.log` or a TODO comment)
4. Try to commit — watch the hook intercept and flag the issue
5. Fix the issue and commit again — this time it passes

> **What you're learning:** Hooks fire automatically before or after Claude acts. They enforce quality without you remembering to check.

---

## Take-Home

- A hooked repo with automated quality checks
- The `/ship-ready` skill installed and working locally
- Understanding of how CLAUDE.md, Skills, and Hooks work together

## Key Lesson

> CLAUDE.md sets the rules. Skills package the workflow. Hooks enforce it automatically.
