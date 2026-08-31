import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeLabel,
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

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves the card last four out, and keeps every other column", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("writes a header with no last4 when nothing is selected", () => {
    const header = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")[0]
    expect(header).not.toContain("last4")
    expect(header).toContain("card_brand")
  })
})

describe("parseExportColumns", () => {
  it("falls back to the defaults when the client sends nothing", () => {
    const selection = parseExportColumns(null)
    expect(selection).toEqual({ ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] })
  })

  it("keeps the requested order rather than the canonical one", () => {
    const selection = parseExportColumns("amount,id")
    expect(selection).toEqual({ ok: true, columns: ["amount", "id"] })
  })

  it("rejects an empty selection instead of producing an empty file", () => {
    expect(parseExportColumns("")).toMatchObject({ ok: false })
    expect(parseExportColumns("  ,  ")).toMatchObject({ ok: false })
  })

  it("rejects a column that is not on the allowlist", () => {
    const selection = parseExportColumns("id,merchant_secret")
    expect(selection).toMatchObject({ ok: false })
    if (!selection.ok) expect(selection.error).toContain("merchant_secret")
  })

  it("still allows last4 when ops asks for it by name", () => {
    expect(parseExportColumns("id,last4")).toEqual({
      ok: true,
      columns: ["id", "last4"],
    })
  })

  it("collapses a duplicated column so it is not written twice", () => {
    expect(parseExportColumns("id,amount,id")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })

  it("tolerates whitespace around names", () => {
    expect(parseExportColumns(" id , amount ")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })
})

describe("exportScopeLabel", () => {
  it("names the status when the table is filtered to one", () => {
    expect(exportScopeLabel("filtered", { status: "disputed" })).toBe("disputed")
  })

  it("says filtered when narrowed by something other than status", () => {
    expect(exportScopeLabel("filtered", { status: "all", merchantId: "mch_01" })).toBe(
      "filtered",
    )
  })

  it("says all for an unfiltered table, and for the all-payments scope", () => {
    expect(exportScopeLabel("filtered", { status: "all" })).toBe("all")
    expect(exportScopeLabel("all", { status: "disputed" })).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename("all", new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-all-2026-03-14.csv",
    )
  })

  it("carries the scope, so a file says what is in it", () => {
    expect(exportFilename("disputed", new Date("2026-08-13T00:00:00.000Z"))).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })

  it("slugifies the scope rather than trusting it into the header", () => {
    expect(exportFilename('a"; drop', new Date("2026-08-13T00:00:00.000Z"))).toBe(
      "payments-adrop-2026-08-13.csv",
    )
  })
})
