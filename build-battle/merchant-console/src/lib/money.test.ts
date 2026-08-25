import { describe, expect, it } from "vitest"
import {
  formatMinorUnits,
  formatMoney,
  formatMoneyCompact,
  parseAmountToMinorUnits,
  sumMinorUnits,
} from "./money"

/**
 * Money is the one thing in this codebase that is never allowed to drift, so
 * it is the one thing with the most tests. Anything that touches an amount
 * should be able to point at a case here.
 */

describe("formatMoney", () => {
  it("renders minor units with two decimal places", () => {
    expect(formatMoney(25000, "USD")).toBe("$250.00")
    expect(formatMoney(1, "USD")).toBe("$0.01")
    expect(formatMoney(0, "USD")).toBe("$0.00")
  })

  it("groups thousands", () => {
    expect(formatMoney(123456789, "USD")).toBe("$1,234,567.89")
  })

  it("puts the sign before the symbol on refunds", () => {
    expect(formatMoney(-4200, "USD")).toBe("-$42.00")
  })

  it("uses the right symbol per currency", () => {
    expect(formatMoney(1000, "EUR")).toBe("€10.00")
    expect(formatMoney(1000, "GBP")).toBe("£10.00")
  })
})

describe("formatMoneyCompact", () => {
  it("falls back to the full format under a thousand units", () => {
    expect(formatMoneyCompact(99999, "USD")).toBe("$999.99")
  })

  it("abbreviates at and above a thousand units", () => {
    expect(formatMoneyCompact(100000, "USD")).toBe("$1.0k")
    expect(formatMoneyCompact(1240000, "USD")).toBe("$12.4k")
  })

  it("keeps the sign on negative amounts", () => {
    expect(formatMoneyCompact(-1240000, "USD")).toBe("-$12.4k")
  })
})

describe("sumMinorUnits", () => {
  it("sums integers exactly, with no float drift", () => {
    // The float version of this sum is 0.30000000000000004. In minor units
    // it is 30, every time. That is the whole reason for the convention.
    expect(sumMinorUnits([10, 20])).toBe(30)
    expect(sumMinorUnits(Array(1000).fill(1))).toBe(1000)
  })

  it("returns zero for an empty list", () => {
    expect(sumMinorUnits([])).toBe(0)
  })
})

describe("parseAmountToMinorUnits", () => {
  it("accepts whole and decimal input", () => {
    expect(parseAmountToMinorUnits("250")).toBe(25000)
    expect(parseAmountToMinorUnits("250.00")).toBe(25000)
    expect(parseAmountToMinorUnits("250.5")).toBe(25050)
    expect(parseAmountToMinorUnits("0.07")).toBe(7)
  })

  it("tolerates the commas and spaces people actually type", () => {
    expect(parseAmountToMinorUnits(" 1,250.75 ")).toBe(125075)
  })

  it("rejects anything it cannot represent exactly", () => {
    expect(parseAmountToMinorUnits("250.005")).toBeNull()
    expect(parseAmountToMinorUnits("-250")).toBeNull()
    expect(parseAmountToMinorUnits("twelve")).toBeNull()
    expect(parseAmountToMinorUnits("")).toBeNull()
  })
})

describe("formatMinorUnits", () => {
  it("renders minor units as a plain decimal, with no symbol", () => {
    expect(formatMinorUnits(25000)).toBe("250.00")
    expect(formatMinorUnits(0)).toBe("0.00")
  })

  it("pads the cents of an amount below a unit", () => {
    expect(formatMinorUnits(7)).toBe("0.07")
    expect(formatMinorUnits(70)).toBe("0.70")
  })

  it("keeps a negative amount negative", () => {
    expect(formatMinorUnits(-2550)).toBe("-25.50")
    expect(formatMinorUnits(-7)).toBe("-0.07")
  })

  it("omits thousands separators, so a file reads back as a number", () => {
    expect(formatMinorUnits(123456789)).toBe("1234567.89")
    expect(Number(formatMinorUnits(123456789))).toBe(1234567.89)
  })

  it("divides in integers, so no cent is lost to a float", () => {
    for (const minorUnits of [1, 99, 100, 101, 999999999999]) {
      const [whole, cents] = formatMinorUnits(minorUnits).split(".")
      expect(Number(whole) * 100 + Number(cents)).toBe(minorUnits)
    }
  })
})
