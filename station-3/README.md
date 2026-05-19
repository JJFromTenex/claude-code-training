# Station 3: Pipeline to Outreach

**Time:** 30 minutes | **Focus:** Sales & GTM | **Concepts:** MCP Connectors + Skills

---

## What You'll Build

A personalized outreach workflow: load your pipeline, teach Claude your writing voice, and generate follow-up emails that sound like you — not a robot.

## Setup

```bash
cd station-3
```

Open Claude Code in this directory.

---

## Step 1: Load the Pipeline (10 min)

1. Ask Claude: **"Read data/pipeline.csv and give me a pipeline health summary. Which deals are stalled?"**
2. Claude reads the CSV, identifies the 6-8 stalled deals (30+ days since last touch), and summarizes the pipeline
3. Ask follow-ups: "Which stalled deals have the highest value?" or "What patterns do you see in the notes?"

> **What you're learning:** Claude can ingest structured data and produce insights instantly. No dashboard needed — just ask.

## Step 2: Build a Voice Skill (10 min)

### Option A: Use the sample emails (recommended)
1. Ask Claude: **"Read all the emails in data/sample-emails/ and analyze my writing style. What patterns do you notice — tone, sentence length, how I open and close, level of formality?"**
2. Claude reads the 12 sample emails and extracts your voice profile
3. Ask Claude: **"Now create a /outreach skill in .claude/skills/ that drafts outreach emails matching this voice"**

### Option B: Connect Gmail via MCP (stretch goal)
1. If you have Gmail MCP configured, ask Claude: **"Read my last 10 sent emails and analyze my writing style"**
2. Claude connects via MCP, reads your actual sent mail, and builds the voice profile
3. Same as above — create the `/outreach` skill from the analysis

> **What you're learning:** MCP connectors give Claude access to your real tools. Skills package that into a repeatable workflow.

## Step 3: Draft the Outreach (10 min)

1. Run: **"/outreach"**
2. Claude reads the stalled deals from `pipeline.csv`, applies your voice, and drafts a personalized follow-up for each
3. Drafts are saved to `output/` as markdown files
4. Review and compare — each draft should reference specific deal context, not generic templates

> **What you're learning:** Claude + real data + your voice = outreach that doesn't read like a robot wrote it.

---

## Take-Home

- A personalized outreach skill trained on your writing style
- Pipeline analysis workflow you can point at any CRM export

## Key Lesson

> MCP + Skills together — connect a data source, then build a repeatable workflow on top of it.
