import { generateCardNumber, lastFour } from "@/lib/cards"
import { GENERATED_AT, mulberry32 } from "./generate"
import { Card, Payment, PaymentStatus } from "./types"

/**
 * Seeded virtual cards, in the shape ops would have created them by hand.
 *
 * Numbers are generated from the 4242 test BIN at boot with a fixed seed, then
 * thrown away — only the last four and an opaque reference survive, exactly as
 * they would for a card issued through the console.
 */

const CARD_SEED = 20260201
const cardRand = mulberry32(CARD_SEED)

/** Days before the anchor date, so seeded cards predate the payments on them. */
const daysBefore = (days: number) =>
  new Date(GENERATED_AT.getTime() - days * 86_400_000).toISOString()

interface CardSeed {
  nickname: string
  merchantId: string
  /** Integer minor units, in the merchant's own currency. */
  spendLimit: number
  currency: Card["currency"]
  status: Card["status"]
  issuedDaysAgo: number
}

const SEEDS: CardSeed[] = [
  {
    nickname: "Ad spend — search",
    merchantId: "mch_01",
    spendLimit: 500_000,
    currency: "USD",
    status: "active",
    issuedDaysAgo: 96,
  },
  {
    nickname: "Design tool seats",
    merchantId: "mch_04",
    spendLimit: 120_000,
    currency: "GBP",
    status: "active",
    issuedDaysAgo: 74,
  },
  {
    nickname: "Lieferantenabos",
    merchantId: "mch_05",
    spendLimit: 250_000,
    currency: "EUR",
    status: "frozen",
    issuedDaysAgo: 58,
  },
  {
    nickname: "Cloud hosting — staging",
    merchantId: "mch_02",
    spendLimit: 1_000_000,
    currency: "USD",
    status: "active",
    issuedDaysAgo: 41,
  },
  {
    nickname: "Agency retainer (closed)",
    merchantId: "mch_07",
    spendLimit: 300_000,
    currency: "USD",
    status: "cancelled",
    issuedDaysAgo: 33,
  },
  {
    nickname: "Contractor tooling",
    merchantId: "mch_06",
    spendLimit: 400_000,
    currency: "EUR",
    status: "active",
    issuedDaysAgo: 6,
  },
]

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

export const seedCards: Card[] = SEEDS.map((seed, index) => {
  const number = generateCardNumber(cardRand)
  const sequence = pad(index + 1)
  return {
    id: `card_${sequence}`,
    nickname: seed.nickname,
    merchantId: seed.merchantId,
    spendLimit: seed.spendLimit,
    currency: seed.currency,
    last4: lastFour(number),
    numberRef: `cnum_${sequence}`,
    status: seed.status,
    createdAt: daysBefore(seed.issuedDaysAgo),
  }
})

/**
 * Statuses that consume a card's limit. A refunded payment gave the money back
 * and a failed one never took it; a disputed one has not come back yet.
 */
export const SPEND_STATUSES: readonly PaymentStatus[] = [
  "captured",
  "authorized",
  "disputed",
]

export function countsTowardSpend(payment: Payment): boolean {
  return SPEND_STATUSES.includes(payment.status)
}

/**
 * How far into its limit each seeded card should sit. Chosen rather than left
 * to chance so the console always has a card past 80% to show an amber bar,
 * and one at zero to show a freshly issued card.
 */
const SPEND_TARGETS: Record<string, number> = {
  card_0001: 0.34,
  card_0002: 0.92,
  card_0003: 0.61,
  card_0004: 0.08,
  card_0005: 0.45,
  card_0006: 0,
}

/**
 * Attach seeded payments to seeded cards, after generation rather than during
 * it. The payment generator is a deterministic PRNG, so drawing inside its loop
 * would shift every subsequent value and silently change the whole dataset.
 * This pass only walks the finished array, so existing records are untouched.
 *
 * Payments that do not count toward spend get linked too — a card with a
 * refund on it is the case that proves the spend figure excludes them.
 */
export function linkPaymentsToCards(payments: Payment[], cards: Card[]): void {
  for (const card of cards) {
    const target = Math.round(card.spendLimit * (SPEND_TARGETS[card.id] ?? 0))
    if (target <= 0) continue

    let spend = 0
    for (const payment of payments) {
      if (payment.cardId) continue
      if (payment.merchantId !== card.merchantId) continue
      if (payment.method !== "card") continue

      const counts = countsTowardSpend(payment)
      /**
       * A card cannot spend past its own limit, so a payment that would
       * overshoot the target is skipped and the walk takes a smaller one.
       * Without this the last payment attached can carry a card past 100%,
       * which no issuer would have authorised in the first place.
       */
      if (counts && spend + payment.amount > target) continue

      payment.cardId = card.id
      payment.last4 = card.last4
      // The 4242 range is Visa, so a linked payment cannot claim another brand.
      payment.cardBrand = "visa"

      if (counts) spend += payment.amount
    }
  }
}
