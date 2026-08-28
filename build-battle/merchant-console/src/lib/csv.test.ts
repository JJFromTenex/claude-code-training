import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeSegment,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 *
 * The blocks below the escaping ones cover what NWP-101 added: the default
 * column set, and the allowlisting of everything the client gets to name.
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

  it("honors an order the caller invents, so the header is not canonical", () => {
    expect(toCsv([payment], ["currency", "amount", "id"])).toBe(
      ["currency,amount,id", "USD,$250.00,pay_0001"].join("\n"),
    )
  })

  it("omits the card last four by default, so a merchant file needs no editing", () => {
    const header = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")[0]
    expect(header).toBe(
      "id,created_at,merchant,description,status,method,card_brand,amount,currency",
    )
  })

  it("refuses an empty column list rather than writing a file of newlines", () => {
    expect(() => toCsv([payment], [])).toThrow(/at least one column/)
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves out the card last four, and nothing else", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("still offers the last four as a column ops can turn on", () => {
    expect(EXPORT_COLUMNS).toContain("last4")
  })
})

describe("parseExportColumns", () => {
  it("falls back to the defaults when the client names no columns", () => {
    expect(parseExportColumns(new URLSearchParams("status=disputed"))).toEqual(
      DEFAULT_EXPORT_COLUMNS,
    )
  })

  it("keeps the order the client asked for", () => {
    expect(
      parseExportColumns(new URLSearchParams("columns=amount,id")),
    ).toEqual(["amount", "id"])
  })

  it("drops a name that is not on the allowlist, so nothing invented ships", () => {
    const params = new URLSearchParams("columns=id,merchant_secret,amount")
    expect(parseExportColumns(params)).toEqual(["id", "amount"])
  })

  it("drops a repeated column, so the header cannot say id twice", () => {
    const params = new URLSearchParams("columns=id,id,amount")
    expect(parseExportColumns(params)).toEqual(["id", "amount"])
  })

  it("reads repeated params as well as one comma-separated list", () => {
    const params = new URLSearchParams("columns=id&columns=amount")
    expect(parseExportColumns(params)).toEqual(["id", "amount"])
  })

  it("returns nothing for an empty selection, so the route can refuse it", () => {
    expect(parseExportColumns(new URLSearchParams("columns="))).toEqual([])
  })

  it("returns nothing when every name is junk, rather than quietly defaulting", () => {
    expect(
      parseExportColumns(new URLSearchParams("columns=drop+table")),
    ).toEqual([])
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter", () => {
    expect(parseExportScope(new URLSearchParams(""))).toBe("current")
  })

  it("reads an explicit request for every payment", () => {
    expect(parseExportScope(new URLSearchParams("scope=all"))).toBe("all")
  })

  it("falls back to the current filter for a scope it does not know", () => {
    expect(parseExportScope(new URLSearchParams("scope=everything"))).toBe(
      "current",
    )
  })
})

describe("exportScopeSegment", () => {
  it("uses the status when the file is one status of the current filter", () => {
    expect(exportScopeSegment("current", { status: "disputed" })).toBe(
      "disputed",
    )
  })

  it("says all when the export ignores the filters", () => {
    expect(exportScopeSegment("all", { status: "disputed" })).toBe("all")
  })

  it("says filtered when the filter is not a status", () => {
    expect(
      exportScopeSegment("current", { status: "all", search: "1180" }),
    ).toBe("filtered")
  })

  it("says all when the current filter narrows nothing", () => {
    expect(exportScopeSegment("current", { status: "all" })).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope, so a disputed export does not look like the rest", () => {
    expect(
      exportFilename(new Date("2026-08-13T00:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("slugs a segment, so nothing can smuggle a quote into the header", () => {
    expect(exportFilename(new Date("2026-08-13T00:00:00.000Z"), 'a"b')).toBe(
      "payments-a-b-2026-08-13.csv",
    )
  })
})
