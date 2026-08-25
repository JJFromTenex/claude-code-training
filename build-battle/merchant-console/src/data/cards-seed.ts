import {
  generateCardNumber,
  generateCardReference,
} from "@/lib/cards"
import { Card, Payment } from "./types"

/**
 * Cards the platform team issued by hand before this console existed.
 *
 * Numbers are generated at boot on the 4242 test BIN and immediately reduced
 * to their last four — the same path a card issued through the UI takes, so
 * nothing here is a full number sitting in a file.
 */

interface SeedSpec {
  id: string
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Card["currency"]
  status: Card["status"]
  category: Card["category"]
  createdAt: string
}

const SPECS: SeedSpec[] = [
  {
    id: "crd_000001",
    nickname: "Google Ads — Lumen",
    merchantId: "mch_01",
    spendLimit: 500000,
    currency: "USD",
    status: "active",
    category: "advertising",
    createdAt: "2026-06-02T09:15:00.000Z",
  },
  {
    id: "crd_000002",
    nickname: "Figma + Notion seats",
    merchantId: "mch_02",
    spendLimit: 120000,
    currency: "USD",
    status: "active",
    category: "software",
    createdAt: "2026-06-18T14:02:00.000Z",
  },
  {
    id: "crd_000003",
    nickname: "Contractor — brand refresh",
    merchantId: "mch_04",
    spendLimit: 300000,
    currency: "GBP",
    status: "frozen",
    category: "contractors",
    createdAt: "2026-07-01T11:40:00.000Z",
  },
  {
    id: "crd_000004",
    nickname: "Trade show travel",
    merchantId: "mch_03",
    spendLimit: 200000,
    currency: "USD",
    status: "cancelled",
    category: "travel",
    createdAt: "2026-05-11T08:00:00.000Z",
  },
]

/** How much of a merchant's captured volume a seeded card is taken to represent. */
const SPEND_WINDOW_DAYS = 3

/**
 * What a seeded card has spent.
 *
 * Nothing in this repo links a payment to a card — that relationship does not
 * exist in the data model, and inventing one is out of scope. So this derives
 * from real rows instead of hand-picking a number: the merchant's captured
 * payments, in the card's currency, in the three days after the card was
 * issued, capped at its limit.
 *
 * The window is a stated modelling choice rather than a fact, and it is the
 * one approximation here. Everything else about the figure is real: change the
 * seed payments and these move with them. Cards issued through the console
 * start at zero and stay honest without any of this.
 */
function derivedSpend(spec: SeedSpec, payments: Payment[]): number {
  const from = spec.createdAt
  const to = new Date(
    Date.parse(spec.createdAt) + SPEND_WINDOW_DAYS * 86_400_000,
  ).toISOString()

  const total = payments
    .filter(
      (p) =>
        p.merchantId === spec.merchantId &&
        p.currency === spec.currency &&
        p.status === "captured" &&
        p.createdAt >= from &&
        p.createdAt < to,
    )
    .reduce((sum, p) => sum + p.amount, 0)

  return Math.min(total, spec.spendLimit)
}

export function seedCards(payments: Payment[]): Card[] {
  return SPECS.map((spec) => {
    const last4 = generateCardNumber().slice(-4)
    const events: Card["events"] = [
      { at: spec.createdAt, from: null, to: "active" },
    ]
    if (spec.status !== "active") {
      events.push({ at: spec.createdAt, from: "active", to: spec.status })
    }
    return {
      ...spec,
      spent: spec.status === "cancelled" ? 0 : derivedSpend(spec, payments),
      last4,
      reference: generateCardReference(),
      events,
    }
  })
}
