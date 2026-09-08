import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskedNumber,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("returns the digit that makes the full number pass Luhn", () => {
    // 4242 4242 4242 424 → check digit 2 → 4242424242424242 (a canonical test PAN)
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("agrees with isValidLuhn on the number it built", () => {
    const body = "424212345678901"
    const full = body + luhnCheckDigit(body).toString()
    expect(isValidLuhn(full)).toBe(true)
  })
})

describe("generateCardNumber", () => {
  it("returns a 16-digit number on the 4242 BIN", () => {
    const { full } = generateCardNumber(() => 0.5)
    expect(full).toHaveLength(CARD_NUMBER_LENGTH)
    expect(full.startsWith(TEST_BIN)).toBe(true)
    expect(/^\d+$/.test(full)).toBe(true)
  })

  it("passes Luhn for every result across many runs", () => {
    // Deterministic seed so failures reproduce; still covers the full digit space.
    let seed = 1
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32
      return seed / 2 ** 32
    }
    for (let i = 0; i < 200; i++) {
      const { full } = generateCardNumber(rand)
      expect(isValidLuhn(full)).toBe(true)
      expect(full.startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("last4 matches the last four digits of the full number", () => {
    const { full, last4 } = generateCardNumber(() => 0.1)
    expect(last4).toBe(full.slice(-4))
    expect(last4).toHaveLength(4)
  })

  it("emits an opaque reference that is not the full number", () => {
    const { full, reference } = generateCardNumber(() => 0.3)
    expect(reference).not.toContain(full)
    expect(reference.startsWith("cref_")).toBe(true)
  })
})

describe("canTransition", () => {
  it("allows active ⇄ frozen and both to cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal — nothing comes back from it", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition back to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("maskedNumber", () => {
  it("emits •••• followed by the last four", () => {
    expect(maskedNumber("4242")).toBe("•••• 4242")
  })
})
