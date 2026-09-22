import { describe, expect, it } from "vitest"
import { Payment, PaymentFilters } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  describeScope,
  EXPORT_COLUMNS,
  exportFilename,
  selectColumns,
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

describe("selectColumns", () => {
  it("keeps a subset in the order it was asked for", () => {
    const selection = selectColumns("amount,id,merchant")
    expect(selection).toEqual({
      ok: true,
      columns: ["amount", "id", "merchant"],
    })
  })

  it("serializes that subset in the same order", () => {
    const selection = selectColumns("amount,id")
    if (!selection.ok) throw new Error("expected a valid selection")
    expect(toCsv([payment], selection.columns)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out by default", () => {
    const selection = selectColumns(null)
    if (!selection.ok) throw new Error("expected a valid selection")
    expect(selection.columns).not.toContain("last4")
    expect(selection.columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("still includes every other column by default", () => {
    const selection = selectColumns(null)
    if (!selection.ok) throw new Error("expected a valid selection")
    const omitted = EXPORT_COLUMNS.filter(
      (column) => !selection.columns.includes(column),
    )
    expect(omitted).toEqual(["last4"])
  })

  it("ships the last four only when it is asked for by name", () => {
    expect(selectColumns("id,last4")).toEqual({
      ok: true,
      columns: ["id", "last4"],
    })
  })

  it("refuses an empty selection rather than writing a header-only file", () => {
    expect(selectColumns("")).toEqual({
      ok: false,
      message: "Choose at least one column to export.",
    })
  })

  it("refuses a selection of nothing but separators", () => {
    expect(selectColumns(" , , ").ok).toBe(false)
  })

  it("refuses a column that is not on the allowlist", () => {
    expect(selectColumns("id,not_a_column")).toEqual({
      ok: false,
      message: "That export column is not recognized.",
    })
  })

  it("refuses the whole request when one column of many is unknown", () => {
    expect(selectColumns("id,amount,../../etc/passwd").ok).toBe(false)
  })
})

describe("describeScope", () => {
  const filters = (over: PaymentFilters = {}): PaymentFilters => ({
    status: "all",
    ...over,
  })

  it("calls an all-payments export 'all', whatever the filters say", () => {
    expect(describeScope("all", filters({ status: "disputed" }))).toBe("all")
  })

  it("names the status when that is what narrowed the export", () => {
    expect(describeScope("filter", filters({ status: "disputed" }))).toBe(
      "disputed",
    )
  })

  it("says 'filtered' when something other than status narrowed it", () => {
    expect(describeScope("filter", filters({ search: "coffee" }))).toBe(
      "filtered",
    )
  })

  it("says 'all' when the current filter narrows nothing", () => {
    expect(describeScope("filter", filters())).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope between the prefix and the date", () => {
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("keeps a descriptor safe for a Content-Disposition header", () => {
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), 'x"; rm -rf /'),
    ).toBe("payments-x-rm-rf-2026-08-13.csv")
  })
})
