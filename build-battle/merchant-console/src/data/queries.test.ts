import { describe, expect, it } from "vitest"
import { DEFAULT_EXPORT_COLUMNS } from "@/lib/csv"
import { parseExportOptions } from "./queries"

/**
 * A column name reaches the CSV header row and the scope reaches the download
 * filename, so both are allowlisted here rather than trusted from the export
 * dialog. Unticking a box in the browser is a convenience; this is the
 * enforcement.
 */
describe("parseExportOptions", () => {
  const options = (search: string) =>
    parseExportOptions(new URLSearchParams(search))

  it("defaults to every column but the card last four", () => {
    expect(options("").columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("keeps the order the client asked for", () => {
    expect(options("columns=amount,id").columns).toEqual(["amount", "id"])
  })

  it("drops a name that is not a column, keeping the ones that are", () => {
    expect(options("columns=amount,id,DROP TABLE payments").columns).toEqual([
      "amount",
      "id",
    ])
  })

  it("tolerates whitespace around a name", () => {
    expect(options("columns=id, amount").columns).toEqual(["id", "amount"])
  })

  it("does not repeat a column named twice", () => {
    expect(options("columns=id,id,amount").columns).toEqual(["id", "amount"])
  })

  it("tells naming no columns apart from naming only invalid ones", () => {
    // Absent means "give me the usual set"; present-but-unusable means the
    // route answers 400 instead of sending a blank file.
    expect(options("").columns.length).toBeGreaterThan(0)
    expect(options("columns=").columns).toEqual([])
    expect(options("columns=nonsense").columns).toEqual([])
  })

  it("reads scope as one of two literals, never echoing what was sent", () => {
    expect(options("scope=all").scope).toBe("all")
    expect(options("scope=filter").scope).toBe("filter")
    expect(options("").scope).toBe("filter")
    expect(options("scope=../../etc/passwd").scope).toBe("filter")
  })
})
