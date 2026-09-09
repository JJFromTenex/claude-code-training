/**
 * The two-click cancel, as a reducer.
 *
 * Cancelling a card is terminal, so the first click only arms the button and
 * the second one commits. The rules for when it disarms again are the fiddly
 * part, so they live here as a pure function with a test beside them rather
 * than as conditions scattered through an event handler.
 */

export interface CancelState {
  armed: boolean
}

export type CancelEvent =
  /** The operator clicked or pressed Enter on Cancel. */
  | { type: "arm" }
  /** Escape, while focus is still inside the row. */
  | { type: "escape" }
  /** Focus left the button. `toRow` is true if it stayed inside the row. */
  | { type: "blur"; toRow: boolean }
  /** The five-second arming window elapsed. */
  | { type: "timeout" }
  /** The request settled, either way. */
  | { type: "settled" }

export const idle: CancelState = { armed: false }

export function cancelConfirm(
  state: CancelState,
  event: CancelEvent,
): CancelState {
  switch (event.type) {
    case "arm":
      return { armed: true }
    case "blur":
      // Moving to Freeze in the same row is still working on this card, so the
      // confirm stays up. Anywhere else — including nowhere, which is what a
      // click on blank space looks like — puts it away.
      return { armed: state.armed && event.toRow }
    case "escape":
    case "timeout":
    case "settled":
      return idle
  }
}

/** Whether this click should send the cancel or only arm the button. */
export function isConfirming(state: CancelState): boolean {
  return state.armed
}
