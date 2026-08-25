import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportSlug,
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

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("excludes the card last four, so ops opts in rather than out", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })

  it("is otherwise every column, in the same order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("keeps the last four out of a default export, not just the column list", () => {
    const csv = toCsv([payment], DEFAULT_EXPORT_COLUMNS)
    expect(csv).not.toContain("last4")
    expect(csv).not.toContain("4242")
  })
})

describe("parseExportColumns", () => {
  it("defaults to every column but the card last four when none are requested", () => {
    expect(parseExportColumns(null)).toEqual(DEFAULT_EXPORT_COLUMNS)
  })

  it("also defaults for an empty array, which is what URLSearchParams.getAll returns for an absent param", () => {
    expect(parseExportColumns([])).toEqual(DEFAULT_EXPORT_COLUMNS)
  })

  it("drops names that are not on the allowlist, rather than passing them through", () => {
    expect(parseExportColumns(["id", "evil", 'last4"; DROP'])).toEqual(["id"])
  })

  it("returns nothing when no requested name survives, so the route can refuse", () => {
    expect(parseExportColumns(["nope"])).toEqual([])
  })

  it("drops duplicates", () => {
    expect(parseExportColumns(["id", "id", "amount"])).toEqual(["id", "amount"])
  })

  it("accepts a comma-joined value from a hand-typed URL", () => {
    expect(parseExportColumns(["id,amount"])).toEqual(["id", "amount"])
  })

  it("accepts repeated params, the shape a form submits", () => {
    expect(parseExportColumns(["id", "amount"])).toEqual(["id", "amount"])
  })

  it("drops empty and whitespace-only tokens", () => {
    expect(parseExportColumns([""])).toEqual([])
    expect(parseExportColumns([" , "])).toEqual([])
  })

  it("matches case-sensitively, like the rest of this app's allowlists", () => {
    expect(parseExportColumns(["ID", "Last4"])).toEqual([])
  })

  it("bounds a pathologically large request instead of doing unbounded work", () => {
    const huge = new Array(10_000).fill("id")
    expect(parseExportColumns(huge)).toEqual(["id"])
  })

  it("returns columns in canonical order regardless of the order requested", () => {
    expect(parseExportColumns(["amount", "id"])).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("accepts the two scopes ops can pick", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filtered")).toBe("filtered")
  })

  it("falls back to the current filter for anything unrecognized", () => {
    expect(parseExportScope(null)).toBe("filtered")
    expect(parseExportScope("../etc/passwd")).toBe("filtered")
  })
})

describe("exportSlug", () => {
  it("names the scope when the whole book is exported, even if a status filter is set", () => {
    expect(exportSlug("all", { status: "disputed" })).toBe("all")
  })

  it("names the status when the current filter is exported", () => {
    expect(exportSlug("filtered", { status: "disputed" })).toBe("disputed")
  })

  it("leaves the slug off when no status is picked", () => {
    expect(exportSlug("filtered", { status: "all" })).toBeNull()
    expect(exportSlug("filtered", {})).toBeNull()
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope between the prefix and the date, matching the ticket's example", () => {
    expect(exportFilename(new Date("2026-08-13T00:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })

  it("slugs the all-payments scope the same way", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"), "all")).toBe(
      "payments-all-2026-03-14.csv",
    )
  })

  it("never lets a quote or semicolon from the slug reach the filename", () => {
    const result = exportFilename(
      new Date("2026-03-14T23:00:00.000Z"),
      "x\"; filename*=UTF-8''evil.html",
    )
    expect(result).not.toContain('"')
    expect(result).not.toContain(";")
    expect(result).toMatch(/^payments-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it("never lets a carriage return or newline from the slug reach the filename", () => {
    const result = exportFilename(
      new Date("2026-03-14T23:00:00.000Z"),
      "a\r\nContent-Type: text/html",
    )
    expect(result).not.toContain("\r")
    expect(result).not.toContain("\n")
  })

  it("never lets a path separator from the slug reach the filename", () => {
    const result = exportFilename(new Date("2026-03-14T23:00:00.000Z"), "../../etc/passwd")
    expect(result).not.toContain("/")
    expect(result).not.toContain("..")
  })

  it("bounds a pathologically long slug", () => {
    const result = exportFilename(new Date("2026-03-14T23:00:00.000Z"), "a".repeat(500))
    expect(result.length).toBeLessThan(64)
  })

  it("omits the slug segment entirely when nothing about it survives sanitizing", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"), "   ")).toBe(
      "payments-2026-03-14.csv",
    )
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"), "!!!")).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("collapses non-ASCII characters rather than passing them through", () => {
    const result = exportFilename(new Date("2026-03-14T23:00:00.000Z"), "café‮")
    expect(result).toMatch(/^payments-[a-z0-9.-]+$/)
  })
})
