import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { store } from "@/data/store"
import { GET } from "./route"

/**
 * The export route is where client input meets the query builder and the
 * filename. These tests pin the contract NWP-101 adds: validated columns and
 * scope, 400 on anything off the allowlist, and no pagination.
 */

const today = new Date().toISOString().slice(0, 10)

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/payments/export?${query}`))
}

async function lines(response: Response) {
  return (await response.text()).split("\n")
}

describe("GET /api/payments/export", () => {
  it("writes only the requested columns, in the requested order", async () => {
    const response = get("columns=id,amount")
    expect(response.status).toBe(200)
    const [header, first] = await lines(response)
    expect(header).toBe("id,amount")
    expect(first.split(",")[0]).toMatch(/^pay_/)
  })

  it("defaults to every column except the card last four", async () => {
    const [header] = await lines(get(""))
    expect(header).toBe(
      "id,created_at,merchant,description,status,method,card_brand,amount,currency",
    )
  })

  it("rejects a column outside the allowlist with a 400 and no file", async () => {
    const response = get("columns=id,pan")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: 'Unknown column "pan"' })
  })

  it("rejects an empty column selection with a 400", async () => {
    const response = get("columns=")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: "Select at least one column" })
  })

  it("rejects a scope outside the allowlist with a 400", async () => {
    const response = get("scope=nope")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: 'Unknown scope "nope"' })
  })

  it("exports the whole filtered set, not one page", async () => {
    const disputed = store.payments.filter((p) => p.status === "disputed").length
    const body = await lines(get("status=disputed&page=2"))
    expect(body).toHaveLength(disputed + 1)
    expect(disputed).toBeGreaterThan(20)
  })

  it("ignores the filters when scope is all, but keeps them out of the filename", async () => {
    const response = get("scope=all&status=disputed")
    const body = await lines(response)
    expect(body).toHaveLength(store.payments.length + 1)
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="payments-all-${today}.csv"`,
    )
  })

  it("names the file after the status filter and the UTC date", async () => {
    const response = get("status=disputed")
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="payments-disputed-${today}.csv"`,
    )
  })

  it("formats the amount once and keeps the currency in its own column", async () => {
    const [, first] = await lines(get("columns=amount,currency&merchantId=mch_01"))
    const [amount, currency] = first.split(/,(?=[A-Z]{3}$)/)
    expect(amount).toMatch(/^"?\$\d{1,3}(,\d{3})*\.\d{2}"?$/)
    expect(currency).toBe(store.payments.find((p) => p.merchantId === "mch_01")!.currency)
  })
})
