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

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })
})

/**
 * NWP-101 added the column choice. The allowlist is the security boundary —
 * these names arrive from the client and end up in a file and a filename — so
 * the rejection cases matter as much as the happy path.
 */

describe("parseExportColumns", () => {
  it("returns the requested subset in the requested order", () => {
    expect(parseExportColumns("amount,id,status")).toEqual([
      "amount",
      "id",
      "status",
    ])
  })

  it("excludes the card last four by default", () => {
    expect(parseExportColumns(null)).toEqual(DEFAULT_EXPORT_COLUMNS)
    expect(parseExportColumns(null)).not.toContain("last4")
    expect(parseExportColumns(null)).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("still sends the last four when it is asked for explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("rejects an empty selection rather than writing a header-only file", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns("   ")).toBeNull()
    expect(parseExportColumns(",,")).toBeNull()
  })

  it("rejects a name that is not on the allowlist", () => {
    expect(parseExportColumns("id,secret")).toBeNull()
    expect(parseExportColumns("id;drop table payments")).toBeNull()
    expect(parseExportColumns("../../etc/passwd")).toBeNull()
  })

  it("collapses a duplicate to its first position", () => {
    expect(parseExportColumns("id,amount,id")).toEqual(["id", "amount"])
  })

  it("tolerates whitespace around a name", () => {
    expect(parseExportColumns(" id , amount ")).toEqual(["id", "amount"])
  })
})

describe("toCsv with a chosen column set", () => {
  it("writes the chosen subset in the chosen order", () => {
    const columns = parseExportColumns("amount,id")
    expect(columns).not.toBeNull()
    expect(toCsv([payment], columns!)).toBe(
      ["amount,id", "$250.00,pay_0001"].join("\n"),
    )
  })

  it("leaves the card last four out of a default export", () => {
    const header = toCsv([payment], DEFAULT_EXPORT_COLUMNS).split("\n")[0]
    expect(header.split(",")).not.toContain("last4")
    expect(header).toContain("card_brand")
  })

  it("keeps amount and currency as separate columns", () => {
    expect(toCsv([payment], ["amount", "currency"])).toBe(
      ["amount,currency", "$250.00,USD"].join("\n"),
    )
  })
})

describe("exportFilename with a scope", () => {
  it("names the scope, as the ticket asks", () => {
    const date = new Date("2026-08-13T00:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(date, "all")).toBe("payments-all-2026-08-13.csv")
  })

  it("slugs the scope rather than trusting it in a filename", () => {
    const date = new Date("2026-08-13T00:00:00.000Z")
    expect(exportFilename(date, "../../etc/passwd")).toBe(
      "payments-etc-passwd-2026-08-13.csv",
    )
  })

  it("omits the segment when there is no scope", () => {
    const date = new Date("2026-08-13T00:00:00.000Z")
    expect(exportFilename(date, undefined)).toBe("payments-2026-08-13.csv")
  })
})
