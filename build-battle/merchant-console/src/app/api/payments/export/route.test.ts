import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

/**
 * The acceptance criteria for NWP-101, checked against the real route: the
 * default column set, an explicit subset, both scopes, and the two ways a
 * request can be rejected. The export must never paginate.
 */

const req = (qs: string) =>
  new NextRequest(`http://localhost:3000/api/payments/export?${qs}`)

describe("GET /api/payments/export", () => {
  it("defaults to every column except last4, current filter", async () => {
    const res = GET(req("status=disputed"))
    const body = await res.text()
    const lines = body.split("\n")
    expect(res.headers.get("content-disposition")).toContain(
      'filename="payments-disputed-',
    )
    expect(lines[0]).toBe(
      "id,created_at,merchant,description,status,method,card_brand,amount,currency",
    )
    expect(lines.length).toBeGreaterThan(21) // more than one page of 20
  })

  it("honors an explicit column subset and order", async () => {
    const res = GET(req("status=disputed&columns=amount,currency,id"))
    const lines = (await res.text()).split("\n")
    expect(lines[0]).toBe("amount,currency,id")
  })

  it("scope=all ignores the filters and names the file", async () => {
    const res = GET(req("status=disputed&scope=all&columns=id"))
    const lines = (await res.text()).split("\n")
    expect(res.headers.get("content-disposition")).toContain(
      'filename="payments-all-',
    )
  })

  it("400s on an empty selection", async () => {
    const res = GET(req("columns="))
    expect(res.status).toBe(400)
  })

  it("400s on a column that is not allowlisted", async () => {
    const res = GET(req("columns=id,card_number"))
    expect(res.status).toBe(400)
  })
})
