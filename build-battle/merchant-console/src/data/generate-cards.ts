import { generateCardNumber, lastFour } from "@/lib/cards"
import { merchants } from "./merchants"
import { Card, CardAuthorization, CardEvent, MerchantCategory } from "./types"

/**
 * Deterministic seed cards, kept out of `generate.ts` so the payment, refund,
 * dispute, and payout fixtures every other page relies on do not shift.
 *
 * The spend on these cards is real: it is the sum of the authorisations
 * generated beside them, not a number written onto the card. One card is
 * deliberately past 80% of its limit so the spend bar's amber threshold has
 * something to render, and one is at zero so "no spend yet" does too.
 */

const SEED = 20260814

/** Same PRNG as `generate.ts`. Fast, deterministic, not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The anchor date, matching `generate.ts`, so "created 12 days ago" is stable. */
const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

interface Blueprint {
  merchantId: string
  nickname: string
  /** Integer minor units. */
  spendLimit: number
  categoryLock: MerchantCategory
  status: Card["status"]
  /** Days before the anchor date the card was issued. */
  ageDays: number
  /** Fraction of the limit already authorised. 0 means a card nobody has used. */
  utilisation: number
}

const BLUEPRINTS: Blueprint[] = [
  {
    merchantId: "mch_01",
    nickname: "Google Ads · Lumen",
    spendLimit: 500_000,
    categoryLock: "advertising",
    status: "active",
    ageDays: 46,
    utilisation: 0.87,
  },
  {
    merchantId: "mch_02",
    nickname: "Figma seats",
    spendLimit: 120_000,
    categoryLock: "software",
    status: "active",
    ageDays: 31,
    utilisation: 0.42,
  },
  {
    merchantId: "mch_04",
    nickname: "Halcyon contractor retainer",
    spendLimit: 250_000,
    categoryLock: "contractors",
    status: "frozen",
    ageDays: 24,
    utilisation: 0.61,
  },
  {
    merchantId: "mch_05",
    nickname: "Brandt Messeausgaben",
    spendLimit: 300_000,
    categoryLock: "travel",
    status: "active",
    ageDays: 17,
    utilisation: 0.13,
  },
  {
    merchantId: "mch_07",
    nickname: "Cascade office supplies",
    spendLimit: 75_000,
    categoryLock: "office_supplies",
    status: "cancelled",
    ageDays: 12,
    utilisation: 0.29,
  },
  {
    merchantId: "mch_09",
    nickname: "Aster ad spend Q3",
    spendLimit: 180_000,
    categoryLock: "advertising",
    status: "active",
    ageDays: 5,
    utilisation: 0,
  },
]

const AUTH_DESCRIPTIONS: Record<MerchantCategory, string[]> = {
  advertising: ["Ad platform invoice", "Sponsored placement", "Campaign top-up"],
  software: ["Seat renewal", "Annual plan", "Add-on module"],
  travel: ["Rail fare", "Hotel booking", "Conference pass"],
  office_supplies: ["Paper and toner", "Desk chair", "Kitchen restock"],
  contractors: ["Retainer, week 1", "Retainer, week 2", "Overage hours"],
  any: ["Vendor charge", "Miscellaneous"],
}

export function generateCards(): {
  cards: Card[]
  cardAuthorizations: CardAuthorization[]
  cardEvents: CardEvent[]
} {
  const rand = mulberry32(SEED)
  const cards: Card[] = []
  const cardAuthorizations: CardAuthorization[] = []
  const cardEvents: CardEvent[] = []
  let cardSeq = 0
  let authSeq = 0
  let eventSeq = 0

  for (const blueprint of BLUEPRINTS) {
    const merchant = merchants.find((m) => m.id === blueprint.merchantId)
    if (!merchant) continue

    const issuedAt = new Date(GENERATED_AT)
    issuedAt.setUTCDate(issuedAt.getUTCDate() - blueprint.ageDays)
    issuedAt.setUTCHours(
      Math.floor(rand() * 24),
      Math.floor(rand() * 60),
      0,
      0,
    )

    // Generated the same way a real issue does, then immediately discarded.
    const number = generateCardNumber(rand)
    const card: Card = {
      id: `card_${pad(++cardSeq)}`,
      nickname: blueprint.nickname,
      merchantId: merchant.id,
      spendLimit: blueprint.spendLimit,
      currency: merchant.currency,
      status: blueprint.status,
      categoryLock: blueprint.categoryLock,
      last4: lastFour(number),
      reference: `cref_${pad(cardSeq, 8)}`,
      createdAt: issuedAt.toISOString(),
    }
    cards.push(card)

    cardEvents.push({
      id: `cev_${pad(++eventSeq)}`,
      cardId: card.id,
      type: "issued",
      at: card.createdAt,
      detail: `Issued to ${merchant.name}`,
    })

    // Split the target spend across a few authorisations, in whole minor
    // units, so the card's spend is a sum rather than a stored total.
    let remaining = Math.round(blueprint.spendLimit * blueprint.utilisation)
    const descriptions = AUTH_DESCRIPTIONS[blueprint.categoryLock]
    let index = 0
    while (remaining > 0 && index < descriptions.length) {
      const last = index === descriptions.length - 1
      const amount = last
        ? remaining
        : Math.min(remaining, Math.max(1, Math.round(remaining * 0.45)))
      const at = new Date(issuedAt.getTime() + (index + 1) * 86_400_000)
      cardAuthorizations.push({
        id: `cauth_${pad(++authSeq, 5)}`,
        cardId: card.id,
        amount,
        currency: card.currency,
        description: descriptions[index],
        createdAt: at.toISOString(),
      })
      remaining -= amount
      index++
    }

    if (blueprint.status === "frozen") {
      cardEvents.push({
        id: `cev_${pad(++eventSeq)}`,
        cardId: card.id,
        type: "frozen",
        at: new Date(issuedAt.getTime() + 9 * 86_400_000).toISOString(),
        detail: "Frozen pending vendor review",
      })
    }

    if (blueprint.status === "cancelled") {
      cardEvents.push({
        id: `cev_${pad(++eventSeq)}`,
        cardId: card.id,
        type: "cancelled",
        at: new Date(issuedAt.getTime() + 6 * 86_400_000).toISOString(),
        detail: "Cancelled at the merchant's request",
      })
    }
  }

  return { cards, cardAuthorizations, cardEvents }
}
