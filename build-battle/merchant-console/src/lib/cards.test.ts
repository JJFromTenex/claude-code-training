import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  SPEND_LIMIT_MAX,
  TEST_BIN,
  allowedTransitions,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskedNumber,
  spendState,
} from "./cards"

/**
 * A card number that fails Luhn looks exactly like one that passes, and a
 * status machine that lets a cancelled card come back looks fine until an
 * ops user does it. Both are pinned here rather than eyeballed.
 */

/** Deterministic draw, so a failing generator case is reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe("luhnCheckDigit", () => {
  it("completes a number so it validates", () => {
    const partial = "424212345678901"
    expect(isLuhnValid(partial + luhnCheckDigit(partial))).toBe(true)
  })

  it("rejects the same number with any other check digit", () => {
    const partial = "424212345678901"
    const correct = luhnCheckDigit(partial)
    for (let digit = 0; digit <= 9; digit++) {
      if (String(digit) === correct) continue
      expect(isLuhnValid(partial + digit)).toBe(false)
    }
  })
})

describe("generateCardNumber", () => {
  it("puts every number on the test BIN, over many draws", () => {
    const random = seededRandom(20260828)
    for (let i = 0; i < 500; i++) {
      expect(generateCardNumber(random).startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("produces a valid check digit, over many draws", () => {
    const random = seededRandom(11)
    for (let i = 0; i < 500; i++) {
      expect(isLuhnValid(generateCardNumber(random))).toBe(true)
    }
  })

  it("is sixteen digits and nothing else", () => {
    const number = generateCardNumber(seededRandom(7))
    expect(number).toMatch(/^\d{16}$/)
  })

  it("does not return the same number twice in a row", () => {
    const random = seededRandom(3)
    expect(generateCardNumber(random)).not.toBe(generateCardNumber(random))
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    expect(lastFour("4242123456789018")).toBe("9018")
  })

  it("renders the mask ops sees everywhere but the reveal", () => {
    expect(maskedNumber("9018")).toBe("•••• 9018")
  })
})

describe("status transitions", () => {
  it("swaps between active and frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live status", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal, so nothing comes back", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    for (const to of statuses) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
    expect(allowedTransitions("cancelled")).toEqual([])
  })

  it("refuses a transition to the status already held", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("spendState", () => {
  it("reports nothing spent as an empty bar", () => {
    expect(spendState(0, 25000)).toEqual({
      percent: 0,
      warn: false,
      remaining: 25000,
    })
  })

  it("stays calm just under the warning threshold", () => {
    expect(spendState(19999, 25000).warn).toBe(false)
  })

  it("warns exactly at eighty percent, not after it", () => {
    expect(spendState(20000, 25000).warn).toBe(true)
  })

  it("clamps an overspent card to a full bar", () => {
    const state = spendState(30000, 25000)
    expect(state.percent).toBe(100)
    expect(state.remaining).toBe(0)
  })

  it("renders a zero limit as full rather than dividing by it", () => {
    expect(spendState(0, 0)).toEqual({ percent: 100, warn: true, remaining: 0 })
  })

  it("handles the largest limit ops may set", () => {
    expect(spendState(SPEND_LIMIT_MAX, SPEND_LIMIT_MAX).percent).toBe(100)
  })
})
