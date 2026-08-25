import {
  generateCardNumber,
  generateCardReference,
} from "@/lib/cards"
import { Card } from "./types"

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
  spent: number
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
    spent: 431200,
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
    spent: 24000,
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
    spent: 300000,
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
    spent: 0,
    currency: "USD",
    status: "cancelled",
    category: "travel",
    createdAt: "2026-05-11T08:00:00.000Z",
  },
]

export function seedCards(): Card[] {
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
      last4,
      reference: generateCardReference(),
      events,
    }
  })
}
