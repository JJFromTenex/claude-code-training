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

/**
 * Column names arrive from the client, so the parse layer is where the
 * allowlist has to hold. `toCsv` above is trusted to receive valid columns;
 * these tests are what makes that true.
 */
describe("parseExportColumns", () => {
  it("leaves the card last four out of the default selection", () => {
    const columns = parseExportColumns(null)
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")
  })

  it("keeps a requested subset, in the order requested", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
  })

  it("includes the card last four only when it is asked for", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("drops names that are not columns rather than trusting them", () => {
    expect(parseExportColumns("id,drop_table,../../etc/passwd")).toEqual(["id"])
  })

  it("returns an empty selection when nothing valid was asked for", () => {
    expect(parseExportColumns("")).toEqual([])
    expect(parseExportColumns("nonsense")).toEqual([])
  })

  it("collapses duplicates, keeping the first position", () => {
    expect(parseExportColumns("amount,id,amount")).toEqual(["amount", "id"])
  })
})

describe("parseExportScope", () => {
  it("defaults to the current filter, and only widens when asked", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("everything")).toBe("filtered")
    expect(parseExportScope("all")).toBe("all")
  })
})

describe("exportLabel", () => {
  it("names the status when the export is scoped to one", () => {
    expect(exportLabel("filtered", "disputed")).toBe("disputed")
  })

  it("falls back to the scope when no single status applies", () => {
    expect(exportLabel("filtered", "all")).toBe("filtered")
    expect(exportLabel("filtered", undefined)).toBe("filtered")
    expect(exportLabel("all", "disputed")).toBe("all")
  })
})

describe("exportFilename", () => {
  it("stamps the label and the UTC date", () => {
    expect(
      exportFilename("disputed", new Date("2026-03-14T23:00:00.000Z")),
    ).toBe("payments-disputed-2026-03-14.csv")
  })

  it("distinguishes a filtered export from an everything export", () => {
    const date = new Date("2026-03-14T23:00:00.000Z")
    expect(exportFilename("all", date)).toBe("payments-all-2026-03-14.csv")
    expect(exportFilename("filtered", date)).toBe(
      "payments-filtered-2026-03-14.csv",
    )
  })
})
