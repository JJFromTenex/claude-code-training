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
 * NWP-101: ops picks the columns, so the column names arrive from the browser.
 * These cover the serializer's half of that — the allowlist, the ordering, and
 * the empty case the route turns into a 400 rather than a headerless file.
 */
describe("parseExportColumns", () => {
  it("falls back to the default set when the caller picks nothing", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("leaves the card last four out of the default set", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    // Still exportable — ops has to ask for it.
    expect(EXPORT_COLUMNS).toContain("last4")
  })

  it("keeps every other column in the default set", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("returns a subset in the order requested, not the declared order", () => {
    expect(parseExportColumns("amount,id,merchant")).toEqual([
      "amount",
      "id",
      "merchant",
    ])
  })

  it("includes the last four when it is asked for explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("drops names that are not columns rather than trusting them", () => {
    expect(parseExportColumns("id,not_a_column,amount")).toEqual([
      "id",
      "amount",
    ])
  })

  it("drops an injection attempt instead of passing it through", () => {
    expect(parseExportColumns("id,1;DROP TABLE payments,amount")).toEqual([
      "id",
      "amount",
    ])
  })

  it("tolerates whitespace around names", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })

  it("collapses duplicates, keeping the first position", () => {
    expect(parseExportColumns("id,amount,id")).toEqual(["id", "amount"])
  })

  it("returns nothing for an empty selection, so the route can refuse it", () => {
    expect(parseExportColumns("")).toEqual([])
  })

  it("returns nothing when no requested name is a real column", () => {
    expect(parseExportColumns("bogus,alsobogus")).toEqual([])
  })

  it("would write blank lines if an empty selection ever reached toCsv", () => {
    // Pinned to show why the route rejects this instead of serializing it: no
    // header and one empty line per payment is a file ops cannot use and
    // cannot easily tell is broken. The 400 is the feature.
    expect(toCsv([payment], parseExportColumns(""))).toBe("\n")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope when given one, so exports do not collide", () => {
    expect(
      exportFilename(new Date("2026-03-14T23:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-03-14.csv")
  })

  it("slugs a scope label rather than putting it in a filename raw", () => {
    expect(exportFilename(new Date("2026-03-14T00:00:00.000Z"), "All Payments")).toBe(
      "payments-all-payments-2026-03-14.csv",
    )
  })

  it("ignores a label that slugs to nothing", () => {
    expect(exportFilename(new Date("2026-03-14T00:00:00.000Z"), "///")).toBe(
      "payments-2026-03-14.csv",
    )
  })
})
