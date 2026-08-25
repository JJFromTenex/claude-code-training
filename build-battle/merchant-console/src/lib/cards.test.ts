import { describe, expect, it } from "vitest"
import {
  TEST_BIN,
  allowedTransitions,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskLast4,
} from "./cards"
import { CardStatus } from "@/data/types"

/**
 * Two things here are load-bearing and neither fails loudly.
 *
 * A card number with a bad check digit looks completely normal until an issuer
 * rejects it, and a state machine that leaks one transition lets a cancelled
 * card come back to life. Both are cheap to assert and expensive to discover
 * in the console.
 *
 * Every number in this file sits on the 4242 test BIN. Nothing in this
 * repository may resemble a real PAN, fixtures included.
 */

/** A random source that walks a fixed list, so generation is reproducible. */
const cycling = (values: number[]) => {
  let index = 0
  return () => values[index++ % values.length]
}

const ALL_STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

describe("TEST_BIN", () => {
  it("is 4242 and is asserted as a literal, not against itself", () => {
    // Every other BIN assertion in this file uses the literal for the same
    // reason: comparing a generated number against the constant it was built
    // from passes no matter what the constant becomes.
    expect(TEST_BIN).toBe("4242")
  })
})

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a known test number", () => {
    // 4242424242424242 is the canonical test number; drop its last digit and
    // the check digit that comes back has to be the 2 we removed.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns a single digit for any partial", () => {
    for (const partial of ["4242", "42424242", "424242424242424"]) {
      const digit = luhnCheckDigit(partial)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isLuhnValid", () => {
  it("accepts a number carrying its correct check digit", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number whose check digit was tampered with", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects a transposition, which is what Luhn exists to catch", () => {
    // Same digits as the valid number above, two of them swapped.
    expect(isLuhnValid("4242424242424422")).toBe(false)
  })

  it("rejects anything that is not digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
    expect(isLuhnValid("nope")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("produces sixteen digits on the test BIN with a valid check digit", () => {
    const number = generateCardNumber(cycling([0.1, 0.5, 0.9]))
    expect(number).toHaveLength(16)
    expect(number.startsWith("4242")).toBe(true)
    expect(/^\d{16}$/.test(number)).toBe(true)
    expect(isLuhnValid(number)).toBe(true)
  })

  it("holds those invariants across a thousand numbers", () => {
    // The check digit is arithmetic, so a bug here shows up on some inputs and
    // not others. Volume is the only honest way to assert it.
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("survives a random source pinned to either extreme", () => {
    for (const source of [cycling([0]), cycling([0.999999999])]) {
      const number = generateCardNumber(source)
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is reproducible for a given random source", () => {
    const values = [0.3, 0.7, 0.1, 0.9, 0.5]
    expect(generateCardNumber(cycling(values))).toBe(
      generateCardNumber(cycling(values)),
    )
  })

  it("does not return the same number twice in a row", () => {
    expect(generateCardNumber()).not.toBe(generateCardNumber())
  })
})

describe("lastFour and maskLast4", () => {
  it("takes the trailing four digits", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
    expect(lastFour("4242103613905175")).toBe("5175")
  })

  it("masks to the form the console shows everywhere but the reveal", () => {
    expect(maskLast4("5175")).toBe("•••• 5175")
  })
})

describe("canTransition", () => {
  it("moves a card between active and frozen in both directions", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    // The one that matters. Nothing comes back from cancelled, including
    // cancelled itself, so a replayed request cannot revive a dead card.
    for (const to of ALL_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("refuses a move to the status a card is already in", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it("allows exactly four transitions out of the nine possible pairs", () => {
    const allowed = ALL_STATUSES.flatMap((from) =>
      ALL_STATUSES.filter((to) => canTransition(from, to)).map(
        (to) => `${from}->${to}`,
      ),
    )
    expect(allowed.sort()).toEqual([
      "active->cancelled",
      "active->frozen",
      "frozen->active",
      "frozen->cancelled",
    ])
  })
})

describe("allowedTransitions", () => {
  it("reports what each state can reach", () => {
    expect([...allowedTransitions("active")].sort()).toEqual([
      "cancelled",
      "frozen",
    ])
    expect([...allowedTransitions("frozen")].sort()).toEqual([
      "active",
      "cancelled",
    ])
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("agrees with canTransition", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(allowedTransitions(from).includes(to)).toBe(
          canTransition(from, to),
        )
      }
    }
  })
})
