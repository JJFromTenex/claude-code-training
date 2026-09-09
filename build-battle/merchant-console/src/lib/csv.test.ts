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
 * Column and scope selection arrive from the client as query params. These
 * pin the allowlist: what ships by default, what an explicit list yields, and
 * that nothing outside EXPORT_COLUMNS can reach the serializer.
 */
describe("parseExportColumns", () => {
  it("returns the requested subset, in the requested order", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
  })

  it("drops names that are not export columns and keeps the rest", () => {
    expect(parseExportColumns("id,drop table,amount,last4x")).toEqual([
      "id",
      "amount",
    ])
  })

  it("excludes card last four when no columns are given", () => {
    const columns = parseExportColumns(null)
    expect(columns).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(columns).not.toContain("last4")
    expect(columns).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("includes card last four only when it is asked for explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("returns an empty list for an empty selection, never a default", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("nope,also_nope")).toEqual([])
  })

  it("dedupes a column requested twice and trims whitespace", () => {
    expect(parseExportColumns(" id , id ,amount")).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("accepts the two known scopes and defaults to the current filter", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filtered")).toBe("filtered")
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("everything")).toBe("filtered")
  })
})

describe("exportFilename", () => {
  const date = new Date("2026-03-14T23:00:00.000Z")

  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename("filtered", { status: "all" }, date)).toBe(
      "payments-filtered-2026-03-14.csv",
    )
  })

  it("names the status when the current filter has one", () => {
    expect(exportFilename("filtered", { status: "disputed" }, date)).toBe(
      "payments-disputed-2026-03-14.csv",
    )
  })

  it("says all when the scope is every payment, whatever the filter", () => {
    expect(exportFilename("all", { status: "disputed" }, date)).toBe(
      "payments-all-2026-03-14.csv",
    )
  })
})
