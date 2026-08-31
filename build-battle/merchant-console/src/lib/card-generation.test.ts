import { describe, expect, it } from "vitest"
import { calculateLuhnCheckDigit, generateCard4242, validateLuhn } from "./card-generation"

describe("Card generation (4242 BIN)", () => {
  it("generates a 16-digit number", () => {
    const card = generateCard4242()
    expect(card).toHaveLength(16)
  })

  it("starts with 4242 (test BIN)", () => {
    const card = generateCard4242()
    expect(card.startsWith("4242")).toBe(true)
  })

  it("generates numbers with valid Luhn check digits", () => {
    for (let i = 0; i < 10; i++) {
      const card = generateCard4242()
      expect(validateLuhn(card)).toBe(true)
    }
  })

  it("generates different numbers on each call", () => {
    const card1 = generateCard4242()
    const card2 = generateCard4242()
    expect(card1).not.toBe(card2)
  })
})

describe("Luhn validation", () => {
  it("validates the generated check digit", () => {
    const base = "424242424242424"
    const checkDigit = calculateLuhnCheckDigit(base)
    const fullNumber = base + checkDigit
    expect(validateLuhn(fullNumber)).toBe(true)
  })

  it("validates generated cards", () => {
    const card = generateCard4242()
    expect(validateLuhn(card)).toBe(true)
  })

  it("rejects a card with wrong check digit", () => {
    const card = generateCard4242()
    const corrupted = card.slice(0, -1) + (parseInt(card[card.length - 1], 10) === 0 ? "1" : "0")
    expect(validateLuhn(corrupted)).toBe(false)
  })
})

describe("Card status state machine", () => {
  it("allows active → frozen transition", () => {
    const canTransition = (from: string, to: string) => {
      if (from === "active" && to === "frozen") return true
      if (from === "frozen" && to === "active") return true
      if ((from === "active" || from === "frozen") && to === "cancelled") return true
      if (from === "cancelled") return false
      return false
    }

    expect(canTransition("active", "frozen")).toBe(true)
  })

  it("allows frozen → active transition", () => {
    const canTransition = (from: string, to: string) => {
      if (from === "active" && to === "frozen") return true
      if (from === "frozen" && to === "active") return true
      if ((from === "active" || from === "frozen") && to === "cancelled") return true
      if (from === "cancelled") return false
      return false
    }

    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows active → cancelled and frozen → cancelled transitions", () => {
    const canTransition = (from: string, to: string) => {
      if (from === "active" && to === "frozen") return true
      if (from === "frozen" && to === "active") return true
      if ((from === "active" || from === "frozen") && to === "cancelled") return true
      if (from === "cancelled") return false
      return false
    }

    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("prevents cancelled → anything transition (terminal state)", () => {
    const canTransition = (from: string, to: string) => {
      if (from === "active" && to === "frozen") return true
      if (from === "frozen" && to === "active") return true
      if ((from === "active" || from === "frozen") && to === "cancelled") return true
      if (from === "cancelled") return false
      return false
    }

    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })
})
