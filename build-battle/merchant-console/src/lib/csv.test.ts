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

describe("parseExportColumns", () => {
  it("keeps a requested subset in the order asked for, not the canonical one", () => {
    const columns = parseExportColumns("amount,id,merchant")
    expect(columns).toEqual(["amount", "id", "merchant"])
    // The serializer honors that order, which is the point of choosing it.
    expect(toCsv([payment], columns)).toBe(
      ["amount,id,merchant", "$250.00,pay_0001,Lumen Coffee Roasters"].join(
        "\n",
      ),
    )
  })

  it("excludes the card last four by default", () => {
    expect(parseExportColumns(null)).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(parseExportColumns(null)).not.toContain("last4")
    expect(toCsv([payment], parseExportColumns(null))).not.toContain("4242")
    // Every other column still ships, so the default is a clean file, not a thin one.
    expect(parseExportColumns(null)).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("includes the card last four only when asked for by name", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("returns nothing for an empty selection, so the caller can refuse it", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns(",,")).toEqual([])
  })

  it("drops column names that are not on the allowlist", () => {
    expect(parseExportColumns("id,cardholder_name,amount")).toEqual([
      "id",
      "amount",
    ])
    // A request made entirely of unknown names is an empty selection, never
    // a silent fallback to every column.
    expect(parseExportColumns("password,1=1,cvv")).toEqual([])
  })

  it("collapses a duplicated column to one, keeping its first position", () => {
    expect(parseExportColumns("amount,id,amount")).toEqual(["amount", "id"])
  })

  it("tolerates whitespace around names", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope, so two files in a downloads folder tell themselves apart", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(new Date("2026-08-13T09:00:00.000Z"), "all")).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("sanitizes a scope before it reaches a filename", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "../../etc/passwd"),
    ).toBe("payments-etc-passwd-2026-08-13.csv")
  })
})
