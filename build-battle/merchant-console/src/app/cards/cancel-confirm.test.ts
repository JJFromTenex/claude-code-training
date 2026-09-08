import { describe, expect, it } from "vitest"
import { CancelConfirmEvent, cancelConfirmReducer } from "./cancel-confirm"

/**
 * The blur cases are the point: an armed destructive button that stays armed
 * after the operator has looked away is one click from cancelling a card by
 * accident, and that is invisible in a static read of the component.
 */

const row = { contains: (node: unknown) => node === "freeze-button" }
const blur = (relatedTarget: unknown): CancelConfirmEvent => ({
  type: "blur",
  container: row,
  relatedTarget,
})
const armed = cancelConfirmReducer(false, { type: "arm" })

describe("cancelConfirmReducer", () => {
  it.each<[string, boolean, CancelConfirmEvent, boolean]>([
    ["arms on the first click", false, { type: "arm" }, true],
    ["disarms when focus moves outside the row", armed, blur("some-other-row"), false],
    ["stays armed when focus moves to a sibling button in the row", armed, blur("freeze-button"), true],
    ["disarms on a blur with no related target (click on blank space)", armed, blur(null), false],
    ["never arms itself from a blur", false, blur("freeze-button"), false],
    ["disarms on Escape", armed, { type: "escape" }, false],
    ["disarms when the 5s timeout fires", armed, { type: "timeout" }, false],
    ["disarms once the cancel succeeds", armed, { type: "succeeded" }, false],
  ])("%s", (_name, armed, event, expected) => {
    expect(cancelConfirmReducer(armed, event)).toBe(expected)
  })
})
