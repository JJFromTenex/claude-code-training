import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
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

  it("follows the caller's column order, not the canonical one", () => {
    expect(toCsv([payment], ["status", "currency", "id"])).toBe(
      ["status,currency,id", "captured,USD,pay_0001"].join("\n"),
    )
  })

  it("produces a blank file for an empty selection, which is why the route refuses one", () => {
    // No header, no cells — just the row separator. Never a download path.
    expect(toCsv([payment], [])).toBe("\n")
    expect(toCsv([], [])).toBe("")
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves the card last four out, so a merchant file is clean by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })
})

describe("parseExportColumns", () => {
  it("falls back to the default set when the client sends no columns", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("keeps the requested order", () => {
    expect(parseExportColumns("amount,id,status")).toEqual([
      "amount",
      "id",
      "status",
    ])
  })

  it("drops names that are not columns and de-dupes the rest", () => {
    expect(parseExportColumns("id, id ,merchant,../etc/passwd,DROP TABLE")).toEqual(
      ["id", "merchant"],
    )
  })

  it("returns an empty selection when nothing survives the allowlist", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("nope,also_nope")).toEqual([])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope when there is one", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("strips anything a scope segment has no business putting in a filename", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "../all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })
})
