import { merchants } from "./merchants"
import {
  Card,
  CardEvent,
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
  return {
    payments,
    refunds,
    disputes,
    payouts,
    cards: generateCards(payments),
  }
}

/**
 * A few cards so the list, detail, and spend progress have something to show
 * at boot. Numbers are on the `4242` test BIN like every other card here, and
 * only the last four is ever stored.
 */
function generateCards(payments: Payment[]): Card[] {
  const issued = [
    {
      id: "card_000001",
      nickname: "Meta Ads — Q3",
      merchantId: "mch_01",
      last4: "4318",
      reference: "cref_seed01",
      spendLimit: 500_000,
      currency: "USD" as const,
      status: "active" as const,
      category: "advertising" as const,
      daysAgo: 12,
    },
    {
      // mch_05 is Berlin and settles in EUR; a card always matches its
      // merchant's currency.
      id: "card_000002",
      nickname: "Figma + design tools",
      merchantId: "mch_05",
      last4: "9072",
      reference: "cref_seed02",
      spendLimit: 120_000,
      currency: "EUR" as const,
      status: "active" as const,
      category: "software" as const,
      daysAgo: 30,
    },
    {
      // mch_09 is London and settles in GBP.
      id: "card_000003",
      nickname: "Contractor — Nov",
      merchantId: "mch_09",
      last4: "5561",
      reference: "cref_seed03",
      spendLimit: 250_000,
      currency: "GBP" as const,
      status: "frozen" as const,
      category: "contractors" as const,
      daysAgo: 4,
    },
  ]

  return issued.map(({ daysAgo, status, ...card }) => {
    // Anchored to GENERATED_AT like every other collection in this file, so
    // the seeded cards are identical on every machine and sit in the same
    // window as the seeded payments.
    const createdAt = new Date(
      GENERATED_AT.getTime() - daysAgo * 86_400_000,
    ).toISOString()

    // Spend is derived from the merchant's real captured payments since the
    // card was issued, capped at the limit — not a number typed into the
    // seed. A fabricated spend makes the progress bar lie.
    const spend = Math.min(
      card.spendLimit,
      payments
        .filter(
          (payment) =>
            payment.merchantId === card.merchantId &&
            payment.status === "captured" &&
            payment.createdAt >= createdAt,
        )
        .reduce((total, payment) => total + payment.amount, 0),
    )

    const history: CardEvent[] = [{ kind: "issued", at: createdAt }]
    if (status === "frozen") {
      // Frozen a day after it was issued, so the timeline has something real
      // in it rather than a single entry.
      history.push({
        kind: "frozen",
        at: new Date(Date.parse(createdAt) + 86_400_000).toISOString(),
      })
    }
    return { ...card, status, spend, createdAt, history }
  })
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
