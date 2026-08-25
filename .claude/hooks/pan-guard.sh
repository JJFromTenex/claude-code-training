#!/usr/bin/env bash
# PreToolUse(Write|Edit) — refuse a card-like number that is not on the 4242 test BIN.
#
# `.claude/rules/cards.md`: "Nothing here may resemble a real PAN, ever,
# including in tests and fixtures." A rule that matters that much should not
# depend on anyone remembering it, so this enforces it before the write lands.
set -uo pipefail

HOOK_PAYLOAD=$(cat)
export HOOK_PAYLOAD

python3 <<'PY'
import json, os, re, sys

try:
    payload = json.loads(os.environ.get("HOOK_PAYLOAD") or "{}")
except Exception:
    sys.exit(0)

tool_input = payload.get("tool_input", {})
text = " ".join(
    json.dumps(tool_input.get(key)) if not isinstance(tool_input.get(key), str)
    else tool_input.get(key)
    for key in ("content", "new_string", "edits")
    if tool_input.get(key)
)
if not text:
    sys.exit(0)


def luhn_ok(digits: str) -> bool:
    total, alternate = 0, False
    for char in reversed(digits):
        value = int(char)
        if alternate:
            value *= 2
            if value > 9:
                value -= 9
        total += value
        alternate = not alternate
    return total % 10 == 0


offenders = []
for match in re.finditer(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)", text):
    digits = re.sub(r"[ -]", "", match.group())
    if not (13 <= len(digits) <= 19):
        continue
    if not luhn_ok(digits):
        continue  # a long number, not a card number
    if digits.startswith("4242"):
        continue  # the test BIN, the only one allowed here
    offenders.append(digits[:4] + "…" + digits[-4:])

if offenders:
    print(
        "Write blocked: card-like number outside the 4242 test BIN "
        f"({', '.join(offenders)}).\n"
        "See .claude/rules/cards.md - generated numbers use the 4242 BIN with a "
        "valid Luhn check digit, in fixtures and tests too.",
        file=sys.stderr,
    )
    sys.exit(2)
PY
