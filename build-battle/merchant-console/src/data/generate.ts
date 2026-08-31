import { generateCardNumber } from "@/lib/cards"
import { merchants } from "./merchants"
import {
  Card,
  CardStatusEvent,
  Currency,
  Dispute,
  Payment,
  PaymentStatus,
  Payout,
  Refund,
} from "./types"

/**
 * Deterministic seed data. Everyone in the room gets identical records,
 * so a bug reproduces the same way on every machine.
 */

const SEED = 20260813
const DAYS = 120
const PAYMENTS_PER_DAY = 14

/** Small, fast, deterministic PRNG. Not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min

const DESCRIPTIONS = [
  "Online order",
  "In-store purchase",
  "Subscription renewal",
  "Gift card",
  "Wholesale invoice",
  "Repeat order",
  "Marketplace order",
]

const REASON_CODES = [
  "10.4 Other Fraud",
  "12.6 Duplicate Processing",
  "13.1 Merchandise Not Received",
  "13.3 Not as Described",
  "13.7 Cancelled Merchandise",
]

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** The anchor date. Fixed, so "the last 30 days" is stable across runs. */
export const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

function statusFor(): PaymentStatus {
  const roll = rand()
  if (roll < 0.78) return "captured"
  if (roll < 0.86) return "authorized"
  if (roll < 0.93) return "refunded"
  if (roll < 0.98) return "failed"
  return "disputed"
}

export function generate() {
  const payments: Payment[] = []
  const refunds: Refund[] = []
  const disputes: Dispute[] = []
  let paymentSeq = 0
  let refundSeq = 0
  let disputeSeq = 0

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = new Date(GENERATED_AT)
    dayStart.setUTCDate(dayStart.getUTCDate() - day)

    const count = between(PAYMENTS_PER_DAY - 5, PAYMENTS_PER_DAY + 5)

    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants)
      const createdAt = new Date(dayStart)
      createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

      const status = statusFor()
      const method = rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card" ? pick(["visa", "mastercard", "amex"] as const) : null,
        last4: method === "card" ? String(between(1000, 9999)) : null,
        createdAt: createdAt.toISOString(),
        description: pick(DESCRIPTIONS),
      }
      payments.push(payment)

      if (status === "refunded") {
        const full = rand() < 0.7
        refunds.push({
          id: `re_${pad(++refundSeq)}`,
          paymentId: payment.id,
          amount: full ? amount : Math.floor(amount / 2),
          currency: payment.currency,
          reason: pick([
            "requested_by_customer",
            "duplicate",
            "fraudulent",
          ] as const),
          createdAt: new Date(
            createdAt.getTime() + between(1, 6) * 86_400_000,
          ).toISOString(),
        })
      }

      if (status === "disputed") {
        const openedAt = new Date(createdAt.getTime() + between(2, 10) * 86_400_000)
        disputes.push({
          id: `dp_${pad(++disputeSeq)}`,
          paymentId: payment.id,
          merchantId: merchant.id,
          amount,
          currency: payment.currency,
          reasonCode: pick(REASON_CODES),
          status: pick([
            "needs_response",
            "needs_response",
            "under_review",
            "won",
            "lost",
          ] as const),
          openedAt: openedAt.toISOString(),
          evidenceDueAt: new Date(
            openedAt.getTime() + 14 * 86_400_000,
          ).toISOString(),
        })
      }
    }
  }

  const payouts = generatePayouts(payments)
  const cards = generateCards()
  return { payments, refunds, disputes, payouts, cards }
}

/**
 * A handful of example cards, issued before this session, so /cards opens
 * onto something real instead of an empty room. Hand-authored rather than
 * randomized: the spend figures are chosen to exercise a specific state
 * (near-limit for the amber threshold, a frozen card, a cancelled one with
 * real history) that a random loop can't reliably hit deterministically.
 * Anything issued live through the app starts at spent: 0 — there's no
 * transaction feed here to make a nonzero starting spend honest.
 */
