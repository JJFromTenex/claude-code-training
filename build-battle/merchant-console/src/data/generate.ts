import { generateCardNumber, CARD_CATEGORIES, CARD_LIMIT_MAX_MINOR_UNITS } from "@/lib/cards"
import { merchants } from "./merchants"
import {
  Card,
  CardCategory,
  CardEvent,
  CardStatus,
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
const pick = <T>(items: readonly T[], rng: () => number = rand): T =>
  items[Math.floor(rng() * items.length)]
const between = (min: number, max: number, rng: () => number = rand) =>
  Math.floor(rng() * (max - min + 1)) + min

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

export const pad = (n: number, width = 6) => String(n).padStart(width, "0")

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

const NICKNAME_BY_CATEGORY: Record<CardCategory, string> = {
  advertising: "Ad spend",
  software: "SaaS subscriptions",
  shipping: "Shipping & freight",
  office: "Office supplies",
  travel: "Travel & expenses",
}

/**
 * Status for each seed card, in order. Mostly active, with one frozen and
 * one cancelled so every status has at least one example to click into.
 */
const CARD_STATUS_PLAN: CardStatus[] = [
  "active",
  "active",
  "active",
  "active",
  "frozen",
  "cancelled",
  "active",
  "active",
]

/** Index into CARD_STATUS_PLAN of the one active card seeded past 80% spend. */
const HIGH_SPEND_CARD_INDEX = 3

/**
 * Seed cards get their own PRNG instance (same SEED, separate stream) so
 * adding them can never shift the payments/refunds/disputes/payouts
 * sequence that already exists — that data stays byte-identical.
 */
function generateCards(): Card[] {
  const cardRand = mulberry32(SEED)
  const cards: Card[] = []

  CARD_STATUS_PLAN.forEach((status, index) => {
    const merchant = pick(merchants, cardRand)
    const category = pick(CARD_CATEGORIES, cardRand)
    const limitMinorUnits = between(5_000, CARD_LIMIT_MAX_MINOR_UNITS, cardRand)

    const isHighSpend = status === "active" && index === HIGH_SPEND_CARD_INDEX
    const spentMinorUnits = isHighSpend
      ? Math.floor(limitMinorUnits * (0.81 + cardRand() * 0.18))
      : Math.floor(limitMinorUnits * (cardRand() * 0.6))

    const createdAt = new Date(GENERATED_AT)
    createdAt.setUTCDate(createdAt.getUTCDate() - between(30, 100, cardRand))

    const events: CardEvent[] = [{ type: "issued", at: createdAt.toISOString() }]

    if (status === "frozen") {
      const frozenAt = new Date(
        createdAt.getTime() + between(1, 15, cardRand) * 86_400_000,
      )
      events.push({ type: "frozen", at: frozenAt.toISOString() })
    }

    if (status === "cancelled") {
      const cancelledAt = new Date(
        createdAt.getTime() + between(1, 20, cardRand) * 86_400_000,
      )
      events.push({ type: "cancelled", at: cancelledAt.toISOString() })
    }

    const number = generateCardNumber(cardRand)
    const id = `crd_${pad(index + 1)}`

    cards.push({
      id,
      merchantId: merchant.id,
      nickname: NICKNAME_BY_CATEGORY[category],
      last4: number.slice(-4),
      numberRef: `cardref_${id}`,
      limitMinorUnits,
      spentMinorUnits,
      currency: merchant.currency,
      category,
      status,
      createdAt: createdAt.toISOString(),
      events,
    })
  })

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
