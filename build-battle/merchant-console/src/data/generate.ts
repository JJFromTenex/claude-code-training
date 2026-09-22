import { merchants } from "./merchants"
import {
  Card,
  CardStatusChange,
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

/**
 * A handful of issued cards so the list, the spend bar, and the frozen and
 * cancelled states have something to show at boot. Records carry the last
 * four and a reference only; no seed card has ever had a full number.
 */
function generateCards(): Card[] {
  const issuedAt = (daysAgo: number) =>
    new Date(GENERATED_AT.getTime() - daysAgo * 86_400_000).toISOString()

  const seeds: Omit<Card, "history">[] = [
    {
      id: "card_000001",
      nickname: "Ad spend · Meta",
      merchantId: "mch_01",
      category: "advertising",
      spendLimit: 250000,
      spent: 212500,
      currency: "USD",
      status: "active",
      last4: "0017",
      reference: "ref_seed_0000000001",
      createdAt: issuedAt(41),
    },
    {
      id: "card_000002",
      nickname: "Figma seats",
      merchantId: "mch_04",
      category: "software",
      spendLimit: 60000,
      spent: 14400,
      currency: "GBP",
      status: "active",
      last4: "4242",
      reference: "ref_seed_0000000002",
      createdAt: issuedAt(27),
    },
    {
      id: "card_000003",
      nickname: "Contractor · Q3 build",
      merchantId: "mch_05",
      category: "contractors",
      spendLimit: 1200000,
      spent: 480000,
      currency: "EUR",
      status: "frozen",
      last4: "8830",
      reference: "ref_seed_0000000003",
      createdAt: issuedAt(12),
    },
    {
      id: "card_000004",
      nickname: "Trade show travel",
      merchantId: "mch_07",
      category: "travel",
      spendLimit: 400000,
      spent: 400000,
      currency: "USD",
      status: "cancelled",
      last4: "5561",
      reference: "ref_seed_0000000004",
      createdAt: issuedAt(63),
    },
  ]

  return seeds.map((seed) => {
    const history: CardStatusChange[] = [{ status: "active", at: seed.createdAt }]
    if (seed.status !== "active") {
      history.push({
        status: seed.status,
        at: new Date(
          new Date(seed.createdAt).getTime() + 5 * 86_400_000,
        ).toISOString(),
      })
    }
    return { ...seed, history }
  })
}
