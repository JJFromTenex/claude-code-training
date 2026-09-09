/**
 * The two-click cancel. Cancelling is terminal, so the first click arms and
 * the second commits. When it disarms again is the fiddly part, so it lives
 * here as a pure function with a test rather than scattered through a handler.
 */

export interface CancelState {
  armed: boolean
}

export type CancelEvent =
  | { type: "arm" }
  | { type: "escape" }
  /** Focus left the button. `toRow` is true if it stayed inside the row. */
  | { type: "blur"; toRow: boolean }
  | { type: "timeout" }
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
      // Moving to Freeze in the same row is still this card, so the confirm
      // stays up. Anywhere else — including nowhere, which is what a click on
      // blank space looks like — puts it away.
      return { armed: state.armed && event.toRow }
    case "escape":
    case "timeout":
    case "settled":
      return idle
  }
}

/** Whether this click sends the cancel or only arms the button. */
export const isConfirming = (state: CancelState): boolean => state.armed
