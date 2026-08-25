import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

const call = (qs: string) =>
  GET(new NextRequest(`http://localhost:3000/api/payments/export${qs}`))

describe("export route (smoke)", () => {
  it("omits last4 with no columns parameter", async () => {
    const res = await call("")
    const header = (await res.text()).split("\n")[0]
    expect(header).not.toContain("last4")
  })

  it("honours a requested subset and stamps the scope", async () => {
    const res = await call("?status=disputed&columns=id,amount")
    expect((await res.text()).split("\n")[0]).toBe("id,amount")
    expect(res.headers.get("content-disposition")).toContain(
      "payments-disputed-",
    )
  })

  it("drops an unknown column name", async () => {
    const res = await call("?columns=id,password")
    expect((await res.text()).split("\n")[0]).toBe("id")
  })

  it("refuses an empty selection instead of writing an empty file", async () => {
    const res = await call("?columns=")
    expect(res.status).toBe(400)
  })

  it("scope=all ignores the filters and returns more rows", async () => {
    const filtered = (await (await call("?status=disputed")).text()).split("\n")
    const all = (await (await call("?status=disputed&scope=all")).text()).split(
      "\n",
    )
    expect(all.length).toBeGreaterThan(filtered.length)
  })
})
