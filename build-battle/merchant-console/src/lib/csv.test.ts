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
 * the column contract. NWP-101 changed which columns ship and made one
 * deliberate change to how a cell is written — the formula guard — and the
 * original eight tests still pass unchanged.
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

describe("toCsv formula guard", () => {
  // Excel treats a leading one of these as a formula. Merchants open these files.
  it.each(["=", "+", "@", "\t"])(
    "prefixes a cell starting with %j so it is read as text",
    (prefix) => {
      const risky = { ...payment, description: `${prefix}SUM(1)` }
      const body = toCsv([risky], ["description"]).split("\n")[1]
      expect(body).toBe(`'${prefix}SUM(1)`)
    },
  )

  it("prefixes and quotes a cell starting with a carriage return", () => {
    const risky = { ...payment, description: "\rSUM(1)" }
    const body = toCsv([risky], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe(`"'\rSUM(1)"`)
  })

  it("still quotes a guarded cell that contains a comma", () => {
    const risky = { ...payment, description: "=SUM(1,2)" }
    const body = toCsv([risky], ["description"]).split("\n")[1]
    expect(body).toBe(`"'=SUM(1,2)"`)
  })

  it("leaves a negative amount alone, since '-' is how refunds are formatted", () => {
    const refund = { ...payment, amount: -500 }
    expect(toCsv([refund], ["amount"])).toBe(["amount", "-$5.00"].join("\n"))
  })

  it("quotes a bare carriage return inside a cell", () => {
    const split = { ...payment, description: "line\rbreak" }
    const body = toCsv([split], ["description"]).split("\n")[1]
    expect(body).toBe(`"line\rbreak"`)
  })
})

describe("parseExportColumns", () => {
  const params = (query: string) => new URLSearchParams(query)

  it("returns the defaults when no columns are named, and they exclude the card last four", () => {
    const columns = parseExportColumns(params("")) ?? []
    expect(columns).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(columns).not.toContain("last4")
    expect(toCsv([payment], columns).split("\n")[0]).not.toContain("last4")
  })

  it("returns a subset in the order it was requested", () => {
    const columns = parseExportColumns(params("columns=amount,id")) ?? []
    expect(columns).toEqual(["amount", "id"])
    expect(toCsv([payment], columns)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("includes the card last four only when it is asked for", () => {
    expect(parseExportColumns(params("columns=id,last4"))).toEqual([
      "id",
      "last4",
    ])
  })

  it("treats an empty selection as invalid rather than producing an empty file", () => {
    expect(parseExportColumns(params("columns="))).toBeNull()
    expect(parseExportColumns(params("columns=,,"))).toBeNull()
    expect(parseExportColumns(params("columns=%20"))).toBeNull()
  })

  it("rejects a column it does not know, including a case mismatch", () => {
    expect(parseExportColumns(params("columns=id,drop_table"))).toBeNull()
    expect(parseExportColumns(params("columns=Last4"))).toBeNull()
  })

  it("accepts repeated params, trims whitespace, and dedupes keeping first order", () => {
    expect(
      parseExportColumns(params("columns=id&columns=%20amount%20,id")),
    ).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter, which is what the old link did", () => {
    expect(parseExportScope(new URLSearchParams(""))).toBe("filter")
  })

  it("accepts the two known scopes and nothing else", () => {
    expect(parseExportScope(new URLSearchParams("scope=all"))).toBe("all")
    expect(parseExportScope(new URLSearchParams("scope=filter"))).toBe("filter")
    expect(parseExportScope(new URLSearchParams("scope=nope"))).toBeNull()
    expect(parseExportScope(new URLSearchParams("scope=ALL"))).toBeNull()
  })
})

describe("exportFilename", () => {
  const date = new Date("2026-03-14T23:00:00.000Z")

  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename("filter", "all", date)).toBe(
      "payments-filtered-2026-03-14.csv",
    )
  })

  it("names the active status when the current filter has one", () => {
    expect(exportFilename("filter", "disputed", date)).toBe(
      "payments-disputed-2026-03-14.csv",
    )
  })

  it("says 'all' for the whole table regardless of the filter", () => {
    expect(exportFilename("all", "disputed", date)).toBe(
      "payments-all-2026-03-14.csv",
    )
  })

  it("only ever contains header-safe characters", () => {
    for (const status of ["all", "captured", "disputed", undefined] as const) {
      for (const scope of ["filter", "all"] as const) {
        expect(exportFilename(scope, status, date)).toMatch(
          /^payments-[a-z]+-\d{4}-\d{2}-\d{2}\.csv$/,
        )
      }
    }
  })
})
