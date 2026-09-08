import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
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

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope label between the prefix and the date", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })
})

/**
 * NWP-101: column and scope selection. The names come from the client, so
 * the parser is the allowlist. Anything that gets past it reaches toCsv and
 * the filename, which is why the failure cases matter as much as the happy ones.
 */

describe("parseExportColumns", () => {
  it("keeps a subset of columns in the requested order", () => {
    const result = parseExportColumns("amount,id")
    expect(result).toEqual({ ok: true, value: ["amount", "id"] })
    if (!result.ok) throw new Error(result.message)
    expect(toCsv([payment], result.value)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out by default", () => {
    const result = parseExportColumns(null)
    if (!result.ok) throw new Error(result.message)
    expect(result.value).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(result.value).not.toContain("last4")
    expect(toCsv([payment], result.value).split("\n")[0]).not.toMatch(/last4/)
    // Opting in is still possible: the column exists, it is just not default.
    expect(EXPORT_COLUMNS).toContain("last4")
  })

  it("refuses an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      message: "Choose at least one column to export.",
    })
    expect(parseExportColumns(" , ")).toMatchObject({ ok: false })
  })

  it("rejects a column that is not on the allowlist, and names it", () => {
    const result = parseExportColumns("id,pan")
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("expected the unknown column to be refused")
    expect(result.message).toContain("pan")
  })

  it("writes a repeated column once", () => {
    expect(parseExportColumns("id,id,amount")).toEqual({
      ok: true,
      value: ["id", "amount"],
    })
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter", () => {
    expect(parseExportScope(null)).toEqual({ ok: true, value: "current" })
  })

  it("accepts all", () => {
    expect(parseExportScope("all")).toEqual({ ok: true, value: "all" })
  })

  it("rejects anything off the allowlist", () => {
    expect(parseExportScope("everything")).toMatchObject({ ok: false })
  })
})

describe("exportLabel", () => {
  it("says all when the whole table is exported", () => {
    expect(exportLabel("all", "disputed")).toBe("all")
  })

  it("uses the status for a status-filtered export", () => {
    expect(exportLabel("current", "disputed")).toBe("disputed")
  })

  it("adds nothing for an unfiltered current export, so today's name is unchanged", () => {
    expect(exportLabel("current", "all")).toBeUndefined()
    expect(exportLabel("current")).toBeUndefined()
  })
})
