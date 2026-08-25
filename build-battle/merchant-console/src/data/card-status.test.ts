import { describe, expect, it } from "vitest"
import {
  CARD_STATUSES,
  allowedTransitions,
  canTransition,
  eventTypeFor,
  isCardStatus,
  isTerminal,
  transitionError,
} from "./card-status"
import { CardStatus } from "./types"

/**
 * The state machine is guarded on the server, so these tests stand in for the
 * hand-made request nobody will remember to try in the browser.
 */

describe("canTransition", () => {
  it("lets an active card freeze and a frozen card come back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets either live status cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
    expect(isTerminal("cancelled")).toBe(true)
  })

  it("does not count staying put as a transition", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it("allows nothing outside the declared table", () => {
    // Every legal edge, enumerated. Anything else must be refused.
    const legal = new Set([
      "active>frozen",
      "active>cancelled",
      "frozen>active",
      "frozen>cancelled",
    ])
    for (const from of CARD_STATUSES) {
      for (const to of CARD_STATUSES) {
        expect(canTransition(from, to)).toBe(legal.has(`${from}>${to}`))
      }
    }
  })
})

describe("allowedTransitions", () => {
  it("reports what a card can do next", () => {
    expect(allowedTransitions("active")).toEqual(["frozen", "cancelled"])
    expect(allowedTransitions("frozen")).toEqual(["active", "cancelled"])
    expect(allowedTransitions("cancelled")).toEqual([])
  })
})

describe("isCardStatus", () => {
  it("accepts the three real statuses", () => {
    expect(isCardStatus("active")).toBe(true)
    expect(isCardStatus("frozen")).toBe(true)
    expect(isCardStatus("cancelled")).toBe(true)
  })

  it("rejects anything else arriving from a client", () => {
    for (const value of ["deleted", "ACTIVE", "", null, undefined, 1, {}]) {
      expect(isCardStatus(value)).toBe(false)
    }
  })
})

describe("eventTypeFor", () => {
  it("names the audit event for each legal move", () => {
    expect(eventTypeFor("active", "frozen")).toBe("frozen")
    expect(eventTypeFor("frozen", "active")).toBe("unfrozen")
    expect(eventTypeFor("active", "cancelled")).toBe("cancelled")
    expect(eventTypeFor("frozen", "cancelled")).toBe("cancelled")
  })

  it("names nothing for an illegal move", () => {
    expect(eventTypeFor("cancelled", "active")).toBeNull()
    expect(eventTypeFor("active", "active")).toBeNull()
  })
})

describe("transitionError", () => {
  it("explains a terminal card in words an operator can act on", () => {
    expect(transitionError("cancelled", "active")).toMatch(/permanent/i)
  })

  it("explains a no-op", () => {
    expect(transitionError("frozen", "frozen" as CardStatus)).toMatch(
      /already frozen/i,
    )
  })
})