function generateCards(): Card[] {
  const daysBefore = (days: number) =>
    new Date(GENERATED_AT.getTime() - days * 86_400_000).toISOString()

  const history = (
    events: { status: "active" | "frozen" | "cancelled"; daysBefore: number }[],
  ): CardStatusEvent[] =>
    events.map((e) => ({ status: e.status, at: daysBefore(e.daysBefore) }))

  const cardNumber = () => generateCardNumber(rand).last4

  const cards: Card[] = [
    {
      id: "card_0001",
      nickname: "Ad platform subscriptions",
      merchantId: "mch_01",
      last4: cardNumber(),
      limit: 50_000,
      spent: 6_120,
      currency: "USD",
      category: "vendor_subscriptions",
      status: "active",
      createdAt: daysBefore(40),
      history: history([{ status: "active", daysBefore: 40 }]),
    },
    {
      id: "card_0002",
      nickname: "Paid social",
      merchantId: "mch_02",
      last4: cardNumber(),
      limit: 200_000,
      spent: 174_300,
      currency: "USD",
      category: "ad_spend",
      status: "active",
      createdAt: daysBefore(25),
      history: history([{ status: "active", daysBefore: 25 }]),
    },
    {
      id: "card_0003",
      nickname: "Freelance designer",
      merchantId: "mch_04",
      last4: cardNumber(),
      limit: 80_000,
      spent: 36_400,
      currency: "GBP",
      category: "contractor_tools",
      status: "frozen",
      createdAt: daysBefore(60),
      history: history([
        { status: "active", daysBefore: 60 },
        { status: "frozen", daysBefore: 10 },
      ]),
    },
    {
      id: "card_0004",
      nickname: "Legacy vendor tool",
      merchantId: "mch_05",
      last4: cardNumber(),
      limit: 30_000,
      spent: 27_950,
      currency: "EUR",
      category: "vendor_subscriptions",
      status: "cancelled",
      createdAt: daysBefore(90),
      history: history([
        { status: "active", daysBefore: 90 },
        { status: "frozen", daysBefore: 50 },
        { status: "cancelled", daysBefore: 20 },
      ]),
    },
    {
      id: "card_0005",
      nickname: "Influencer ad spend",
      merchantId: "mch_07",
      last4: cardNumber(),
      limit: 150_000,
      spent: 12_000,
      currency: "USD",
      category: "ad_spend",
      status: "active",
      createdAt: daysBefore(5),
      history: history([{ status: "active", daysBefore: 5 }]),
    },
    {
      id: "card_0006",
      nickname: "New contractor tool",
      merchantId: "mch_10",
      last4: cardNumber(),
      limit: 60_000,
      spent: 0,
      currency: "USD",
      category: "contractor_tools",
      status: "active",
      createdAt: daysBefore(1),
      history: history([{ status: "active", daysBefore: 1 }]),
    },
  ]

  return cards
}

function generatePayouts(payments: Payment[]): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const merchant of merchants) {
    for (let week = 0; week < 8; week++) {
      const periodEnd = new Date(GENERATED_AT)
      periodEnd.setUTCDate(periodEnd.getUTCDate() - week * 7)
      const periodStart = new Date(periodEnd)
      periodStart.setUTCDate(periodStart.getUTCDate() - 7)

      const inPeriod = payments.filter(
        (p) =>
          p.merchantId === merchant.id &&
          p.status === "captured" &&
          p.createdAt >= periodStart.toISOString() &&
          p.createdAt < periodEnd.toISOString(),
      )
      if (inPeriod.length === 0) continue

      const gross = inPeriod.reduce((sum, p) => sum + p.amount, 0)
      const fees = Math.round(gross * 0.029) + inPeriod.length * 30

      payouts.push({
        id: `po_${pad(++seq, 4)}`,
        merchantId: merchant.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        gross,
        fees,
        net: gross - fees,
        currency: merchant.currency,
        status: week === 0 ? "pending" : week === 1 ? "in_transit" : "paid",
        paymentIds: inPeriod.map((p) => p.id),
      })
    }
  }

  return payouts
}
