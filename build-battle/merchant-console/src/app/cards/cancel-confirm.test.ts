import { describe, expect, it } from "vitest"
import {
  cancelConfirm,
  CancelState,
  idle,
  isConfirming,
} from "./cancel-confirm"

/** Cancelling is terminal, so the guard in front of it has to behave. */

const armed: CancelState = { armed: true }

describe("cancelConfirm", () => {
  it("starts disarmed and arms on the first click", () => {
    expect(isConfirming(idle)).toBe(false)
    expect(cancelConfirm(idle, { type: "arm" })).toEqual(armed)
    expect(isConfirming(armed)).toBe(true)
  })

  it("stays armed when focus moves within the row", () => {
    expect(cancelConfirm(armed, { type: "blur", toRow: true })).toEqual(armed)
  })

  it("disarms when focus leaves the row", () => {
    expect(cancelConfirm(armed, { type: "blur", toRow: false })).toEqual(idle)
  })

  it("disarms on Escape, on timeout, and once the request settles", () => {
    expect(cancelConfirm(armed, { type: "escape" })).toEqual(idle)
    expect(cancelConfirm(armed, { type: "timeout" })).toEqual(idle)
    expect(cancelConfirm(armed, { type: "settled" })).toEqual(idle)
  })

  it("never arms itself from a blur", () => {
    expect(cancelConfirm(idle, { type: "blur", toRow: true })).toEqual(idle)
  })
})
