import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { GET } from "./route"

/**
 * The route is where a client's column and scope choices are enforced, so the
 * cases that matter here are the ones that decide what leaves the building:
 * an empty file, an everything-file, or a file with card data in it.
 *
 * It is a plain function of a NextRequest over the in-memory store, so it
 * needs no DOM and no running server.
 */

const call = (query: string) =>
  GET(new NextRequest(`http://localhost/api/payments/export${query}`))

const body = async (query: string) => (await call(query)).text()
const header = async (query: string) => {
  const lines = (await body(query)).split("\n")
  return { header: lines[0], dataRows: lines.length - 1 }
}

describe("GET /api/payments/export", () => {
  it("omits the card last four when no columns are requested", async () => {
    const { header: columns } = await header("")
    expect(columns).not.toContain("last4")
    expect(columns).toBe(
      "id,created_at,merchant,description,status,method,card_brand,amount,currency",
    )
  })

  it("includes the card last four only when it is named", async () => {
    const { header: columns } = await header("?columns=id,last4")
    expect(columns).toBe("id,last4")
  })

  it("writes only the requested columns", async () => {
    const { header: columns } = await header("?columns=amount,id")
    expect(columns).toBe("amount,id")
  })

  it("drops an unknown column name rather than echoing it", async () => {
    const { header: columns } = await header(
      "?columns=id,'; DROP TABLE payments--,amount",
    )
    expect(columns).toBe("id,amount")
  })

  it("rejects an empty selection instead of writing a header-only file", async () => {
    const response = await call("?columns=")
    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("application/json")
    await expect(response.json()).resolves.toEqual({
      message: "Select at least one column to export.",
    })
  })

  it("accepts columns repeated as separate params", async () => {
    const { header: columns } = await header("?columns=id&columns=amount")
    expect(columns).toBe("id,amount")
  })

  it("exports the whole filtered set, not one page of twenty", async () => {
    const { dataRows } = await header("?status=disputed&columns=id")
    expect(dataRows).toBeGreaterThan(20)
  })

  it("scope=all ignores the filters and returns strictly more rows", async () => {
    const filtered = await header("?status=disputed&columns=id")
    const everything = await header("?status=disputed&scope=all&columns=id")
    expect(everything.dataRows).toBeGreaterThan(filtered.dataRows)
  })

  it("names the file for the status when the status is the whole filter", async () => {
    const response = await call("?status=disputed&columns=id")
    expect(response.headers.get("content-disposition")).toContain(
      'filename="payments-disputed-',
    )
  })

  it("does not name the file for the status when a merchant narrows it too", async () => {
    const response = await call(
      "?status=disputed&merchantId=mch_01&columns=id",
    )
    expect(response.headers.get("content-disposition")).toContain(
      'filename="payments-filtered-',
    )
  })

  it("names an all-payments file all, whatever filters came along", async () => {
    const response = await call("?status=disputed&scope=all&columns=id")
    expect(response.headers.get("content-disposition")).toContain(
      'filename="payments-all-',
    )
  })

  it("keeps a client string out of the response header", async () => {
    const response = await call(
      `?search=${encodeURIComponent('";\r\nX-Injected: 1')}&columns=id`,
    )
    const disposition = response.headers.get("content-disposition") ?? ""
    expect(disposition).toContain('filename="payments-filtered-')
    expect(response.headers.get("x-injected")).toBeNull()
  })

  it("serves CSV as an attachment", async () => {
    const response = await call("?columns=id")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    )
    expect(response.headers.get("content-disposition")).toContain("attachment")
  })
})
