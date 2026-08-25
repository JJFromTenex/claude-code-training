import { describe, expect, it } from "vitest"
import {
  ALLOWED_TRANSITIONS,
  CARD_STATUSES,
  MAX_SPEND_LIMIT,
  canTransition,
} from "./cards"

/**
 * The state machine is the rule most likely to be quietly broken by a UI
 * change: a button that offers the wrong action looks the same as one that
 * offers the right one. `canTransition` is the only description of it, so it
 * is the thing worth pinning down.
 *
 * These tests cover the transition table itself rather than `setCardStatus`,
 * which mutates the shared in-memory store and would leak state between runs.
 */

describe("canTransition", () => {
  it("freezes and unfreezes an active card", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    // Nothing comes back from cancelled, including cancelled itself.
    for (const status of CARD_STATUSES) {
      expect(canTransition("cancelled", status)).toBe(false)
    }
  })

  it("does not offer a transition to the state a card is already in", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("ALLOWED_TRANSITIONS", () => {
  it("covers every status with no route to an unknown one", () => {
    for (const status of CARD_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined()
      for (const target of ALLOWED_TRANSITIONS[status]) {
        expect(CARD_STATUSES).toContain(target)
      }
    }
  })
})

describe("MAX_SPEND_LIMIT", () => {
  it("is five million minor units, not five million major ones", () => {
    // $50,000.00, per the ticket. Getting this wrong by a factor of 100 is
    // the exact mistake the minor-units convention exists to prevent.
    expect(MAX_SPEND_LIMIT).toBe(5_000_000)
  })
})
