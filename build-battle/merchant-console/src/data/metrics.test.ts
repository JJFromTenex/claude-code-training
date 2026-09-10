import { describe, expect, it, vi } from "vitest"
import { Payment } from "./types"

/**
 * dailyVolume buckets by UTC and totals in integer minor units.
 *
 * Both used to be wrong: the day key came from the server's local timezone
 * while the bucket keys were UTC, so a payment either landed on the wrong day
 * or fell off the oldest edge and vanished; and amounts were accumulated as
 * floats in major units before being converted back.
 */

const { payments } = vi.hoisted(() => ({ payments: [] as Payment[] }))

vi.mock("./store", () => ({
  store: { payments, refunds: [], disputes: [], payouts: [], cards: [] },
}))

const { dailyVolume } = await import("./metrics")

const payment = (over: Partial<Payment>): Payment => ({
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 1000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-08-13T12:00:00.000Z",
  description: "Online order",
  ...over,
})

const load = (rows: Payment[]) => {
  payments.length = 0
  payments.push(...rows)
  const byDate = new Map(dailyVolume(30).map((day) => [day.date, day]))
  return byDate
}

describe("dailyVolume bucketing", () => {
  it("files an early-UTC payment on its UTC day, not the day before", () => {
    // 02:00 UTC is still the previous evening anywhere west of UTC.
    const days = load([
      payment({ createdAt: "2026-08-13T02:00:00.000Z", amount: 1999 }),
    ])
    expect(days.get("2026-08-13")?.captured).toBe(1999)
    expect(days.get("2026-08-12")?.captured).toBe(0)
  })

  it("files a late-UTC payment on its UTC day, not the day after", () => {
    // 23:30 UTC is already tomorrow anywhere east of UTC.
    const days = load([
      payment({ createdAt: "2026-08-12T23:30:00.000Z", amount: 2999 }),
    ])
    expect(days.get("2026-08-12")?.captured).toBe(2999)
    expect(days.get("2026-08-13")?.captured).toBe(0)
  })

  it("keeps captured and refunded apart on the same day", () => {
    const days = load([
      payment({ createdAt: "2026-08-13T09:00:00.000Z", amount: 1999 }),
      payment({
        createdAt: "2026-08-13T17:00:00.000Z",
        amount: 500,
        status: "refunded",
      }),
    ])
    expect(days.get("2026-08-13")).toMatchObject({
      captured: 1999,
      refunded: 500,
    })
  })

  it("ignores payments outside the requested window", () => {
    const days = load([
      payment({ createdAt: "2026-01-01T12:00:00.000Z", amount: 999_99 }),
    ])
    expect([...days.values()].every((day) => day.captured === 0)).toBe(true)
  })
})

describe("dailyVolume totals", () => {
  it("returns integer minor units, never a rounded float round-trip", () => {
    const amounts = [1999, 2999, 4999, 1, 7, 33]
    const days = load(
      amounts.map((amount, i) =>
        payment({ id: `pay_${i}`, amount, createdAt: "2026-08-13T10:00:00.000Z" }),
      ),
    )
    const captured = days.get("2026-08-13")!.captured
    expect(captured).toBe(amounts.reduce((total, a) => total + a, 0))
    expect(Number.isInteger(captured)).toBe(true)
  })

  it("reports a day with no payments as zero, not undefined", () => {
    const days = load([])
    expect(days.get("2026-08-13")).toMatchObject({ captured: 0, refunded: 0 })
  })
})
