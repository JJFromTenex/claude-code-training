import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
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
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})

/**
 * Column selection (NWP-101). The names arrive from the client, so these pin
 * what the route is allowed to serve: the subset asked for, in the order asked
 * for, with the card last four absent unless it is named.
 */
describe("parseExportColumns", () => {
  it("returns the requested subset, in the requested order", () => {
    expect(parseExportColumns("status,id,amount")).toEqual({
      columns: ["status", "id", "amount"],
    })
  })

  it("serializes that subset in the same order, not the canonical one", () => {
    const parsed = parseExportColumns("amount,id")
    if ("error" in parsed) throw new Error(parsed.error)
    expect(toCsv([payment], parsed.columns)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("collapses a duplicated column rather than writing it twice", () => {
    expect(parseExportColumns("id,id,status")).toEqual({
      columns: ["id", "status"],
    })
  })

  it("leaves the card last four out of the default set", () => {
    const parsed = parseExportColumns(null)
    if ("error" in parsed) throw new Error(parsed.error)
    expect(parsed.columns).not.toContain("last4")
    expect(parsed.columns).toEqual(EXPORT_COLUMNS.filter((c) => c !== "last4"))
    expect(toCsv([payment], parsed.columns)).not.toContain("4242")
  })

  it("includes the card last four only when it is asked for by name", () => {
    expect(parseExportColumns("id,last4")).toEqual({
      columns: ["id", "last4"],
    })
    expect(toCsv([payment], ["id", "last4"])).toContain("4242")
  })

  it("rejects an empty selection instead of returning an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      error: "Select at least one column to export.",
    })
    expect(parseExportColumns(" , , ")).toEqual({
      error: "Select at least one column to export.",
    })
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parseExportColumns("id,card_number")).toEqual({
      error: "Unknown export column: card_number",
    })
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter, and only 'all' widens it", () => {
    expect(parseExportScope(null)).toBe("filter")
    expect(parseExportScope("everything")).toBe("filter")
    expect(parseExportScope("all")).toBe("all")
  })
})

describe("exportFilename with a scope", () => {
  it("names the scope it covers", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("slugs the scope, so it can never shape the filename", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), '../etc/pw"')).toBe(
      "payments-etc-pw-2026-08-13.csv",
    )
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("covers every column except the card last four", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })
})
