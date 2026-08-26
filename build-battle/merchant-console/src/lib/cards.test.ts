import { CardStatus } from "@/data/types"
import { describe, expect, it } from "vitest"
import {
  CARD_TRANSITIONS,
  TEST_BIN,
  canTransition,
  formatCardNumber,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
} from "./cards"

/** Every number here is on the 4242 test BIN, fixtures included. */

/** Deterministic digits, so a failure reproduces on every machine. */
const sequence = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe("luhnCheckDigit", () => {
  it("matches known-good vectors and rejects tampering", () => {
    // Bodies without their check digit: 4242424242424242 and 79927398713.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(luhnCheckDigit("7992739871")).toBe(3)
    expect(luhnCheckDigit("424242424242420")).toBe(0)

    expect(isValidLuhn("4242424242424242")).toBe(true)
    expect(isValidLuhn("79927398713")).toBe(true)
    expect(isValidLuhn("4242424242424243")).toBe(false)
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is sixteen digits on the test BIN with a valid check digit, always", () => {
    // Every digit the generator can draw, then many random draws.
    const numbers = [
      ...Array.from({ length: 10 }, (_, d) =>
        generateCardNumber(sequence([d / 10])),
      ),
      ...Array.from({ length: 200 }, () => generateCardNumber()),
    ]
    for (const n of numbers) {
      expect(n).toHaveLength(16)
      expect(n.startsWith(TEST_BIN)).toBe(true)
      expect(isValidLuhn(n)).toBe(true)
    }
  })

  it("rejects any single-digit tamper, so the checksum is really Luhn", () => {
    const n = generateCardNumber(sequence([0.3, 0.7, 0.1]))
    for (let i = 0; i < n.length; i++) {
      const wrong = String((Number(n[i]) + 1) % 10)
      expect(isValidLuhn(n.slice(0, i) + wrong + n.slice(i + 1))).toBe(false)
    }
  })
})

describe("display and the state machine", () => {
  it("masks to the last four, and groups only on the reveal screen", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242")
  })

  it("covers every transition pair, so nothing is undecided", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    const allowed = statuses.flatMap((from) =>
      statuses
        .filter((to) => canTransition(from, to))
        .map((to) => `${from}>${to}`),
    )
    // active ⇄ frozen, either to cancelled, and cancelled is terminal.
    expect(allowed.sort()).toEqual([
      "active>cancelled",
      "active>frozen",
      "frozen>active",
      "frozen>cancelled",
    ])
    expect(CARD_TRANSITIONS.cancelled).toHaveLength(0)
  })
})
