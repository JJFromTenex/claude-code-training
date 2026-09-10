import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeToken,
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

describe("parseExportColumns", () => {
  it("defaults to every column except the card last four, in the standard order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual([
      "id",
      "created_at",
      "merchant",
      "description",
      "status",
      "method",
      "card_brand",
      "amount",
      "currency",
    ])
    expect(parseExportColumns(null)).toEqual({
      ok: true,
      columns: DEFAULT_EXPORT_COLUMNS,
    })
  })

  it("accepts a subset and keeps the requested order, so the file follows the request", () => {
    const parsed = parseExportColumns("amount,id")
    expect(parsed).toEqual({ ok: true, columns: ["amount", "id"] })
    if (!parsed.ok) throw new Error("unreachable")
    expect(toCsv([payment], parsed.columns)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      message: "Select at least one column",
    })
  })

  it("rejects a column that is not on the allowlist and names it", () => {
    expect(parseExportColumns("id,pan")).toEqual({
      ok: false,
      message: 'Unknown column "pan"',
    })
  })

  it("rejects a column listed twice", () => {
    expect(parseExportColumns("id,id")).toEqual({
      ok: false,
      message: 'Duplicate column "id"',
    })
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter when the param is absent", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, scope: "current" })
  })

  it("accepts the two allowlisted scopes", () => {
    expect(parseExportScope("current")).toEqual({ ok: true, scope: "current" })
    expect(parseExportScope("all")).toEqual({ ok: true, scope: "all" })
  })

  it("rejects anything else and names it", () => {
    expect(parseExportScope("everything")).toEqual({
      ok: false,
      message: 'Unknown scope "everything"',
    })
  })
})

describe("exportScopeToken", () => {
  it("is the status when exporting a status-filtered view", () => {
    expect(exportScopeToken("current", { status: "disputed" })).toBe("disputed")
  })

  it("is 'all' for the all-payments scope, whatever filters are set", () => {
    expect(exportScopeToken("all", { status: "disputed", search: "rush" })).toBe("all")
  })

  it("is 'filtered' when only merchant, search, or date filters are set", () => {
    expect(exportScopeToken("current", { status: "all", merchantId: "mch_01" })).toBe(
      "filtered",
    )
    expect(exportScopeToken("current", { search: "rush" })).toBe("filtered")
    expect(exportScopeToken("current", { from: "2026-03-01" })).toBe("filtered")
  })

  it("is 'all' when the current view has no filters at all", () => {
    expect(exportScopeToken("current", { status: "all", page: 3 })).toBe("all")
  })
})

describe("exportFilename", () => {
  it("puts the scope token before the date, as in the ticket example", () => {
    const day = new Date("2026-08-13T10:00:00.000Z")
    expect(exportFilename("disputed", day)).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename("all", day)).toBe("payments-all-2026-08-13.csv")
  })

  it("stamps the UTC date, never the local one", () => {
    // Late and early UTC instants: a local-date implementation gets one of
    // these wrong on any machine whose offset is not zero.
    expect(exportFilename("all", new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-all-2026-03-14.csv",
    )
    expect(exportFilename("all", new Date("2026-03-14T00:30:00.000Z"))).toBe(
      "payments-all-2026-03-14.csv",
    )
  })
})
