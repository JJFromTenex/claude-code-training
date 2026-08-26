import { CardCategory } from "./types"

/** Single source of truth for category labels, shared by the issue form and the detail page. */
export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  subscriptions: "Vendor subscriptions",
  advertising: "Ad spend",
  contractor_tools: "Contractor tools",
  other: "Other",
}

export const CARD_CATEGORIES: CardCategory[] = Object.keys(
  CARD_CATEGORY_LABELS,
) as CardCategory[]
