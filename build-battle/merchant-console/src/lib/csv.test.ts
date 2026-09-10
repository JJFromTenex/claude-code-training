import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportScope,
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
    expect(toCsv([large], ["amount"])).toBe(
      ["amount", '"$1,234,567.89"'].join("\n"),
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
})

describe("parseExportColumns", () => {
  it("falls back to the default set when nothing in particular was asked for", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("leaves the card last four out by default, so a file can go to a merchant unedited", () => {
    expect(parseExportColumns(null)).not.toContain("last4")
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("includes the card last four when ops asks for it explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("keeps a subset in the order requested, not the order declared", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
  })

  it("drops names that are not columns, so none reaches the serializer", () => {
    expect(parseExportColumns("id,shoe_size,amount")).toEqual(["id", "amount"])
  })

  it("collapses repeats, so a header cannot name the same column twice", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })

  it("ignores surrounding whitespace and empty segments", () => {
    expect(parseExportColumns("id, amount,,")).toEqual(["id", "amount"])
  })

  it("returns nothing for an empty selection, so the route can refuse it", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("shoe_size")).toEqual([])
  })

  it("hands toCsv a set it can write, so the two stay in step", () => {
    expect(toCsv([payment], parseExportColumns("id,amount"))).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope ahead of the date, so two exports are told apart by content", () => {
    const day = new Date("2026-08-13T09:00:00.000Z")
    expect(exportFilename(day, "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(day, "all")).toBe("payments-all-2026-08-13.csv")
  })

  it("keeps the plain name when nothing narrowed the export", () => {
    expect(
      exportFilename(new Date("2026-03-14T23:00:00.000Z"), undefined),
    ).toBe("payments-2026-03-14.csv")
  })

  it("stays on the UTC day once a scope is present", () => {
    expect(
      exportFilename(new Date("2026-03-14T23:00:00.000Z"), "refunded"),
    ).toBe("payments-refunded-2026-03-14.csv")
  })

  it("strips what a Content-Disposition header should never carry", () => {
    // The type is the first defence and this is the second: the segment is
    // interpolated into a quoted header, so a cast must not be able to break
    // out of it.
    expect(
      exportFilename(
        new Date("2026-03-14T00:00:00.000Z"),
        'all"' as ExportScope,
      ),
    ).toBe("payments-all-2026-03-14.csv")
  })
})
