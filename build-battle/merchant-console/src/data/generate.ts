import { merchants } from "./merchants"
import {
  Card,
  CardEvent,
  Currency,
  Dispute,
  MerchantCategory,
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
  // Cards draw last so adding them leaves every payment, refund, dispute and
  // payout above byte-identical to what the room had before NWP-201.
  const cards = generateCards()
  const cardEvents = generateCardEvents(cards)
  return { payments, refunds, disputes, payouts, cards, cardEvents }
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
 * Cards ops has already issued by hand, so the list, the badges and the spend
 * bar have something to show on a cold start.
 *
 * These carry `last4` and a reference and nothing else. There is no full number
 * here to leak, which is the point: `src/lib/cards.ts` generates one on issue
 * and only the creation response ever sees it.
 */
function generateCards(): Card[] {
  const seeds: {
    nickname: string
    merchantId: string
    spendLimit: number
    spent: number
    currency: Currency
    status: Card["status"]
    category: MerchantCategory | null
    daysAgo: number
  }[] = [
    {
      nickname: "Google Ads — Q3",
      merchantId: "mch_01",
      spendLimit: 250_000,
      spent: 214_300,
      currency: "USD",
      status: "active",
      category: "advertising",
      daysAgo: 46,
    },
    {
      nickname: "Figma seats",
      merchantId: "mch_02",
      spendLimit: 90_000,
      spent: 27_000,
      currency: "USD",
      status: "active",
      category: "software",
      daysAgo: 31,
    },
    {
      nickname: "Contractor — Bex",
      merchantId: "mch_04",
      spendLimit: 400_000,
      spent: 0,
      currency: "GBP",
      status: "frozen",
      category: "contractors",
      daysAgo: 18,
    },
    {
      nickname: "Berlin travel",
      merchantId: "mch_05",
      spendLimit: 120_000,
      spent: 118_450,
      currency: "EUR",
      status: "active",
      category: "travel",
      daysAgo: 12,
    },
    {
      nickname: "Old AWS card",
      merchantId: "mch_03",
      spendLimit: 500_000,
      spent: 331_200,
      currency: "USD",
      status: "cancelled",
      category: "utilities",
      daysAgo: 74,
    },
    {
      nickname: "Warehouse supplies",
      merchantId: "mch_10",
      spendLimit: 75_000,
      spent: 4_990,
      currency: "USD",
      status: "active",
      category: null,
      daysAgo: 3,
    },
  ]

  return seeds.map((seed, index) => {
    const createdAt = new Date(GENERATED_AT)
    createdAt.setUTCDate(createdAt.getUTCDate() - seed.daysAgo)
    createdAt.setUTCHours(between(8, 18), between(0, 59), 0, 0)

    return {
      id: `crd_${pad(index + 1, 2)}`,
      nickname: seed.nickname,
      merchantId: seed.merchantId,
      spendLimit: seed.spendLimit,
      spent: seed.spent,
      currency: seed.currency,
      status: seed.status,
      category: seed.category,
      brand: "visa",
      last4: String(between(1000, 9999)),
      reference: `cref_${pad(index + 1, 8)}`,
      createdAt: createdAt.toISOString(),
    }
  })
}

/**
 * History for the seeded cards. Every card gets its issue event; the ones that
 * are no longer active get the change that got them there, so the timeline on
 * a frozen or cancelled card is not empty on a cold start.
 */
function generateCardEvents(cards: Card[]): CardEvent[] {
  const events: CardEvent[] = []
  let seq = 0

  for (const card of cards) {
    events.push({
      id: `cev_${pad(++seq, 4)}`,
      cardId: card.id,
      from: null,
      to: "active",
      at: card.createdAt,
    })

    if (card.status === "active") continue

    // Frozen and cancelled cards moved some days after they were issued.
    const changedAt = new Date(card.createdAt)
    changedAt.setUTCDate(changedAt.getUTCDate() + between(1, 9))
    events.push({
      id: `cev_${pad(++seq, 4)}`,
      cardId: card.id,
      from: "active",
      to: card.status,
      at: changedAt.toISOString(),
    })
  }

  return events
}
