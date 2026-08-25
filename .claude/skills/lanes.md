# /lanes

Split an epic into parallel lanes and run them as subagents, without the agents overwriting each other.

Use this **after** `/epic` and **before** you build, when the plan is big enough that doing it serially will run out of clock. It produces a contract, a file-ownership table, and a dispatch order — then it runs the lanes and integrates the results.

## Usage

```
/lanes docs/epics/NWP-201-issue-cards.md
```

If no epic is given, ask which one. If no epic exists, stop and run `/epic` first — lanes split a plan, they do not invent one.

## Why this exists

Two subagents editing the same file is a lost write, and you will not notice until the build breaks at minute 35. Two subagents guessing independently at the same function signature is worse: both compile, neither connects, and the bug looks like a mystery.

Both failures have one fix. **Freeze the interface in writing before anyone starts, and give every file exactly one owner.**

## What to do

### 1. Write the contract first

This is the whole technique, and skipping it makes parallelism cost more than it saves.

Write `docs/epics/<ticket-id>-contract.md` pinning, exactly:

- **Every type** the lanes share, in full, with units and nullability spelled out.
- **Every exported function signature** each lane must provide, with a one-line description of behaviour. Names and argument order are frozen the moment you dispatch.
- **Every request and response shape** for every route: method, path, status codes, body on success, body on each failure.
- **The error shape**, once, for all of them.

No implementations. Signatures and shapes only. A lane that needs to know how something works internally is a lane that was split in the wrong place.

### 2. Do the shared work yourself, before dispatch

Any file more than one lane would touch is **yours**, and it lands before a single agent starts. In this codebase that is usually:

- `src/data/types.ts` — every lane imports from it
- `src/data/store.ts` and `src/data/generate.ts` — the store shape and the seed
- shared components like `src/components/ui/payments/StatusBadge.tsx`
- navigation: `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`

Get this compiling with `npx tsc --noEmit` first. Lanes dispatched against a foundation that does not type-check will each invent their own repair.

### 3. Cut the lanes

A good lane owns files nobody else owns, has one clear deliverable, and can be verified on its own. Cut along **file boundaries, not feature boundaries** — "the issue form" is a feature, `src/app/cards/issue-card-form.tsx` is a lane.

Three or four lanes is usually right. Beyond that the integration cost eats the parallelism, and you are the integrator.

Write the ownership table into the contract file. Every file appears exactly once:

| Lane | Agent | Owns | Depends on |
| --- | --- | --- | --- |

If a file wants two owners, you cut in the wrong place — move it into the foundation instead.

### 4. Dispatch

Send every independent lane **in one message, as multiple tool calls**, so they run concurrently. Sequential dispatch is just slow serial work with extra steps.

Match the lane to the agent: `route-builder` for `src/lib/`, `src/data/`, and `src/app/api/`; `ui-builder` for pages and components; `test-writer` for `*.test.ts`. They run on Sonnet — the contract is what makes that work, because the hard thinking already happened when you wrote it.

Every prompt contains, and nothing more:

1. The path to the contract file and the path to the epic. Tell them to read both first.
2. **The exact list of files this lane owns**, and the instruction to edit nothing else.
3. The deliverable, in one or two sentences.
4. How to verify it, and the instruction to paste real command output rather than claiming success.

Do not paste the whole epic into every prompt. Point at the file; that is what it is for.

### 5. Integrate

When the lanes report back, you are the one who checks they meet in the middle:

- `npx tsc --noEmit` and `npm test` across the whole app. Lanes verify their own files; only you can verify the seam.
- Read the diff as one change. Two lanes will have solved the same small problem twice — a formatter, a label map, a status list. Collapse it now.
- Collect every blocker the lanes reported. Those are files they were told not to touch, so they are yours.
- Exercise the feature end to end in the browser. Every lane passing is not the same as the feature working.
- Then `/ship-ready`.

## Rules

- **Contract before dispatch.** Always. If you are tempted to skip it because the work is small, the work is small enough to do serially.
- **One owner per file.** No exceptions, no "just this one line".
- **The contract is frozen once dispatched.** If it turns out to be wrong, stop the lanes rather than letting them each adapt differently.
- **Lanes report, they do not commit.** You read the diff and you commit.
- **You own integration.** No agent can see the seam it shares with another.
- Do not parallelise a lane that depends on another lane's output existing at runtime. Depending on a *signature* is fine — that is what the contract is for. Depending on a *file* is a sequence, not a lane.
