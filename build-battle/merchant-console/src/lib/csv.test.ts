import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportSegment,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping, the
 * column contract, and the server-side allowlists that stand between a client
 * and a filename.
 *
 * NWP-101 moved the currency symbol out of the amount cell and into its own
 * column, so the two cases that asserted "$250.00" now assert "250.00". The
 * escaping contract they were really protecting is covered below by a
 * description containing a comma.
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

  it("leaves the card last four out unless it is asked for", () => {
    expect(toCsv([payment]).split("\n")[0]).not.toContain("last4")
    expect(toCsv([payment], ["last4"])).toBe(["last4", "4242"].join("\n"))
  })

  it("quotes cells containing a comma, so a description does not split", () => {
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

  it("writes the columns in the order asked for, not the allowlist order", () => {
    // Deliberately not EXPORT_COLUMNS order. The serializer obeys the caller,
    // so this fails the moment someone "helpfully" sorts inside toCsv.
    expect(toCsv([payment], ["currency", "id", "amount"])).toBe(
      ["currency,id,amount", "USD,pay_0001,250.00"].join("\n"),
    )
    // Normalising is the parser's job, not the serializer's. Two halves of one
    // contract, and confusing them is how a column set silently reorders.
    expect(parseExportColumns("currency,id,amount")).toEqual([
      "id",
      "amount",
      "currency",
    ])
  })

  it("keeps the card last four out when no columns were requested", () => {
    // The route's path for a link bookmarked before NWP-101 existed. It must
    // land on the safe default rather than on every column.
    const csv = toCsv([payment], parseExportColumns(null))
    expect(csv.split("\n")[0]).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })

  it("produces nothing worth downloading when no column is selected", () => {
    // An empty header above an empty row. This is the file the route must
    // never hand back, which is why it answers 400 before reaching here.
    expect(toCsv([payment], [])).toBe("\n")
    expect(parseExportColumns("")).toEqual([])
  })
})

describe("the amount column", () => {
  it("carries no currency symbol, because currency is its own column", () => {
    expect(toCsv([payment], ["amount", "currency"])).toBe(
      ["amount,currency", "250.00,USD"].join("\n"),
    )
  })

  it("writes a large amount unquoted, so a spreadsheet reads it as a number", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(["amount", "1234567.89"].join("\n"))
  })

  it("keeps a refund negative", () => {
    const refunded = { ...payment, amount: -2550 }
    expect(toCsv([refunded], ["amount"])).toBe(["amount", "-25.50"].join("\n"))
  })

  it("pads the cents of an amount below a dollar", () => {
    const small = { ...payment, amount: 7 }
    expect(toCsv([small], ["amount"])).toBe(["amount", "0.07"].join("\n"))
  })

  it("renders each currency's amount the same way", () => {
    const euros = { ...payment, currency: "EUR" as const }
    expect(toCsv([euros], ["amount", "currency"])).toBe(
      ["amount,currency", "250.00,EUR"].join("\n"),
    )
  })
})

describe("parseExportColumns", () => {
  it("defaults to every column but the card last four", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(parseExportColumns(null)).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("keeps the columns that are on the allowlist", () => {
    expect(parseExportColumns("id,amount,currency")).toEqual([
      "id",
      "amount",
      "currency",
    ])
  })

  it("drops a name that is not a column rather than echoing it back", () => {
    expect(parseExportColumns("id,../../etc/passwd,amount")).toEqual([
      "id",
      "amount",
    ])
    expect(parseExportColumns("id,DROP TABLE payments")).toEqual(["id"])
  })

  it("returns nothing when every name is rejected, so the route can refuse", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("nonsense")).toEqual([])
  })

  it("collapses duplicates and normalises to the canonical order", () => {
    expect(parseExportColumns("amount,id,amount")).toEqual(["id", "amount"])
  })

  it("tolerates the whitespace a hand-edited URL picks up", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("reads the two scopes the dialog offers", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filtered")).toBe("filtered")
  })

  it("falls back to the current filter for anything else", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("ALL")).toBe("filtered")
    expect(parseExportScope("everything")).toBe("filtered")
  })
})

describe("exportSegment", () => {
  it("names the status when the export is scoped to a filtered table", () => {
    expect(exportSegment("filtered", "disputed")).toBe("disputed")
  })

  it("says filtered when the table is scoped by something other than status", () => {
    expect(exportSegment("filtered", "all")).toBe("filtered")
    expect(exportSegment("filtered", undefined)).toBe("filtered")
  })

  it("says all when the export ignores the filters", () => {
    expect(exportSegment("all", "disputed")).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the scope and the UTC date", () => {
    expect(
      exportFilename("disputed", new Date("2026-08-13T23:00:00.000Z")),
    ).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename("all", new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-all-2026-03-14.csv",
    )
  })

  it("refuses a segment that could climb out of the filename", () => {
    expect(exportFilename("../../etc/passwd", new Date("2026-03-14T00:00:00.000Z"))).toBe(
      "payments-filtered-2026-03-14.csv",
    )
    expect(exportFilename('a" onload="', new Date("2026-03-14T00:00:00.000Z"))).toBe(
      "payments-filtered-2026-03-14.csv",
    )
  })
})
