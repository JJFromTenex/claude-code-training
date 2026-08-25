---
paths:
  - "src/components/**/*.tsx"
  - "src/app/**/*.tsx"
---

# Components

- **Use what is here.** `src/components/` already has Button, Input, Select, Dialog, Badge, and the rest, built on Tremor and Radix. Reach for those before adding a dependency or hand-rolling a control. There is no `Checkbox`, `RadioGroup`, or `Label` component — inside a dialog body, use native `<input type="checkbox">`/`<input type="radio">` in a labelled `<fieldset>`, not `DropdownMenu`'s `CheckboxItem`/`RadioItem`, which are menu-role widgets and invalid there.
- **Tailwind only.** No inline `style` attributes, no CSS modules.
- **Dialogs and forms must be operable.** Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it.
- **Format money here, not upstream.** Components receive minor units and a currency code and render the string.
- **Write the empty and error states.** A table with no rows and a request that failed both need something deliberate on screen.
- Keep data fetching out of components where a route handler already returns what you need.
