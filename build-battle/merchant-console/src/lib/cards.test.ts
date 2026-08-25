import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import { canTransition, maskCardNumber } from "./cards"

describe("canTransition", () => {
  const cases: [CardStatus, CardStatus, boolean][] = [
    ["active", "frozen", true],
    ["active", "cancelled", true],
    ["active", "active", false],
    ["frozen", "active", true],
    ["frozen", "cancelled", true],
    ["frozen", "frozen", false],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["cancelled", "cancelled", false],
  ]

  it.each(cases)("%s → %s should be %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected)
  })
})

describe("maskCardNumber", () => {
  it("formats last4 as a masked card number", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})
