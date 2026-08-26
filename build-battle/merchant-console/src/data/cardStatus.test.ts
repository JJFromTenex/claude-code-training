import { describe, expect, it } from "vitest"
import { canTransitionCardStatus } from "./cardStatus"
import { CardStatus } from "./types"

const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

const ALLOWED: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

describe("canTransitionCardStatus", () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = ALLOWED[from].includes(to)
      it(`${from} -> ${to} is ${expected ? "allowed" : "rejected"}`, () => {
        expect(canTransitionCardStatus(from, to)).toBe(expected)
      })
    }
  }

  it("treats cancelled as terminal — nothing comes back from it", () => {
    for (const to of STATUSES) {
      expect(canTransitionCardStatus("cancelled", to)).toBe(false)
    }
  })
})
