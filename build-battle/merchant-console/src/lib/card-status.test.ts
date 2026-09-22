import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  canTransition,
  CARD_ACTIONS,
  isCardAction,
  statusForAction,
} from "./card-status"

/**
 * Cancelled is terminal, and that is the assertion that matters: a cancelled
 * card coming back to active would be a live spending instrument the ops team
 * believes is dead. The rest of the table is here so a careless edit to it
 * fails loudly instead of quietly widening what a client can do.
 */

describe("canTransition", () => {
  it("allows freezing and unfreezing", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows cancelling from either live status", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("refuses every move out of cancelled", () => {
    const targets: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const target of targets) {
      expect(canTransition("cancelled", target)).toBe(false)
    }
  })

  it("refuses standing still", () => {
    // Re-freezing a frozen card is a no-op the UI should not offer and the
    // server should not accept, so it is refused rather than silently allowed.
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("isCardAction", () => {
  it("accepts the three action names", () => {
    for (const action of CARD_ACTIONS) {
      expect(isCardAction(action)).toBe(true)
    }
  })

  it("rejects anything else a client might send", () => {
    // `in` on the lookup object would have accepted "toString" here.
    expect(isCardAction("toString")).toBe(false)
    expect(isCardAction("delete")).toBe(false)
    expect(isCardAction(undefined)).toBe(false)
  })
})

describe("statusForAction", () => {
  it("maps each action to the status it targets", () => {
    expect(statusForAction("freeze")).toBe("frozen")
    expect(statusForAction("unfreeze")).toBe("active")
    expect(statusForAction("cancel")).toBe("cancelled")
  })
})
