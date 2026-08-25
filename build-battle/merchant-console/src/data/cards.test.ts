import { describe, expect, it } from "vitest"
import {
  canTransition,
  generateCardNumber,
  isValidLuhn,
  issueCard,
  luhnCheckDigit,
  setCardStatus,
} from "./cards"

describe("luhnCheckDigit", () => {
  it("produces a check digit that makes the number Luhn-valid", () => {
    const partial = "424242424242424"
    const full = partial + luhnCheckDigit(partial)
    expect(isValidLuhn(full)).toBe(true)
  })

  it("matches the known Luhn value for a reference number", () => {
    // 7992739871 -> check digit 3 (classic Luhn worked example)
    expect(luhnCheckDigit("7992739871")).toBe("3")
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 test BIN with a valid Luhn digit", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(16)
      expect(number.startsWith("4242")).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("is deterministic under a fixed random source", () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25]
    const fromSeq = () => {
      let i = 0
      return () => seq[i++]
    }
    expect(generateCardNumber(fromSeq())).toBe(generateCardNumber(fromSeq()))
  })
})

describe("canTransition", () => {
  it("allows active <-> frozen and either to cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})

describe("issueCard", () => {
  const base = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD" as const,
  }

  it("issues an active card and reveals the full number once", () => {
    const result = issueCard(base)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.number.startsWith("4242")).toBe(true)
    expect(isValidLuhn(result.number)).toBe(true)
    expect(result.card.last4).toBe(result.number.slice(-4))
    expect(result.card.status).toBe("active")
    expect(result.card.spend).toBe(0)
    // The stored card never carries the full number.
    expect(JSON.stringify(result.card)).not.toContain(result.number)
  })

  it("rejects an unknown merchant", () => {
    expect(issueCard({ ...base, merchantId: "nope" })).toMatchObject({ ok: false })
  })

  it("rejects a zero or negative limit", () => {
    expect(issueCard({ ...base, spendLimit: 0 })).toMatchObject({ ok: false })
    expect(issueCard({ ...base, spendLimit: -100 })).toMatchObject({ ok: false })
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(issueCard({ ...base, spendLimit: 5_000_001 })).toMatchObject({ ok: false })
    expect(issueCard({ ...base, spendLimit: 5_000_000 })).toMatchObject({ ok: true })
  })

  it("rejects a currency outside USD/EUR/GBP", () => {
    expect(
      // @ts-expect-error deliberately invalid currency
      issueCard({ ...base, currency: "JPY" }),
    ).toMatchObject({ ok: false })
  })
})

describe("setCardStatus", () => {
  it("freezes then unfreezes an active card", () => {
    const issued = issueCard({
      nickname: "Freeze me",
      merchantId: "mch_01",
      spendLimit: 10000,
      currency: "USD",
    })
    if (!issued.ok) throw new Error("issue failed")
    const id = issued.card.id

    expect(setCardStatus(id, "frozen")).toMatchObject({ ok: true })
    expect(setCardStatus(id, "active")).toMatchObject({ ok: true })
    expect(setCardStatus(id, "cancelled")).toMatchObject({ ok: true })
    // Cancelled is terminal.
    expect(setCardStatus(id, "active")).toMatchObject({ ok: false })
  })

  it("reports a missing card", () => {
    expect(setCardStatus("card_999999", "frozen")).toMatchObject({
      ok: false,
      notFound: true,
    })
  })
})
