import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { PAGE_SIZE } from "@/data/queries"
import { GET } from "./route"

/**
 * The export route is where client input meets a query and a filename, so
 * these tests are the enforcement check: the column allowlist, the scope,
 * and the refusal to hand back an empty file. NWP-101.
 *
 * Row counts are deterministic — the store is generated from a fixed seed —
 * but these assert relationships rather than magic numbers, so extending the
 * generator does not break them.
 */

const call = (query: string) =>
  GET(new NextRequest(`http://localhost/api/payments/export${query}`))

const bodyOf = async (query: string) => (await call(query).text()).split("\n")

const headerOf = async (query: string) => (await bodyOf(query))[0].split(",")

const filenameOf = (query: string) =>
  call(query).headers.get("content-disposition") ?? ""

describe("GET /api/payments/export", () => {
  it("serves CSV with a download filename", async () => {
    const response = call("?columns=id")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; /)
  })

  it("leaves the card last four out of the default export", async () => {
    const header = await headerOf("")
    expect(header).not.toContain("last4")
    expect(header).toContain("id")
  })

  it("writes only the requested columns, in the order requested", async () => {
    expect(await headerOf("?columns=amount,id")).toEqual(["amount", "id"])
  })

  it("includes the card last four only when it is asked for", async () => {
    expect(await headerOf("?columns=id,last4")).toEqual(["id", "last4"])
  })

  it("drops column names that are not on the allowlist", async () => {
    expect(await headerOf("?columns=id,../../etc/passwd,DROP TABLE")).toEqual([
      "id",
    ])
  })

  it("refuses an empty selection rather than serving an empty file", async () => {
    const response = call("?columns=")
    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("application/json")

    const body = await response.json()
    expect(body.message).toBe("Select at least one column to export.")
  })

  it("refuses a selection in which nothing is allowed", async () => {
    expect(call("?columns=nope,also_nope").status).toBe(400)
  })

  it("honors the active filter, so every row matches it", async () => {
    const [header, ...rows] = await bodyOf("?status=disputed&columns=status")
    expect(header).toBe("status")
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows)).toEqual(new Set(["disputed"]))
  })

  it("ignores the filters when the scope is all payments", async () => {
    const filtered = await bodyOf("?status=disputed&columns=status")
    const all = await bodyOf("?status=disputed&scope=all&columns=status")

    expect(all.length).toBeGreaterThan(filtered.length)
    expect(new Set(all.slice(1)).size).toBeGreaterThan(1)
  })

  it("exports the whole filtered set, not just the visible page", async () => {
    const [, ...rows] = await bodyOf("?status=disputed&columns=id")
    expect(rows.length).toBeGreaterThan(PAGE_SIZE)
  })

  it("names the status and the date in the filename", () => {
    expect(filenameOf("?status=disputed")).toMatch(
      /^attachment; filename="payments-disputed-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
  })

  it("names the all-payments scope in the filename", () => {
    expect(filenameOf("?status=disputed&scope=all")).toMatch(
      /^attachment; filename="payments-all-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
  })

  it("leaves the descriptor out when no status narrows the file", () => {
    expect(filenameOf("?merchantId=mch_01")).toMatch(
      /^attachment; filename="payments-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
  })

  it("formats the amount once and keeps currency in its own column", async () => {
    const [header, row] = await bodyOf("?columns=amount,currency")
    expect(header).toBe("amount,currency")

    // A formatted amount may carry a thousands separator, so it arrives
    // quoted; the currency code is always the last cell either way.
    expect(row).toMatch(/^("?[^",]*[\d.]+"?|"[^"]+"),(USD|EUR|GBP)$/)
  })
})
