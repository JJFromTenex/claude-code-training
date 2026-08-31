import { CardCategory } from "@/data/types"

/**
 * Shared between the list, detail, and issue drawer so the three surfaces
 * can't drift into showing different names for the same category.
 */
export const CATEGORY_LABELS: Record<CardCategory, string> = {
  vendor_subscriptions: "Vendor subscriptions",
  ad_spend: "Ad spend",
  contractor_tools: "Contractor tools",
}
