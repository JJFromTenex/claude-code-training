#!/usr/bin/env bash
#
# PreToolUse guard on the Bash tool: nothing gets pushed until the merchant
# console's tests and build both pass.
#
# Reads the hook payload on stdin. Commands that are not a git push are
# allowed through untouched, so this runs on every Bash call and must stay
# cheap in the common case.
#
# Fails closed: if the check cannot run, the push is blocked rather than
# waved through. A guard that silently allows is worse than no guard.

set -uo pipefail

APP_DIR="build-battle/merchant-console"
LOG_DIR="${TMPDIR:-/tmp}/northwind-pre-push"

# Emit a PreToolUse deny decision and stop. Exit 0 is correct here: the JSON
# carries the decision, a non-zero exit would be reported as a hook error.
deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    },
    systemMessage: $reason
  }'
  exit 0
}

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"

# Matches `git push`, `git -C dir push`, and `cd x && git push`, while leaving
# `git log --grep push` and `git commit -m push` alone.
#
# The flag group has to spell out the globals that take a separate value. A
# looser "any token between git and push" rule also matches
# `git log --grep push`; a stricter "flags only" rule misses
# `git -C dir push`, which is how this first shipped.
GIT_FLAG='([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+|[[:space:]]+--(git-dir|work-tree|namespace|exec-path)(=[^[:space:]]+|[[:space:]]+[^[:space:]]+)|[[:space:]]+-[^[:space:]]+)'
GIT_PUSH_RE="(^|[;&|(]|[[:space:]])git${GIT_FLAG}*[[:space:]]+push([[:space:]]|\$)"

if ! printf '%s' "$cmd" | grep -Eq "$GIT_PUSH_RE"; then
  exit 0
fi

# A dry run touches no remote, so it needs no gate.
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--dry-run([[:space:]]|$)'; then
  exit 0
fi

command -v npm >/dev/null 2>&1 ||
  deny "Push blocked: npm is not on PATH, so the pre-push check could not verify anything."

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$repo_root" ] ||
  deny "Push blocked: not inside a git repository, so the pre-push check could not run."

cd "$repo_root/$APP_DIR" 2>/dev/null ||
  deny "Push blocked: could not enter $APP_DIR, so tests and build could not run."

mkdir -p "$LOG_DIR"
test_log="$LOG_DIR/test.log"
build_log="$LOG_DIR/build.log"

if ! npm test >"$test_log" 2>&1; then
  deny "$(printf 'Push blocked: TESTS FAILED (npm test).\n\nLast lines:\n%s\n\nFull output: %s\nReproduce: cd %s && npm test' \
    "$(tail -n 20 "$test_log")" "$test_log" "$APP_DIR")"
fi

if ! npm run build >"$build_log" 2>&1; then
  deny "$(printf 'Push blocked: BUILD FAILED (npm run build). Tests passed.\n\nLast lines:\n%s\n\nFull output: %s\nReproduce: cd %s && npm run build' \
    "$(tail -n 20 "$build_log")" "$build_log" "$APP_DIR")"
fi

# Both passed. Exit 0 with no decision so the normal permission flow continues
# rather than this hook granting the push an approval the user never gave.
exit 0
