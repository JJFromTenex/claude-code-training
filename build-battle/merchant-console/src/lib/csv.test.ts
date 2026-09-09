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
 * written, and these should still pass afterwards. The column selection
 * tests below cover what NWP-101 added: the allowlist, the default set, and
 * the refusal to write an empty file.
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

  it("writes a subset of columns in the requested order, not the canonical one", () => {
    expect(toCsv([payment], ["amount", "id"])).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
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
  it("excludes the card last four, so a file sent to a merchant is clean by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
    expect(toCsv([payment], DEFAULT_EXPORT_COLUMNS)).not.toContain("4242")
  })
})

describe("parseExportColumns", () => {
  it("falls back to the default set when the request names no columns", () => {
    expect(parseExportColumns(null)).toEqual({
      ok: true,
      columns: DEFAULT_EXPORT_COLUMNS,
    })
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toMatchObject({ ok: false })
    expect(parseExportColumns(" , ")).toMatchObject({ ok: false })
  })

  it("rejects an unknown column and names it in a message safe to show", () => {
    const result = parseExportColumns("id,pan")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("pan")
  })

  it("keeps the requested order and drops duplicates", () => {
    expect(parseExportColumns("amount,id,amount")).toEqual({
      ok: true,
      columns: ["amount", "id"],
    })
  })
})

describe("parseExportScope", () => {
  it("exports the current filter unless the request says all", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("everything")).toBe("filtered")
  })
})

describe("exportFilename", () => {
  it("carries the scope and the UTC date, so two same-day exports of one scope collide by design", () => {
    const date = new Date("2026-03-14T23:00:00.000Z")
    expect(exportFilename("disputed", date)).toBe("payments-disputed-2026-03-14.csv")
    expect(exportFilename("all", date)).toBe("payments-all-2026-03-14.csv")
  })
})
