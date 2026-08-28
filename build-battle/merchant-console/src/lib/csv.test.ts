import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportSegment,
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

  it("follows the caller's column order rather than the canonical one", () => {
    expect(toCsv([payment], ["currency", "amount", "id"])).toBe(
      ["currency,amount,id", "USD,$250.00,pay_0001"].join("\n"),
    )
  })

  it("returns nothing at all for an empty selection, rather than a file of blank lines", () => {
    expect(toCsv([payment], [])).toBe("")
  })
})

describe("parseExportColumns", () => {
  it("leaves out the card last four by default, so a merchant file needs no hand editing", () => {
    expect(parseExportColumns(null)).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(parseExportColumns(null)).not.toContain("last4")
  })

  it("includes the last four only when it is named explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("keeps the order ops asked for, because that is the order of the file", () => {
    expect(parseExportColumns("currency,id")).toEqual(["currency", "id"])
    expect(toCsv([payment], parseExportColumns("currency,id"))).toBe(
      ["currency,id", "USD,pay_0001"].join("\n"),
    )
  })

  it("drops a name that is not a column, so a stale link still exports something", () => {
    expect(parseExportColumns("id,merchant_email,amount")).toEqual([
      "id",
      "amount",
    ])
  })

  it("collapses a repeated column so the header has no duplicate", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })

  it("returns an empty selection rather than falling back, so the route can refuse it", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("not_a_column")).toEqual([])
  })
})

describe("parseExportScope", () => {
  it("stays on the current filter unless the scope says otherwise, so a link never widens an export", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("everything")).toBe("filtered")
  })

  it("widens to every payment only for the exact scope name", () => {
    expect(parseExportScope("all")).toBe("all")
  })
})

describe("exportSegment", () => {
  it("labels an all-payments export 'all' even while a status filter is on screen", () => {
    expect(exportSegment("all", "disputed")).toBe("all")
  })

  it("uses the status when the export follows the current filter", () => {
    expect(exportSegment("filtered", "disputed")).toBe("disputed")
  })

  it("says filtered when the current filter is every status", () => {
    expect(exportSegment("filtered", "all")).toBe("filtered")
    expect(exportSegment("filtered", undefined)).toBe("filtered")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope in the file, so a downloads folder stays readable", () => {
    const date = new Date("2026-08-13T09:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(date, "all")).toBe("payments-all-2026-08-13.csv")
  })
})
