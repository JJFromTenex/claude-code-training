import { generateCardNumber } from "@/lib/cards"
import { merchants } from "./merchants"
import {
  Card,
  CardCategory,
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
  // Cards draw from the same PRNG, so they come last: adding them must not
  // change a single payment that everyone in the room already has.
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

interface SeedCard {
  merchantId: string
  nickname: string
  spendLimit: number
  spent: number
  status: CardStatus
  categoryLock: CardCategory | null
  /** Days before the anchor date the card was issued. */
  ageDays: number
}

/**
 * A handful of cards so the list, the detail page, and the spend bar have
 * something to show before ops issues the first real one. Numbers come from
 * the same generator the route uses, so every last-four is from a Luhn-valid
 * number on the 4242 BIN. Only the last four survives; the number itself is
 * dropped on the floor here exactly as it is after a real issue.
 */
const SEED_CARDS: SeedCard[] = [
  // Past 80% of its limit, so the amber state is visible on day one.
  { merchantId: "mch_01", nickname: "Meta ads", spendLimit: 250000, spent: 212500, status: "active", categoryLock: "advertising", ageDays: 41 },
  { merchantId: "mch_04", nickname: "Figma seats", spendLimit: 60000, spent: 18000, status: "active", categoryLock: "software", ageDays: 30 },
  { merchantId: "mch_05", nickname: "Messe Berlin travel", spendLimit: 400000, spent: 0, status: "frozen", categoryLock: "travel", ageDays: 18 },
  { merchantId: "mch_07", nickname: "Contractor payouts", spendLimit: 1500000, spent: 620000, status: "active", categoryLock: "contractors", ageDays: 9 },
  { merchantId: "mch_02", nickname: "Old Google ads", spendLimit: 100000, spent: 100000, status: "cancelled", categoryLock: "advertising", ageDays: 77 },
]

function generateCards(): Card[] {
  return SEED_CARDS.map((seed, index) => {
    const merchant = merchants.find((m) => m.id === seed.merchantId)!
    const createdAt = new Date(
      GENERATED_AT.getTime() - seed.ageDays * 86_400_000 + between(9, 17) * 3_600_000,
    ).toISOString()
    const number = generateCardNumber(rand)
    const events: Card["events"] = [{ type: "issued", at: createdAt }]
    if (seed.status !== "active") {
      events.push({
        type: seed.status,
        at: new Date(
          new Date(createdAt).getTime() + between(1, 5) * 86_400_000,
        ).toISOString(),
      })
    }
    return {
      id: `card_${pad(index + 1)}`,
      merchantId: seed.merchantId,
      nickname: seed.nickname,
      last4: number.slice(-4),
      numberRef: `cn_seed${pad(index + 1, 12)}`,
      spendLimit: seed.spendLimit,
      spent: seed.spent,
      currency: merchant.currency,
      status: seed.status,
      categoryLock: seed.categoryLock,
      createdAt,
      events,
    }
  })
}
