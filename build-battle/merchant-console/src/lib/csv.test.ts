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

  it("follows the requested order, not the order columns are declared in", () => {
    expect(toCsv([payment], ["status", "id"])).toBe(
      ["status,id", "captured,pay_0001"].join("\n"),
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
  it("leaves the card last four out, so a merchant file needs no hand editing", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")

    const csv = toCsv([payment], DEFAULT_EXPORT_COLUMNS)
    expect(csv).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("carries every other column, so adding one cannot skip the default set", () => {
    expect([...DEFAULT_EXPORT_COLUMNS]).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })
})

describe("parseExportColumns", () => {
  it("returns nothing when the selection is empty, so the route can reject it", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns(null)).toEqual([])
    expect(parseExportColumns(",, ,")).toEqual([])
  })

  it("keeps only allowlisted names, deduped, in the order asked for", () => {
    expect(parseExportColumns("last4,id,last4,merchant")).toEqual([
      "last4",
      "id",
      "merchant",
    ])
  })

  it("drops anything not on the allowlist rather than passing it through", () => {
    expect(parseExportColumns("id,../../etc/passwd,amount; DROP TABLE")).toEqual([
      "id",
    ])
    expect(parseExportColumns("nope,also_nope")).toEqual([])
  })

  it("tolerates whitespace around a name", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope when the export is narrowed or widened", () => {
    const date = new Date("2026-03-14T23:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe(
      "payments-disputed-2026-03-14.csv",
    )
    expect(exportFilename(date, "all")).toBe("payments-all-2026-03-14.csv")
  })
})
