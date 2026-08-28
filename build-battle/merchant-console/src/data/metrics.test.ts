import { describe, expect, it } from "vitest"
import { store } from "./store"
import { dailyVolume } from "./metrics"

/**
 * The overview chart is the first thing ops looks at, so a bucket that lands
 * on the wrong day or drifts by a cent is a number someone will act on. These
 * pin the two things that were wrong: local-time bucketing against UTC keys,
 * and accumulating money as a float.
 */

describe("dailyVolume", () => {
  it("buckets by the UTC day, so a late-evening payment does not slide into yesterday", () => {
    const day = dailyVolume(30).at(-1)!
    // 23:30 UTC is the previous day in every timezone west of London, which is
    // where local-time bucketing lost it.
    const late = store.payments.filter(
      (p) => p.createdAt.startsWith(day.date) && p.status === "captured",
    )
    const expected = late.reduce((total, p) => total + p.amount, 0)
    expect(day.captured).toBe(expected)
  })

  it("keeps every bucket in whole minor units, never a float", () => {
    for (const day of dailyVolume(30)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })

  it("returns one bucket per requested day, in order", () => {
    const days = dailyVolume(7)
    expect(days).toHaveLength(7)
    expect([...days].sort((a, b) => a.date.localeCompare(b.date))).toEqual(days)
  })
})
