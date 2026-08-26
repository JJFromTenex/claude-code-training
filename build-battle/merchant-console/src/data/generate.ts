import { MAX_SPEND_LIMIT, generateCardNumber } from "@/lib/cards"
import { sumMinorUnits } from "@/lib/money"
import { merchants } from "./merchants"
import {
  Card,
  CardStatus,
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
      const method =
        rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card"
            ? pick(["visa", "mastercard", "amex"] as const)
            : null,
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
        const openedAt = new Date(
          createdAt.getTime() + between(2, 10) * 86_400_000,
        )
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
  const cards = generateCards(payments)
  return { payments, refunds, disputes, payouts, cards }
}

/**
 * Cards issued before the console could issue them. On its own PRNG instance:
 * drawing from the shared `rand` would shift every payment after it and change
 * the seed data the rest of the suite asserts on.
 */
const CARD_SEED = 20260814

const CARD_NICKNAMES = [
  "Meta Ads",
  "Google Workspace",
  "Contractor tools",
  "Shipping supplies",
  "Travel — Q3",
  "Figma seats",
  "LinkedIn Ads",
  "Courier account",
] as const

const CARD_CATEGORIES: (MerchantCategory | null)[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "shipping",
  null,
]

function generateCards(payments: Payment[]): Card[] {
  const cardRand = mulberry32(CARD_SEED)
  const cards: Card[] = []

  for (let i = 0; i < CARD_NICKNAMES.length; i++) {
    const merchant = merchants[Math.floor(cardRand() * merchants.length)]
    const createdAt = new Date(GENERATED_AT)
    createdAt.setUTCDate(createdAt.getUTCDate() - Math.floor(cardRand() * 90))
    const createdIso = createdAt.toISOString()

    // Spend is a real sum of this merchant's captured payments since the card
    // existed, not a number invented to make the bar look interesting.
    const chargeable = payments.filter(
      (p) =>
        p.merchantId === merchant.id &&
        p.status === "captured" &&
        p.createdAt >= createdIso,
    )
    const window = chargeable.slice(
      0,
      Math.ceil(chargeable.length * (0.1 + cardRand() * 0.5)),
    )
    const spend = sumMinorUnits(window.map((p) => p.amount))

    // The round figure ops would have asked for, above spend. The MAX clamp
    // lands last and could pin it below a large spend, so assert what holds.
    const headroom = 1.02 + cardRand() * 0.85
    const spendLimit = Math.max(
      5000,
      Math.min(MAX_SPEND_LIMIT, Math.ceil((spend * headroom) / 5000) * 5000),
    )
    if (spend > spendLimit)
      throw new Error(
        `Seed card ${i + 1}: ${spend} spent against ${spendLimit}.`,
      )

    const status: CardStatus =
      i === 5 ? "frozen" : i === 7 ? "cancelled" : "active"

    cards.push({
      id: `card_${pad(i + 1, 4)}`,
      nickname: CARD_NICKNAMES[i],
      merchantId: merchant.id,
      spendLimit,
      currency: merchant.currency,
      status,
      last4: generateCardNumber(cardRand).slice(-4),
      reference: `cref_${pad(i + 1, 4)}`,
      category:
        CARD_CATEGORIES[Math.floor(cardRand() * CARD_CATEGORIES.length)],
      spend,
      createdAt: createdIso,
    })
  }

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
