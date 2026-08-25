# `.claude/` — the three layers

Three mechanisms, split by **who decides**. That is the only distinction that
matters when you are choosing between them.

| Layer | Who decides | When it runs | Lives in |
| --- | --- | --- | --- |
| **Skill** | Claude, by reading the description | When Claude judges it relevant, or you type `/name` | `skills/<name>/SKILL.md` |
| **Subagent** | Claude, by delegating | When a job needs its own context window | `agents/<name>.md` |
| **Hook** | Nobody — the system | Every matching event, unconditionally | `hooks/*.sh` + `settings.json` |

Skills and subagents are advice: Claude can decide not to use them. Hooks are
not advice. A hook fires whether or not Claude thinks it should, which is why
anything that must hold — a rule you would not accept being broken once — belongs
in a hook rather than a paragraph of documentation.

## Skills — reusable knowledge

`epic`, `pr`, `ship-ready`, `northwind-pr`. Each turns a repeated task into a
written procedure so it does not depend on anyone remembering the steps.

The `description` field is load-bearing: it is what Claude matches against a
request when deciding whether the skill applies. A vague description means the
skill never fires on its own and only works when you type its name.

Two formats coexist here right now, which is worth knowing before you add one:

- `skills/northwind-pr/SKILL.md` — the Agent Skills format: a directory, a
  `SKILL.md`, and `name` + `description` frontmatter.
- `skills/epic.md`, `skills/pr.md`, `skills/ship-ready.md` — flat files with no
  frontmatter. `commands/` carries symlinks to these so they register as slash
  commands.

New skills should use the first form.

## Subagent — a separate context window

`agents/bug-investigator.md` diagnoses a bug and returns a written root cause.

The reason to reach for one is not politeness about context size; it is that a
long investigation fills the main window with file reads nobody needs
afterwards. The subagent burns its own context and hands back a conclusion.

Note its frontmatter:

```yaml
tools: Read, Grep, Glob
```

That is the guardrail, and it is stronger than an instruction. The investigator
is told not to fix anything, and it also *cannot* — the tools to do so are not
in its list. Prefer restricting tools over asking nicely, for the same reason
you prefer a hook over documentation.

## Hooks — the rules that cannot be skipped

Wired in `settings.json`. All three exit `2` to block, with the reason on
stderr.

| Hook | Event | What it stops |
| --- | --- | --- |
| `secret-scan.sh` | `UserPromptSubmit` | A live credential entering the transcript. AWS / GitHub / Slack / OpenAI-style keys and private key blocks |
| `test-gate.sh` | `PreToolUse(Bash)` | `git push` while `npm test` is red. Other Bash commands pass through untouched |
| `pan-guard.sh` | `PreToolUse(Write\|Edit\|MultiEdit)` | Writing a card-like number outside the `4242` test BIN — Luhn-checked, so long non-card numbers pass |

Each is deliberately narrow. `secret-scan.sh` matches high-confidence prefixes
only, and `test-gate.sh` ignores every Bash command that is not a push, because
a hook that fires on things it should not is a hook someone turns off within
the hour — and a disabled hook protects nothing.

`test-gate.sh` exits `0` when `node_modules` is missing: dependencies not being
installed is a setup problem, not a red suite, and blocking there would strand
someone before they had run anything.

### How the layers meet

- **Hooks fire inside subagents too.** A subagent that tries to write a real PAN
  is stopped by `pan-guard.sh` exactly as the main thread would be. The
  isolation is about context, not permissions.
- **Hooks enforce what skills describe.** `ship-ready` checks money handling,
  UTC bucketing, query reuse, and input validation, and reports what it finds.
  It is a report, so it can be ignored. Where a check earns enforcement, it
  moves into a hook — `pan-guard.sh` is the card-masking rule from
  `rules/cards.md` after that promotion.

## Adding a hook

1. Write the script in `hooks/`, read the event JSON from **stdin**, `chmod +x`.
2. Register it in `settings.json` under its event, with a `matcher` when the
   event has one.
3. Test it by piping the payload in by hand, before trusting it live:

```bash
printf '%s' '{"tool_input":{"command":"git push"}}' | .claude/hooks/test-gate.sh; echo "exit=$?"
```

A hook that reads its payload from a heredoc instead of stdin silently sees
nothing and exits `0` — it looks installed and enforces nothing. Test both the
pass case and the block case, and confirm the block case actually returns `2`.
