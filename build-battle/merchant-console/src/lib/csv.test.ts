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
  it("keeps the requested subset, in the order it was asked for", () => {
    expect(parseExportColumns("amount,id,currency")).toEqual([
      "amount",
      "id",
      "currency",
    ])
  })

  it("serializes that subset in the same order", () => {
    expect(toCsv([payment], parseExportColumns("status,id"))).toBe(
      ["status,id", "captured,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out when ops has not chosen columns", () => {
    const columns = parseExportColumns(null)
    expect(columns).not.toContain("last4")
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(toCsv([payment], columns)).not.toContain("4242")
  })

  it("includes the card last four only when it is asked for by name", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("returns nothing for an empty selection, so the route can refuse it", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("   ")).toEqual([])
  })

  it("drops names that are not columns rather than trusting them", () => {
    expect(parseExportColumns("id,secret,amount")).toEqual(["id", "amount"])
    expect(parseExportColumns("nonsense")).toEqual([])
  })

  it("rejects a poisoned name whole, rather than salvaging part of it", () => {
    expect(parseExportColumns("id,amount; DROP TABLE payments")).toEqual(["id"])
  })

  it("collapses a duplicate rather than writing the column twice", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })

  it("tolerates the spacing a hand-typed URL arrives with", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter", () => {
    expect(parseExportScope(null)).toBe("filter")
    expect(parseExportScope("everything")).toBe("filter")
  })

  it("widens only when the client asks for all payments", () => {
    expect(parseExportScope("all")).toBe("all")
  })
})

describe("exportScopeLabel", () => {
  it("labels an all-payments export", () => {
    expect(exportScopeLabel("all", "disputed")).toBe("all")
  })

  it("labels a filtered export with the status it was filtered by", () => {
    expect(exportScopeLabel("filter", "disputed")).toBe("disputed")
  })

  it("adds no label when the filter does not narrow by status", () => {
    expect(exportScopeLabel("filter", "all")).toBeUndefined()
    expect(exportScopeLabel("filter", undefined)).toBeUndefined()
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope, so a filtered file says what is in it", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("marks an export of the whole table", () => {
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("scrubs a label so nothing from a client can shape a filename", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), '../etc/"passwd'),
    ).toBe("payments-etc-passwd-2026-08-13.csv")
  })
})
