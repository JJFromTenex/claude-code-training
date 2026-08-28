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
 * the column contract. NWP-101 changes which columns ship and, per its fourth
 * acceptance criterion, what an amount looks like on the way out: a bare
 * decimal, with the currency code in its own column. The escaping contract
 * below is untouched.
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
    expect(lines[0]).toBe(DEFAULT_EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,250.00"].join("\n"),
    )
  })

  it("writes an amount as a bare decimal, so a spreadsheet reads a number", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(["amount", "1234567.89"].join("\n"))
  })

  it("quotes a cell containing a comma, so it does not split", () => {
    const commas = { ...payment, description: "Order 1180, rushed" }
    expect(toCsv([commas], ["description"])).toBe(
      ["description", '"Order 1180, rushed"'].join("\n"),
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
  it("leaves the card last four out, because most files go to a merchant", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(toCsv([payment])).not.toContain("4242")
  })

  it("keeps every other column, in the order the allowlist declares", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("still ships the last four when it is asked for explicitly", () => {
    expect(toCsv([payment], ["last4"])).toBe(["last4", "4242"].join("\n"))
  })
})

describe("parseExportColumns", () => {
  it("keeps the caller's order rather than the allowlist's", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
    expect(parseExportColumns("id,amount")).toEqual(["id", "amount"])
  })

  it("drops names that are not columns, so nothing unknown reaches a file", () => {
    expect(parseExportColumns("id,pin,amount")).toEqual(["id", "amount"])
  })

  it("returns nothing for an empty or entirely invalid selection", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns(null)).toEqual([])
    expect(parseExportColumns("pin,cvv")).toEqual([])
  })

  it("collapses duplicates and tolerates whitespace", () => {
    expect(parseExportColumns(" id , amount , id ")).toEqual(["id", "amount"])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(null, new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope, so a filtered file is not mistaken for the whole book", () => {
    const day = new Date("2026-08-13T09:00:00.000Z")
    expect(exportFilename("disputed", day)).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename("all", day)).toBe("payments-all-2026-08-13.csv")
  })

  it("strips anything a filename may not carry", () => {
    expect(exportFilename('a"; drop', new Date("2026-08-13T09:00:00.000Z"))).toBe(
      "payments-adrop-2026-08-13.csv",
    )
  })
})
