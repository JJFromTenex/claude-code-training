import { describe, expect, it } from "vitest"
import { cancelConfirmReducer } from "./cancel-confirm"

/**
 * The blur cases are the point of this file: an armed destructive button that
 * stays armed after the operator has looked away is one click from cancelling
 * a card by accident, and that is invisible in a static read of the component.
 */

const row = { contains: (node: unknown) => node === "freeze-button" }

const armed = cancelConfirmReducer(false, { type: "arm" })

function blur(from: boolean, relatedTarget: unknown) {
  return cancelConfirmReducer(from, {
    type: "blur",
    container: row,
    relatedTarget,
  })
}

describe("cancelConfirmReducer", () => {
  it("arms on the first click", () => {
    expect(armed).toBe(true)
  })

  it("disarms when focus moves to an element outside the row", () => {
    expect(blur(armed, "some-other-row")).toBe(false)
  })

  it("stays armed when focus moves to a sibling button in the same row", () => {
    expect(blur(armed, "freeze-button")).toBe(true)
  })

  it("disarms on a blur with no related target, such as a click on blank space", () => {
    expect(blur(armed, null)).toBe(false)
  })

  it("never arms itself from a blur", () => {
    expect(blur(false, "freeze-button")).toBe(false)
  })

  it("disarms on Escape", () => {
    expect(cancelConfirmReducer(armed, { type: "escape" })).toBe(false)
  })

  it("disarms when the 5s timeout fires", () => {
    expect(cancelConfirmReducer(armed, { type: "timeout" })).toBe(false)
  })

  it("disarms once the cancel succeeds", () => {
    expect(cancelConfirmReducer(armed, { type: "succeeded" })).toBe(false)
  })
})
