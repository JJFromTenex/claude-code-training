import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeToken,
  parseExportColumns,
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
    expect(toCsv([large], ["amount"])).toBe(
      ["amount", '"$1,234,567.89"'].join("\n"),
    )
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"])
      .split("\n")
      .slice(1)
      .join("\n")
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
})

/**
 * NWP-101 · column selection. The client picks columns, so this is the
 * allowlist boundary: what survives it is exactly what reaches a header row.
 */

describe("parseExportColumns", () => {
  it("keeps a subset in the order it was asked for", () => {
    expect(parseExportColumns("amount,id,status")).toEqual([
      "amount",
      "id",
      "status",
    ])
  })

  it("serializes that subset in the same order", () => {
    const columns = parseExportColumns("amount,id")
    expect(toCsv([payment], columns)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves out the card last four when no columns are asked for", () => {
    const columns = parseExportColumns(null)
    expect(columns).not.toContain("last4")
    expect(columns).toEqual(EXPORT_COLUMNS.filter((c) => c !== "last4"))
    expect(toCsv([payment], columns)).not.toContain("4242")
  })

  it("includes the card last four only when it is asked for by name", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("returns an empty selection for an empty parameter", () => {
    expect(parseExportColumns("")).toEqual([])
  })

  it("returns an empty selection when nothing asked for is a real column", () => {
    expect(parseExportColumns("password,1;DROP TABLE payments")).toEqual([])
  })

  it("drops unrecognised names and keeps the rest", () => {
    expect(parseExportColumns("id,merchant_secret,amount")).toEqual([
      "id",
      "amount",
    ])
  })

  it("ignores whitespace around names and does not repeat a column", () => {
    expect(parseExportColumns(" id , amount , id ")).toEqual(["id", "amount"])
  })
})

describe("exportScopeToken", () => {
  it("names the status when one is filtered", () => {
    expect(exportScopeToken({ status: "disputed" }, "current")).toBe("disputed")
  })

  it("says all when the scope ignores the filters", () => {
    expect(exportScopeToken({ status: "disputed" }, "all")).toBe("all")
  })

  it("says filtered when something other than status is narrowing it", () => {
    expect(
      exportScopeToken({ status: "all", search: "lumen" }, "current"),
    ).toBe("filtered")
  })

  it("says all when nothing is filtered", () => {
    expect(exportScopeToken({ status: "all" }, "current")).toBe("all")
  })

  it("stamps the scope and the UTC day into the filename", () => {
    const date = new Date("2026-08-13T23:00:00.000Z")
    expect(
      exportFilename(date, exportScopeToken({ status: "disputed" }, "current")),
    ).toBe("payments-disputed-2026-08-13.csv")
  })
})
