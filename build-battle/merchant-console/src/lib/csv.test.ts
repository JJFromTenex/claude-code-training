import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  isExportScope,
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

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})

describe("exportFilename with a scope label", () => {
  const day = new Date("2026-08-13T09:00:00.000Z")

  it("puts the label between the prefix and the UTC date", () => {
    expect(exportFilename(day, "disputed")).toBe("payments-disputed-2026-08-13.csv")
    expect(exportFilename(day, "all")).toBe("payments-all-2026-08-13.csv")
    expect(exportFilename(day, "filtered")).toBe("payments-filtered-2026-08-13.csv")
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves the card last four out", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })

  it("keeps every other column, in canonical order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })
})

describe("parseExportColumns", () => {
  it("falls back to the default set when the param is absent", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns(" , ,")).toBeNull()
  })

  it("rejects the whole request if any name is not on the allowlist", () => {
    expect(parseExportColumns("id,nope")).toBeNull()
    expect(parseExportColumns("id,__proto__")).toBeNull()
    expect(parseExportColumns('id,amount"; rm -rf')).toBeNull()
  })

  it("collapses duplicates", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })

  it("returns canonical order whatever order the client sent", () => {
    expect(parseExportColumns("currency,amount,id")).toEqual([
      "id",
      "amount",
      "currency",
    ])
  })

  it("includes last four only when it is asked for", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("serializes the parsed set with no last four cell", () => {
    const header = toCsv([payment], parseExportColumns(null)!).split("\n")[0]
    expect(header.split(",")).not.toContain("last4")
  })
})

describe("isExportScope", () => {
  it("accepts current and all, and nothing else", () => {
    expect(isExportScope("current")).toBe(true)
    expect(isExportScope("all")).toBe(true)
    expect(isExportScope("everything")).toBe(false)
    expect(isExportScope("")).toBe(false)
  })
})

describe("exportLabel", () => {
  it("is all for the all scope, whatever the filters", () => {
    expect(exportLabel("all", { status: "disputed", merchantId: "mch_01" })).toBe("all")
  })

  it("is the status when the current filter has one", () => {
    expect(exportLabel("current", { status: "disputed" })).toBe("disputed")
  })

  it("is filtered when only a merchant, search, or date range is set", () => {
    expect(exportLabel("current", { status: "all", merchantId: "mch_01" })).toBe(
      "filtered",
    )
    expect(exportLabel("current", { status: "all", search: "1180" })).toBe("filtered")
    expect(exportLabel("current", { from: "2026-08-01T00:00:00.000Z" })).toBe(
      "filtered",
    )
  })

  it("is all when the current filter is empty", () => {
    expect(exportLabel("current", { status: "all", search: "  " })).toBe("all")
  })

  it("never lets client text into the filename", () => {
    const label = exportLabel("current", {
      status: "all",
      merchantId: "../../etc/passwd",
      search: 'x"; filename=evil.exe',
    })
    expect(label).toBe("filtered")
  })
})
