import { generateCardNumber } from "@/lib/cardNumber"
import { Card } from "./types"

/**
 * Cards ops issued before the console could do it, so the list and the detail
 * page have something real to show on a fresh boot.
 *
 * The numbers come from the same generator the API uses, and the full number
 * is discarded here exactly as it is there: only the last four is kept.
 */
export function seedCards(): Card[] {
  const seeds: Omit<Card, "last4">[] = [
    {
      id: "card_000001",
      nickname: "Figma — design team",
      merchantId: "mch_01",
      spendLimit: 25000,
      spent: 21500,
      currency: "USD",
      status: "active",
      category: "software",
      createdAt: "2026-07-02T09:14:00.000Z",
    },
    {
      id: "card_000002",
      nickname: "Meta Ads — Q3 campaign",
      merchantId: "mch_04",
      spendLimit: 400000,
      spent: 118250,
      currency: "GBP",
      status: "active",
      category: "advertising",
      createdAt: "2026-07-18T13:40:00.000Z",
    },
    {
      id: "card_000003",
      nickname: "Contractor — R. Vogel",
      merchantId: "mch_05",
      spendLimit: 150000,
      spent: 0,
      currency: "EUR",
      status: "frozen",
      category: "contractor",
      createdAt: "2026-08-04T08:05:00.000Z",
    },
    {
      id: "card_000004",
      nickname: "Offsite travel — Denver",
      merchantId: "mch_02",
      spendLimit: 90000,
      spent: 86400,
      currency: "USD",
      status: "cancelled",
      category: "travel",
      createdAt: "2026-08-11T16:22:00.000Z",
    },
  ]

  return seeds.map((seed) => ({ ...seed, last4: generateCardNumber().last4 }))
}
