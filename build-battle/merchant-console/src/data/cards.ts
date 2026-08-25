import { Card } from "./types"

/**
 * Seed cards, following the merchants.ts pattern: fictional, nothing here
 * corresponds to a real card. Only last-four digits are stored; the full
 * numbers never existed. One card sits past 80% of its limit and one is
 * frozen so the list, the spend bar, and the badge all have something real
 * to show at boot.
 */
export const seedCards: Card[] = [
  {
    id: "card_01",
    merchantId: "mch_01",
    nickname: "Search ad spend",
    last4: "4242",
    numberReference: "cref_7f3a91c2d8b4",
    spendLimit: 250000,
    // 85% of the limit — the amber case on the detail page.
    spent: 212500,
    currency: "USD",
    status: "active",
    categoryLock: "ads",
    createdAt: "2026-07-14T09:30:00.000Z",
  },
  {
    id: "card_02",
    merchantId: "mch_04",
    nickname: "Contractor design tools",
    last4: "8926",
    numberReference: "cref_2b6e04a9f1c7",
    spendLimit: 120000,
    spent: 34000,
    currency: "GBP",
    status: "frozen",
    categoryLock: "saas",
    createdAt: "2026-07-28T14:05:00.000Z",
  },
  {
    id: "card_03",
    merchantId: "mch_05",
    nickname: "Vendor subscriptions",
    last4: "1057",
    numberReference: "cref_c94d17e6a3f0",
    spendLimit: 80000,
    spent: 80000,
    currency: "EUR",
    status: "cancelled",
    categoryLock: null,
    createdAt: "2026-06-02T08:15:00.000Z",
  },
]
