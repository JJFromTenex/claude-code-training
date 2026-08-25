import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  toCsv,
  validateExportColumns,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping, the
 * column contract, and which columns ops gets by default.
 *
 * NWP-101 did change how one cell is written: the amount used to arrive as
 * `$250.00` and now arrives as `250.00`, with the symbol's job handed to the
 * `currency` column. A grouped, symbol-prefixed amount lands in a spreadsheet
 * as text rather than a number, which is the whole reason ops was editing
 * these files by hand.
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
      ["id,amount", "pay_0001,250.00"].join("\n"),
    )
  })

  it("writes a large amount ungrouped, so the cell needs no quoting", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(["amount", "1234567.89"].join("\n"))
  })

  it("still quotes a cell that genuinely contains a comma", () => {
    const commas = { ...payment, description: "Order 1180, rush" }
    expect(toCsv([commas], ["description"])).toBe(
      ["description", '"Order 1180, rush"'].join("\n"),
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

  it("honors the requested column order, not the allowlist's", () => {
    // Deliberately the reverse of the order these appear in EXPORT_COLUMNS.
    expect(toCsv([payment], ["currency", "amount", "id"])).toBe(
      ["currency,amount,id", "USD,250.00,pay_0001"].join("\n"),
    )
  })

  it("produces nothing usable for an empty column list", () => {
    // Which is why the route rejects an empty selection rather than serving
    // this. See the 400 in src/app/api/payments/export/route.ts.
    expect(toCsv([payment], [])).toBe("\n")
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves out the card last four", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })

  it("keeps every other allowlisted column, in allowlist order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("writes no last four into a default export", () => {
    const csv = toCsv([payment], DEFAULT_EXPORT_COLUMNS)
    expect(csv).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("still exports the last four when ops explicitly asks for it", () => {
    // Off by default is a default, not a removal.
    expect(toCsv([payment], ["last4"])).toBe(["last4", "4242"].join("\n"))
  })
})

describe("validateExportColumns", () => {
  it("returns nothing for an empty selection", () => {
    expect(validateExportColumns([])).toEqual([])
  })

  it("returns nothing when every requested column is unknown", () => {
    expect(validateExportColumns(["cardholder_pan", "internal_notes"])).toEqual(
      [],
    )
  })

  it("drops unknown columns and keeps the order of the rest", () => {
    expect(validateExportColumns(["amount", "cardholder_pan", "id"])).toEqual([
      "amount",
      "id",
    ])
  })

  it("accepts the full allowlist unchanged", () => {
    expect(validateExportColumns([...EXPORT_COLUMNS])).toEqual([
      ...EXPORT_COLUMNS,
    ])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("includes the scope when there is one", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("slugs the scope, so nothing from a client reaches the filename raw", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "../../etc/passwd"),
    ).toBe("payments-etcpasswd-2026-08-13.csv")
  })
})
