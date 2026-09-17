import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  buildExportHref,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })

  it("with DEFAULT_EXPORT_COLUMNS, omits last4 and keeps amount/currency separate", () => {
    const lines = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")
    expect(lines[0]).not.toContain("last4")
    expect(lines[0]).toContain("amount")
    expect(lines[0]).toContain("currency")
    const cells = lines[1].split(",")
    expect(cells[lines[0].split(",").indexOf("amount")]).toBe("$250.00")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("includes a valid label in the filename", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("ignores a label that does not match the allowlist pattern", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "../x")).toBe(
      "payments-2026-08-13.csv",
    )
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("is EXPORT_COLUMNS without last4", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })
})

describe("parseExportScope", () => {
  it('returns "all" only for exactly "all"', () => {
    expect(parseExportScope("all")).toBe("all")
  })

  it('defaults to "current" for null or anything else', () => {
    expect(parseExportScope(null)).toBe("current")
    expect(parseExportScope("weird")).toBe("current")
    expect(parseExportScope("ALL")).toBe("current")
  })
})

describe("parseExportColumns", () => {
  it("preserves the order given", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
  })

  it("drops unknown or injected column names", () => {
    expect(parseExportColumns("id,evil;DROP,__proto__,,constructor")).toEqual(["id"])
  })

  it("dedupes, keeping the first occurrence", () => {
    expect(parseExportColumns("id,amount,id")).toEqual(["id", "amount"])
  })

  it("returns an empty list when every column is invalid", () => {
    expect(parseExportColumns("nope,also-nope")).toEqual([])
  })

  it("returns an empty list for null", () => {
    expect(parseExportColumns(null)).toEqual([])
  })
})

describe("buildExportHref", () => {
  it("strips page and keeps filters for the current scope", () => {
    const href = buildExportHref("status=disputed&search=acme&page=2", "current", [
      "id",
      "amount",
    ])
    expect(href).toBe(
      "/api/payments/export?status=disputed&search=acme&scope=current&columns=id%2Camount",
    )
  })

  it("drops all existing params for the all scope", () => {
    const href = buildExportHref("status=disputed&search=acme&page=2", "all", ["id"])
    expect(href).toBe("/api/payments/export?scope=all&columns=id")
  })
})
