# /ship-ready

Run a pre-ship quality check on the current project. Scan all HTML, CSS, and JS files in this directory and report issues.

## Checks to Run

1. **TODO/FIXME scan** — Find any TODO, FIXME, HACK, or XXX comments. List each with file and line number.
2. **Console.log audit** — Find any `console.log`, `console.warn`, `console.error` statements that shouldn't ship. List each.
3. **Missing JSDoc** — Find any JavaScript function that lacks a JSDoc comment. List the function name and file.
4. **Accessibility basics** — Check that all `<img>` tags have `alt` attributes, all form inputs have labels, and heading levels don't skip.
5. **Inline style check** — Flag any `style=` attributes in HTML files.

## Output Format

Print a summary report with:
- A pass/fail status for each check
- Total issue count
- List of specific issues found, grouped by check

If all checks pass, print: "Ship it. All checks passed."
If any checks fail, print: "Hold — X issues to fix before shipping." followed by the details.
