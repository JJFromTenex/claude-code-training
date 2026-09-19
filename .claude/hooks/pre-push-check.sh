#!/usr/bin/env bash
# PreToolUse hook on the Bash tool.
#
# Guards `git push`: runs the merchant console's tests and build first, and
# blocks the push if either fails. Any other Bash command passes straight
# through untouched.
#
# Claude Code invokes this with the tool call as JSON on stdin:
#   {"session_id": "...", "tool_name": "Bash", "tool_input": {"command": "..."}}
# To block a PreToolUse call, print
#   {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", ...}}
# on stdout and exit 0. No output (or permissionDecision "allow") lets it through.

set -euo pipefail

INPUT="$(cat)"

# Parsed with node rather than jq: node is guaranteed here (this project
# requires it to run at all), jq is not installed in every dev environment.
COMMAND="$(node -e '
  let data = "";
  process.stdin.on("data", (c) => { data += c; });
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(data);
      process.stdout.write(
        (input.tool_input && input.tool_input.command) || "",
      );
    } catch {
      process.stdout.write("");
    }
  });
' <<< "$INPUT")"

# Match `git push` as its own command, whether standalone or chained with
# && / ; / | / a subshell — not merely mentioned inside other text.
if ! printf '%s' "$COMMAND" | grep -Eq '(^|[;&|]|`|\$\()[[:space:]]*git[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$REPO_ROOT/build-battle/merchant-console"
LOG_DIR="${TMPDIR:-/tmp}"
TEST_LOG="$LOG_DIR/claude-pre-push-test.log"
BUILD_LOG="$LOG_DIR/claude-pre-push-build.log"

cd "$APP_DIR"

TEST_OK=1
BUILD_OK=1

npm test > "$TEST_LOG" 2>&1 || TEST_OK=0
npm run build > "$BUILD_LOG" 2>&1 || BUILD_OK=0

if [ "$TEST_OK" -eq 1 ] && [ "$BUILD_OK" -eq 1 ]; then
  node -e 'console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "npm test and npm run build both passed.",
    },
  }))'
  exit 0
fi

FAILED=""
if [ "$TEST_OK" -eq 0 ]; then FAILED="tests"; fi
if [ "$BUILD_OK" -eq 0 ]; then
  if [ -n "$FAILED" ]; then FAILED="$FAILED and build"; else FAILED="build"; fi
fi

REASON="Push blocked: $FAILED failed in build-battle/merchant-console."
if [ "$TEST_OK" -eq 0 ]; then REASON="$REASON See \`npm test\` output: $TEST_LOG."; fi
if [ "$BUILD_OK" -eq 0 ]; then REASON="$REASON See \`npm run build\` output: $BUILD_LOG."; fi

node -e '
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: process.argv[1],
    },
  }));
' "$REASON"

exit 0
