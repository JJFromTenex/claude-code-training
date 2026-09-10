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
})

/**
 * NWP-101. Column names arrive from the client, so the allowlist here is the
 * enforcement, not the dialog. These pin the two things a bad list must never
 * do: reach the header row, or quietly become a different list.
 */
describe("parseExportColumns", () => {
  it("keeps the requested columns in the order they were asked for", () => {
    expect(parseExportColumns("currency,id")).toEqual(["currency", "id"])
  })

  it("serializes through toCsv in that same order", () => {
    const columns = parseExportColumns("currency,id")!
    expect(toCsv([payment], columns)).toBe(
      ["currency,id", "USD,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out of the default set", () => {
    const columns = parseExportColumns(null)!
    expect(columns).not.toContain("last4")
    expect(columns).toEqual(DEFAULT_EXPORT_COLUMNS)
  })

  it("keeps amount and currency in the default set, as separate columns", () => {
    const columns = parseExportColumns(null)!
    expect(columns).toContain("amount")
    expect(columns).toContain("currency")
  })

  it("defaults to every column except last4", () => {
    expect(parseExportColumns(null)).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("rejects an empty selection rather than writing an empty file", () => {
    expect(parseExportColumns("")).toBeNull()
  })

  it("rejects an unknown column name", () => {
    expect(parseExportColumns("id,cardholder_ssn")).toBeNull()
  })

  it("rejects a name that differs only in case", () => {
    expect(parseExportColumns("ID")).toBeNull()
  })

  it("rejects an empty segment rather than skipping it", () => {
    expect(parseExportColumns("id,,amount")).toBeNull()
  })

  it("rejects a name padded with whitespace", () => {
    expect(parseExportColumns("id, amount")).toBeNull()
  })

  it("collapses a duplicate to its first occurrence", () => {
    expect(parseExportColumns("amount,id,amount")).toEqual(["amount", "id"])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("labels the file with the scope when one is given", () => {
    expect(exportFilename(new Date("2026-08-13T10:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })

  it("labels an all-payments export", () => {
    expect(exportFilename(new Date("2026-08-13T10:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("stays unlabelled when no scope is passed", () => {
    expect(exportFilename(new Date("2026-08-13T23:30:00.000Z"))).toBe(
      "payments-2026-08-13.csv",
    )
  })
})
