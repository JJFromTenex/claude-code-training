import { filterPayments, parseFilters, PAGE_SIZE } from "@/data/queries"
import { DEFAULT_EXPORT_COLUMNS } from "@/lib/csv"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

function req(query: string) {
  return new NextRequest(`http://localhost/api/payments/export${query}`)
}

function countRows(text: string) {
  const lines = text.split("\n")
  return lines.length - 1
}

describe("GET /api/payments/export", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("uses the default columns when none are given, excluding last4", async () => {
    const res = await GET(req(""))
    const text = await res.text()
    const header = text.split("\n")[0]
    expect(header).toBe(DEFAULT_EXPORT_COLUMNS.join(","))
    expect(header).not.toContain("last4")
  })

  it("uses requested columns and exports all matching rows, not just a page", async () => {
    const res = await GET(req("?columns=id,amount"))
    const text = await res.text()
    const header = text.split("\n")[0]
    expect(header).toBe("id,amount")

    const all = filterPayments(parseFilters(new URLSearchParams()))
    const rowCount = countRows(text)
    expect(rowCount).toBe(all.length)
    expect(rowCount).toBeGreaterThan(PAGE_SIZE)
  })

  it("drops invalid columns from the requested list", async () => {
    const res = await GET(req("?columns=id,evil;DROP"))
    const text = await res.text()
    const header = text.split("\n")[0]
    expect(header).toBe("id")
  })

  it("returns 400 with a message when no valid columns remain", async () => {
    const res = await GET(req("?columns=bogus"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(typeof body.message).toBe("string")
  })

  it("filters by status and names the file after it", async () => {
    const res = await GET(req("?status=disputed&columns=id,status"))
    const text = await res.text()
    const lines = text.split("\n")
    const header = lines[0]
    const dataLines = lines.slice(1)

    expect(header).toBe("id,status")
    for (const line of dataLines) {
      expect(line.endsWith(",disputed")).toBe(true)
    }

    const expected = filterPayments(
      parseFilters(new URLSearchParams("status=disputed")),
    )
    expect(dataLines.length).toBe(expected.length)

    expect(res.headers.get("content-disposition")).toContain(
      'filename="payments-disputed-2026-08-13.csv"',
    )
  })

  it("scope=all ignores filters for row selection but keeps the status label", async () => {
    const res = await GET(req("?status=disputed&scope=all&columns=id"))
    const text = await res.text()
    const rowCount = countRows(text)

    const all = filterPayments(parseFilters(new URLSearchParams()))
    expect(rowCount).toBe(all.length)

    expect(res.headers.get("content-disposition")).toContain(
      'filename="payments-all-2026-08-13.csv"',
    )
  })

  it("treats an unrecognized scope as current", async () => {
    const res = await GET(req("?scope=weird&status=disputed&columns=id,status"))
    const text = await res.text()
    const lines = text.split("\n")
    const dataLines = lines.slice(1)

    const expected = filterPayments(
      parseFilters(new URLSearchParams("status=disputed")),
    )
    expect(dataLines.length).toBe(expected.length)
    for (const line of dataLines) {
      expect(line.endsWith(",disputed")).toBe(true)
    }
  })

  it("uses the plain filename when there are no filters", async () => {
    const res = await GET(req(""))
    expect(res.headers.get("content-disposition")).toContain(
      'filename="payments-2026-08-13.csv"',
    )
  })
})
