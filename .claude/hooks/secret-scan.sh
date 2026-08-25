#!/usr/bin/env bash
# UserPromptSubmit — stop a live credential from entering the transcript.
#
# High-confidence prefixes only. A scanner that fires on anything that looks
# vaguely like a key gets switched off within the hour, which protects nothing.
set -uo pipefail

HOOK_PAYLOAD=$(cat)
export HOOK_PAYLOAD

python3 <<'PY'
import json, os, re, sys

try:
    prompt = json.loads(os.environ.get("HOOK_PAYLOAD") or "{}").get("prompt", "")
except Exception:
    sys.exit(0)

PATTERNS = {
    "AWS access key id": r"\bAKIA[0-9A-Z]{16}\b",
    "GitHub token": r"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
    "Slack token": r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b",
    "OpenAI-style key": r"\bsk-[A-Za-z0-9]{32,}\b",
    "Private key block": r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----",
}

found = [label for label, pattern in PATTERNS.items() if re.search(pattern, prompt)]

if found:
    print(
        f"Prompt blocked: it appears to contain a live credential ({', '.join(found)}).\n"
        "Rotate it if it is real, then resend without the secret.",
        file=sys.stderr,
    )
    sys.exit(2)
PY
