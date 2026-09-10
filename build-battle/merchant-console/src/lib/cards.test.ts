import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  MAX_SPEND_LIMIT,
  TEST_BIN,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
  validateIssueRequest,
} from "./cards"

/**
 * Card numbers and card status are the two things in NWP-201 that must never
 * drift, so both are pinned here. Nothing in this file may resemble a real PAN:
 * every number is on the 4242 test BIN.
 */

describe("luhnCheckDigit", () => {
  it("matches the textbook vector", () => {
    // The classic worked example: 7992739871 takes check digit 3.
    expect(luhnCheckDigit("7992739871")).toBe(3)
  })

  it("completes the 4242 test BIN the way the network test card does", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })
})

describe("isLuhnValid", () => {
  it("rejects a single wrong digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects non-digit input", () => {
    expect(isLuhnValid("4242 4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  const numbers = Array.from({ length: 200 }, generateCardNumber)

  it("always starts with the 4242 test BIN", () => {
    for (const number of numbers) expect(number.startsWith(TEST_BIN)).toBe(true)
  })

  it("is sixteen digits", () => {
    for (const number of numbers) {
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number).toMatch(/^\d+$/)
    }
  })

  it("carries a valid Luhn check digit", () => {
    for (const number of numbers) expect(isLuhnValid(number)).toBe(true)
  })

  it("does not repeat itself in practice", () => {
    expect(new Set(numbers).size).toBeGreaterThan(190)
  })
})

describe("maskCard", () => {
  it("shows only the last four", () => {
    expect(maskCard("9137")).toBe("•••• 9137")
  })
})

describe("validateIssueRequest", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts a well-formed request and trims the nickname", () => {
    const result = validateIssueRequest({ ...valid, nickname: "  Ad spend " })
    expect(result).toEqual({ ok: true, value: valid })
  })

  it("accepts the maximum limit and each allowed currency", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: MAX_SPEND_LIMIT }).ok).toBe(true)
    for (const currency of ["USD", "EUR", "GBP"]) {
      expect(validateIssueRequest({ ...valid, currency }).ok).toBe(true)
    }
  })

  it("rejects a missing or unknown merchant", () => {
    expect(validateIssueRequest({ ...valid, merchantId: undefined })).toMatchObject({
      ok: false,
      field: "merchantId",
    })
    expect(validateIssueRequest({ ...valid, merchantId: "" })).toMatchObject({
      ok: false,
      field: "merchantId",
    })
    expect(validateIssueRequest({ ...valid, merchantId: "mch_99" })).toMatchObject({
      ok: false,
      field: "merchantId",
    })
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: 0 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
    expect(validateIssueRequest({ ...valid, spendLimit: -100 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: MAX_SPEND_LIMIT + 1 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
  })

  it("rejects a limit that is not an integer number of minor units", () => {
    expect(validateIssueRequest({ ...valid, spendLimit: 250.5 })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
    expect(validateIssueRequest({ ...valid, spendLimit: "25000" })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
    expect(validateIssueRequest({ ...valid, spendLimit: Number.NaN })).toMatchObject({
      ok: false,
      field: "spendLimit",
    })
  })

  it("rejects any currency outside USD, EUR, GBP", () => {
    for (const currency of ["CAD", "usd", "", undefined, 840]) {
      expect(validateIssueRequest({ ...valid, currency })).toMatchObject({
        ok: false,
        field: "currency",
      })
    }
  })

  it("rejects a missing or over-long nickname", () => {
    expect(validateIssueRequest({ ...valid, nickname: "   " })).toMatchObject({
      ok: false,
      field: "nickname",
    })
    expect(validateIssueRequest({ ...valid, nickname: "x".repeat(41) })).toMatchObject({
      ok: false,
      field: "nickname",
    })
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueRequest(null)).toMatchObject({ ok: false, field: "body" })
    expect(validateIssueRequest("nickname=x")).toMatchObject({ ok: false, field: "body" })
  })
})

describe("canTransition", () => {
  it("lets active and frozen swap", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("lets either go to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})
