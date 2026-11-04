import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
  parseExportOptions,
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

  it("puts the scope label between the prefix and the date", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

describe("parseExportOptions", () => {
  const parse = (query: string) => parseExportOptions(new URLSearchParams(query))

  it("defaults to every column except card last four", () => {
    const result = parse("")
    expect(result).toEqual({
      ok: true,
      scope: "filter",
      columns: DEFAULT_EXPORT_COLUMNS,
    })
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("keeps only the requested columns, in the canonical order", () => {
    expect(parse("columns=status,id")).toMatchObject({
      ok: true,
      columns: ["id", "status"],
    })
  })

  it("lets ops opt in to last four explicitly", () => {
    expect(parse("columns=id,last4")).toMatchObject({
      ok: true,
      columns: ["id", "last4"],
    })
  })

  it("never ships an amount without its currency", () => {
    expect(parse("columns=id,amount")).toMatchObject({
      ok: true,
      columns: ["id", "amount", "currency"],
    })
  })

  it("rejects a column that is not on the allowlist", () => {
    expect(parse("columns=id,password")).toEqual({
      ok: false,
      error: "Unknown column: password",
    })
  })

  it("rejects an empty column list rather than writing an empty file", () => {
    expect(parse("columns=")).toEqual({
      ok: false,
      error: "Choose at least one column to export.",
    })
  })

  it("accepts the all-payments scope and rejects anything else", () => {
    expect(parse("scope=all")).toMatchObject({ ok: true, scope: "all" })
    expect(parse("scope=everything")).toEqual({
      ok: false,
      error: "Unknown scope: everything",
    })
  })
})

describe("exportScopeLabel", () => {
  it("names the whole-store export 'all', whatever filters were passed", () => {
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })

  it("uses the allowlisted status when one is active", () => {
    expect(exportScopeLabel("filter", { status: "disputed" })).toBe("disputed")
  })

  it("never puts a merchant id or search text into the filename", () => {
    expect(
      exportScopeLabel("filter", { status: "all", merchantId: "mch_01" }),
    ).toBe("filtered")
    expect(exportScopeLabel("filter", { search: "../../etc" })).toBe("filtered")
  })

  it("calls an unfiltered current view 'all'", () => {
    expect(exportScopeLabel("filter", { status: "all" })).toBe("all")
  })
})
