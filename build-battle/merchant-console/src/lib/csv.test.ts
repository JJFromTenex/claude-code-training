import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
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

describe("parseExportOptions", () => {
  const options = (query: string) => parseExportOptions(new URLSearchParams(query))

  it("returns the requested subset, in the order it was asked for", () => {
    expect(options("columns=amount,id,status").columns).toEqual([
      "amount",
      "id",
      "status",
    ])
  })

  it("leaves the card last four out of the default column set", () => {
    expect(options("").columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(options("").columns).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("includes the card last four only when it is asked for by name", () => {
    expect(options("columns=id,last4").columns).toEqual(["id", "last4"])
  })

  it("returns no columns for an empty selection, rather than an empty file", () => {
    expect(options("columns=").columns).toBeNull()
  })

  it("drops column names that are not on the allowlist", () => {
    expect(options("columns=id,../../etc/passwd,DROP TABLE").columns).toEqual([
      "id",
    ])
  })

  it("returns no columns when nothing in the selection is allowed", () => {
    expect(options("columns=nope,also_nope").columns).toBeNull()
  })

  it("collapses a repeated column to one", () => {
    expect(options("columns=id,id,amount").columns).toEqual(["id", "amount"])
  })

  it("defaults to the current filter, and reads the all-payments scope", () => {
    expect(options("").scope).toBe("filtered")
    expect(options("scope=all").scope).toBe("all")
    expect(options("scope=everything").scope).toBe("filtered")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope when there is one, so a file says what is in it", () => {
    const date = new Date("2026-08-13T10:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(date, "all")).toBe("payments-all-2026-08-13.csv")
  })
})
