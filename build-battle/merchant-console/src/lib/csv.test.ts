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

describe("parseExportColumns", () => {
  it("keeps a subset of columns in the order requested, not the table's order", () => {
    const parsed = parseExportColumns("currency,amount,id")
    expect(parsed).toEqual({ ok: true, columns: ["currency", "amount", "id"] })
    if (!parsed.ok) return
    expect(toCsv([payment], parsed.columns)).toBe(
      ["currency,amount,id", "USD,$250.00,pay_0001"].join("\n"),
    )
  })

  it("drops a repeated column rather than writing it twice", () => {
    expect(parseExportColumns("id,amount,id")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })

  it("excludes the card last four by default", () => {
    const parsed = parseExportColumns(null)
    expect(parsed).toEqual({ ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] })
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
    if (!parsed.ok) return
    const csv = toCsv([payment], parsed.columns)
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("rejects an empty selection instead of producing an empty file", () => {
    for (const raw of ["", " ", ",", " , "]) {
      const parsed = parseExportColumns(raw)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.error).toMatch(/at least one column/)
    }
  })

  it("rejects a column that is not on the allowlist", () => {
    for (const raw of ["id,card_number", "id,,amount", "ID"]) {
      expect(parseExportColumns(raw).ok).toBe(false)
    }
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter and allows only known scopes", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filtered")).toBe("filtered")
    expect(parseExportScope("../../etc")).toBeNull()
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope ahead of the date", () => {
    const day = new Date("2026-08-13T12:00:00.000Z")
    const label = exportScopeLabel("filtered", { status: "disputed" })
    expect(exportFilename(day, label)).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(day, exportScopeLabel("all", { status: "disputed" }))).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("never puts free text from a search into the filename", () => {
    expect(exportScopeLabel("filtered", { search: '"; rm -rf' })).toBe("filtered")
    expect(exportScopeLabel("filtered", { status: "all" })).toBe("all")
  })
})
