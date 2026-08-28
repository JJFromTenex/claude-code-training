import { describe, expect, it } from "vitest"
import {
  daysUntil,
  dayKeyInZone,
  lastUtcDays,
  utcDayKey,
  utcRangeEnd,
} from "./dates"

/**
 * Bucketing is UTC and display is per-merchant. These tests exist because the
 * two are easy to mix up, and the symptom of mixing them up is a total that
 * is quietly wrong near midnight rather than an error anyone would notice.
 */

describe("utcDayKey", () => {
  it("takes the UTC calendar day off the stored instant", () => {
    expect(utcDayKey("2026-03-14T23:59:59.000Z")).toBe("2026-03-14")
    expect(utcDayKey("2026-03-15T00:00:00.000Z")).toBe("2026-03-15")
  })
})

describe("dayKeyInZone", () => {
  it("shifts an instant into the merchant's own calendar day", () => {
    // 01:30 UTC is still the previous evening in New York.
    expect(dayKeyInZone("2026-03-15T01:30:00.000Z", "America/New_York")).toBe(
      "2026-03-14",
    )
    // ...and already the next morning in Tokyo.
    expect(dayKeyInZone("2026-03-14T16:30:00.000Z", "Asia/Tokyo")).toBe(
      "2026-03-15",
    )
  })

  it("agrees with the UTC key when the zone is UTC", () => {
    const iso = "2026-03-15T01:30:00.000Z"
    expect(dayKeyInZone(iso, "UTC")).toBe(utcDayKey(iso))
  })
})

describe("lastUtcDays", () => {
  it("returns the requested number of keys, oldest first, ending today", () => {
    const keys = lastUtcDays(3, new Date("2026-03-15T12:00:00.000Z"))
    expect(keys).toEqual(["2026-03-13", "2026-03-14", "2026-03-15"])
  })

  it("crosses a month boundary correctly", () => {
    const keys = lastUtcDays(2, new Date("2026-03-01T12:00:00.000Z"))
    expect(keys).toEqual(["2026-02-28", "2026-03-01"])
  })
})

describe("daysUntil", () => {
  const now = new Date("2026-03-15T12:00:00.000Z")

  it("counts whole days forward", () => {
    expect(daysUntil("2026-03-18T12:00:00.000Z", now)).toBe(3)
  })

  it("goes negative once the date has passed", () => {
    expect(daysUntil("2026-03-13T12:00:00.000Z", now)).toBe(-2)
  })
})

describe("utcRangeEnd", () => {
  it("stretches a date-only bound to the end of that UTC day", () => {
    expect(utcRangeEnd("2026-08-13")).toBe("2026-08-13T23:59:59.999Z")
  })

  it("leaves a full instant alone", () => {
    expect(utcRangeEnd("2026-08-13T09:22:00.000Z")).toBe(
      "2026-08-13T09:22:00.000Z",
    )
  })

  it("keeps a payment made that day inside the bound", () => {
    // The whole point: a bare date used to exclude its own day.
    expect("2026-08-13T09:22:00.000Z" <= utcRangeEnd("2026-08-13")).toBe(true)
  })
})
