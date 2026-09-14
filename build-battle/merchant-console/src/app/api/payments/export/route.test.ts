import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { store } from "@/data/store"
import { GET } from "./route"

/**
 * The route is the boundary the ticket worries about: column names and scope
 * arrive from the client and must be allowlisted before they reach the header
 * row or the filename. These run against the real seeded store, so counts are
 * deterministic.
 */

function request(query = "") {
  const url = `http://localhost/api/payments/export${query ? `?${query}` : ""}`
  return new NextRequest(url)
}

async function lines(response: Response) {
  return (await response.text()).split("\n")
}

describe("GET /api/payments/export", () => {
  it("serves CSV as an attachment", async () => {
    const response = GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="payments-filtered-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
  })

  it("ships the default columns, without the card last four, when none are named", async () => {
    const [header] = await lines(GET(request()))
    expect(header).toBe(
      "id,created_at,merchant,description,status,method,card_brand,amount,currency",
    )
  })

  it("writes only the requested columns, in the requested order", async () => {
    const [header] = await lines(GET(request("columns=amount,id")))
    expect(header).toBe("amount,id")
  })

  it("rejects an empty column selection with 400 and a message", async () => {
    const response = GET(request("columns="))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(typeof body.message).toBe("string")
  })

  it("rejects a column it does not know", async () => {
    const response = GET(request("columns=id,drop_table"))
    expect(response.status).toBe(400)
  })

  it("rejects an unknown scope", async () => {
    const response = GET(request("scope=everything"))
    expect(response.status).toBe(400)
  })

  it("scope=all drops the filters and returns every payment", async () => {
    const filtered = (await lines(GET(request("status=disputed")))).length - 1
    const all = (await lines(GET(request("status=disputed&scope=all")))).length - 1
    expect(filtered).toBeGreaterThan(0)
    expect(all).toBeGreaterThan(filtered)
    expect(all).toBe(store.payments.length)
  })

  it("names the file after the allowlisted status, or 'all'", async () => {
    expect(
      GET(request("status=disputed")).headers.get("content-disposition"),
    ).toMatch(/filename="payments-disputed-/)
    expect(
      GET(request("status=disputed&scope=all")).headers.get("content-disposition"),
    ).toMatch(/filename="payments-all-/)
    // An off-list status is coerced to "all" upstream and never reaches the header.
    expect(
      GET(request("status=%0d%0aX-Injected")).headers.get("content-disposition"),
    ).toMatch(/filename="payments-filtered-/)
  })
})
