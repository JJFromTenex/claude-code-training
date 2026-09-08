/**
 * When the armed "Confirm cancel" button disarms itself, as a pure decision so
 * the focus rules can be tested without a DOM. The rule that is easy to get
 * wrong in a browser: focus moving to a sibling button in the same row is the
 * operator still deciding, so that blur alone keeps the button armed. Every
 * other blur means focus left the row — a click on blank space and the window
 * losing focus both arrive as a blur with no related target — and a
 * destructive button nobody is looking at must not sit one click from firing.
 * The 5s timeout covers the rest.
 */

/** The one thing the blur rule needs from the row's container element. */
type FocusScope = { contains(node: unknown): boolean }

export type CancelConfirmEvent =
  | { type: "arm" }
  | { type: "blur"; container: FocusScope; relatedTarget: unknown }
  | { type: "escape" }
  | { type: "timeout" }
  | { type: "succeeded" }

export function cancelConfirmReducer(
  armed: boolean,
  event: CancelConfirmEvent,
): boolean {
  switch (event.type) {
    case "arm":
      return true
    // `contains` answers false for a null related target, which is the point:
    // focus going nowhere is focus leaving the row.
    case "blur":
      return armed && event.container.contains(event.relatedTarget)
    case "escape":
    case "timeout":
    case "succeeded":
      return false
  }
}
