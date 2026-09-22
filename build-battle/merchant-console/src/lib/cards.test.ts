import { describe, expect, it } from "vitest"
import {
  canTransition,
  checkIssue,
  checkTransition,
  generateCardNumber,
  generateCardReference,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  MAX_SPEND_LIMIT,
  spendRatio,
  TEST_BIN,
} from "./cards"

/**
 * A card number that fails Luhn is a card that never works, and a status
 * machine that leaks is a cancelled card coming back to life. Both are
 * cheaper to catch here than in the console.
 */

const merchantExists = (id: string) => id === "mch_01"

const validIssue = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: 25000,
  currency: "USD",
  merchantExists,
}

/** Deterministic stand-in for Math.random, cycling a fixed sequence. */
const seeded = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a known number", () => {
    // 4242424242424242 is the canonical test card: body + check digit 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("produces a digit, always", () => {
    for (const partial of ["424242424242424", "400000000000000", "1"]) {
      const digit = luhnCheckDigit(partial)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical test number", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a tampered digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts on the 4242 test BIN", () => {
    expect(generateCardNumber(seeded([0.5]))).toMatch(/^4242/)
  })

  it("is sixteen digits", () => {
    expect(generateCardNumber(seeded([0.1, 0.9, 0.4]))).toHaveLength(16)
  })

  it("passes its own Luhn check", () => {
    expect(isLuhnValid(generateCardNumber(seeded([0.3, 0.7, 0.2])))).toBe(true)
  })

  it("passes Luhn across many random numbers, not just a lucky one", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("generateCardReference", () => {
  it("is opaque and carries no part of a number", () => {
    const reference = generateCardReference(seeded([0.5, 0.2, 0.8]))
    expect(reference).toMatch(/^cardref_/)
    expect(reference).not.toContain("4242")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to swap", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it.each([["active" as const], ["frozen" as const], ["cancelled" as const]])(
    "never leaves cancelled, not even to %s",
    (to) => {
      expect(canTransition("cancelled", to)).toBe(false)
    },
  )
})

describe("checkTransition", () => {
  it("accepts freezing an active card", () => {
    expect(checkTransition("active", "frozen")).toEqual({
      ok: true,
      status: "frozen",
    })
  })

  it("refuses to move a cancelled card", () => {
    expect(checkTransition("cancelled", "active")).toEqual({
      ok: false,
      message: "A cancelled card cannot change status.",
    })
  })

  it("refuses a no-op rather than pretending something happened", () => {
    expect(checkTransition("active", "active")).toEqual({
      ok: false,
      message: "This card is already active.",
    })
  })

  it.each([["deleted"], [""], [null], [42], [{}]])(
    "refuses an unrecognized status (%s)",
    (to) => {
      expect(checkTransition("active", to).ok).toBe(false)
    },
  )

  it("checks the terminal state before anything the client sent", () => {
    expect(checkTransition("cancelled", "nonsense")).toEqual({
      ok: false,
      message: "That card status is not recognized.",
    })
  })
})

describe("checkIssue", () => {
  it("accepts a valid request and returns the checked values", () => {
    expect(checkIssue(validIssue)).toEqual({
      ok: true,
      nickname: "Ad spend",
      merchantId: "mch_01",
      spendLimit: 25000,
      currency: "USD",
    })
  })

  it("trims the nickname it returns", () => {
    const check = checkIssue({ ...validIssue, nickname: "  Ad spend  " })
    expect(check).toMatchObject({ ok: true, nickname: "Ad spend" })
  })

  it.each([[""], ["   "], [null], [42]])(
    "refuses a missing nickname (%s)",
    (nickname) => {
      expect(checkIssue({ ...validIssue, nickname }).ok).toBe(false)
    },
  )

  it("refuses a merchant that does not exist", () => {
    expect(checkIssue({ ...validIssue, merchantId: "mch_nope" })).toEqual({
      ok: false,
      message: "Choose a merchant for this card.",
    })
  })

  it.each([[0], [-1], [-25000]])("refuses a limit of %s", (spendLimit) => {
    expect(checkIssue({ ...validIssue, spendLimit }).ok).toBe(false)
  })

  it("refuses a limit that is not an integer number of minor units", () => {
    expect(checkIssue({ ...validIssue, spendLimit: 250.5 }).ok).toBe(false)
    expect(checkIssue({ ...validIssue, spendLimit: "25000" }).ok).toBe(false)
  })

  it("accepts a limit at exactly the cap", () => {
    expect(checkIssue({ ...validIssue, spendLimit: MAX_SPEND_LIMIT }).ok).toBe(
      true,
    )
  })

  it("refuses a limit one minor unit above the cap", () => {
    expect(
      checkIssue({ ...validIssue, spendLimit: MAX_SPEND_LIMIT + 1 }),
    ).toEqual({ ok: false, message: "That spend limit is above the cap." })
  })

  it.each([["JPY"], ["usd"], [""], [null]])(
    "refuses the currency %s",
    (currency) => {
      expect(checkIssue({ ...validIssue, currency }).ok).toBe(false)
    },
  )
})

describe("spendRatio", () => {
  it("is zero on a fresh card", () => {
    expect(spendRatio({ spent: 0, spendLimit: 25000 })).toBe(0)
  })

  it("reports the share of the limit spent", () => {
    expect(spendRatio({ spent: 20000, spendLimit: 25000 })).toBe(0.8)
  })

  it("never exceeds one, even if spend somehow passes the limit", () => {
    expect(spendRatio({ spent: 30000, spendLimit: 25000 })).toBe(1)
  })

  it("does not divide by a zero limit", () => {
    expect(spendRatio({ spent: 100, spendLimit: 0 })).toBe(0)
  })
})
