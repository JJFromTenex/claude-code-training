#!/usr/bin/env bash
# PreToolUse(Bash) — refuse `git push` while the merchant-console suite is red.
#
# The README names this as the obvious hook for this repo: a push that breaks
# the suite costs the reviewer more than it costs you to wait ten seconds.
set -uo pipefail

command_line=$(python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null)

case "$command_line" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

app="${CLAUDE_PROJECT_DIR:-.}/build-battle/merchant-console"

# Dependencies missing is a setup problem, not a red suite. Do not block on it.
[ -d "$app/node_modules" ] || exit 0

if ! output=$(cd "$app" && npm test --silent 2>&1); then
  {
    echo "Push blocked: npm test is failing in build-battle/merchant-console."
    echo "Fix the suite, or push with --no-verify equivalent intent by disabling this hook."
    echo
    echo "$output" | tail -25
  } >&2
  exit 2
fi

exit 0
