import { generateCardNumber } from "@/lib/cards"
import { GENERATED_AT } from "./generate"
import { merchants } from "./merchants"
import { Card } from "./types"

/**
 * Deterministic seed cards, generated once at boot the same way payments are
 * in `generate.ts`: a fixed PRNG so every machine in the room sees the same
 * records. Only `last4` is kept from the generated number — the number
 * itself is discarded immediately, the same as a real issue would discard it
 * after the one-time response.
 *
 * There is no transaction feed to derive real spend from yet (that is
 * NWP-203's persistence work, and beyond it, linking spend to payments is a
 * separate ticket). Each seed card below carries a `spentFraction` instead
 * of a bare spent amount, so the number on screen is visibly `spendLimit ×
 * a stated fraction` rather than an unexplained figure — honest about being
 * illustrative, and chosen to put one card past the 80% amber threshold, one
 * comfortably under it, and one still at zero.
 */

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260821)

const daysAgo = (days: number) => {
  const date = new Date(GENERATED_AT)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

interface SeedCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Card["currency"]
  /** Fraction of `spendLimit` this card has spent, for demo purposes only. */
  spentFraction: number
  status: Card["status"]
  category: Card["category"]
  createdDaysAgo: number
}

const SEED_CARDS: SeedCardInput[] = [
  {
    nickname: "Meta ad spend",
    merchantId: merchants[0].id, // Lumen Coffee Roasters, USD
    spendLimit: 500_00,
    currency: "USD",
    spentFraction: 0.8642, // past the 80% amber threshold, on purpose
    status: "active",
    category: "advertising",
    createdDaysAgo: 18,
  },
  {
    nickname: "Figma seats",
    merchantId: merchants[0].id, // Lumen Coffee Roasters, USD
    spendLimit: 150_00,
    currency: "USD",
    spentFraction: 0.3,
    status: "active",
    category: "software",
    createdDaysAgo: 40,
  },
  {
    nickname: "Contractor — dev",
    merchantId: merchants[1].id, // Kestrel Outdoor Supply, USD
    spendLimit: 2_000_00,
    currency: "USD",
    spentFraction: 0.45,
    status: "frozen",
    category: "contractors",
    createdDaysAgo: 9,
  },
  {
    nickname: "Conference travel",
    merchantId: merchants[3].id, // Halcyon Studio, GBP
    spendLimit: 800_00,
    currency: "GBP",
    spentFraction: 0.15,
    status: "active",
    category: "travel",
    createdDaysAgo: 3,
  },
  {
    nickname: "Old vendor tool",
    merchantId: merchants[4].id, // Brandt & Sohn, EUR
    spendLimit: 300_00,
    currency: "EUR",
    spentFraction: 0, // cancelled before it was ever used
    status: "cancelled",
    category: "software",
    createdDaysAgo: 75,
  },
]

function buildCard(input: SeedCardInput, index: number): Card {
  const number = generateCardNumber(rand)
  const createdAt = daysAgo(input.createdDaysAgo)
  const history: Card["history"] = [{ status: "active", at: createdAt }]
  if (input.status !== "active") {
    // Seeded as already transitioned once, a day after issuance.
    history.push({ status: input.status, at: daysAgo(input.createdDaysAgo - 1) })
  }

  return {
    id: `card_${String(index + 1).padStart(3, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: number.slice(-4),
    reference: `ref_${number.slice(4, 12)}`,
    spendLimit: input.spendLimit,
    currency: input.currency,
    spent: Math.round(input.spendLimit * input.spentFraction),
    status: input.status,
    category: input.category,
    createdAt,
    history,
  }
}

export function generateCards(): Card[] {
  return SEED_CARDS.map(buildCard)
}
