import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
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
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope between the prefix and the date", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

/**
 * Column and scope selection. The names come from the client, so the parser
 * is the allowlist: it decides what reaches the serializer and the filename.
 */

describe("parseExportColumns", () => {
  it("keeps a subset of columns in the requested order", () => {
    const columns = parseExportColumns("amount,id,merchant")
    expect(columns).toEqual(["amount", "id", "merchant"])
    expect(toCsv([payment], columns).split("\n")[0]).toBe("amount,id,merchant")
  })

  it("leaves the card last four out unless it is asked for", () => {
    const defaults = parseExportColumns(null)
    expect(defaults).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(defaults).not.toContain("last4")
    expect(toCsv([payment], defaults)).not.toContain("4242")

    expect(parseExportColumns("last4,id")).toEqual(["last4", "id"])
  })

  it("returns an empty selection when nothing usable was requested", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("nope,drop_table")).toEqual([])
  })

  it("drops unknown names and repeats, keeping the first occurrence", () => {
    expect(parseExportColumns("id, id ,bogus,amount")).toEqual(["id", "amount"])
  })

  it("can still ask for every column explicitly", () => {
    expect(parseExportColumns(EXPORT_COLUMNS.join(","))).toEqual([...EXPORT_COLUMNS])
  })
})

describe("parseExportScope", () => {
  it("is the current filter unless the client says all", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope(null)).toBe("current")
    expect(parseExportScope("")).toBe("current")
    expect(parseExportScope("everything")).toBe("current")
  })
})

describe("exportScopeLabel", () => {
  it("names the scope with only allowlisted words", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
    expect(exportScopeLabel("current", { status: "disputed" })).toBe("disputed")
    expect(exportScopeLabel("current", { status: "all", merchantId: "mch_01" })).toBe(
      "filtered",
    )
    expect(exportScopeLabel("current", { status: "all", search: "1180" })).toBe(
      "filtered",
    )
    expect(exportScopeLabel("current", { status: "all" })).toBeUndefined()
  })
})
