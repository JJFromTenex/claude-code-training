import { describe, expect, it } from "vitest"
import { CARD_TRANSITIONS, canTransition, maskCardNumber } from "./cards"

describe("card status transitions", () => {
  it("active ⇄ frozen, either → cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })
  it("cancelled is terminal and no-ops are not moves", () => {
    expect(CARD_TRANSITIONS.cancelled).toEqual([])
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("active", "active")).toBe(false)
  })
  it("masks to the last four", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})
