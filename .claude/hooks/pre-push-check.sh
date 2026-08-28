#!/usr/bin/env bash
#
# PreToolUse hook on the Bash tool. Guards `git push`.
#
# Claude Code pipes the tool call to stdin as JSON. If the command is a
# git push, run the merchant console's tests and build; refuse the push
# if either fails. Everything that is not a push passes straight through.
#
# Exit 2 blocks the tool call. Whatever is on stderr is shown to Claude
# and to the user as the reason.

set -u

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

# Match `git push` anywhere in the command, including `cd x && git push`
# and `git -C path push`. Anything else is not our business.
if ! printf '%s' "$command" | grep -Eq '(^|[^[:alnum:]_./-])git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?push([[:space:]]|$)'; then
  exit 0
fi

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
app="$root/build-battle/merchant-console"
log="${TMPDIR:-/tmp}/northwind-pre-push.log"

if [ ! -f "$app/package.json" ]; then
  printf 'Push blocked: cannot find the merchant console at %s\n' "$app" >&2
  exit 2
fi

: > "$log"

refuse() {
  {
    printf 'Push blocked: %s failed.\n' "$1"
    printf 'Full output: %s\n' "$log"
    printf 'Last lines:\n'
    tail -n 15 "$log"
  } >&2
  exit 2
}

printf '== npm test ==\n' >> "$log"
( cd "$app" && npm test >> "$log" 2>&1 ) || refuse "npm test"

printf '\n== npm run build ==\n' >> "$log"
( cd "$app" && npm run build >> "$log" 2>&1 ) || refuse "npm run build"

exit 0
