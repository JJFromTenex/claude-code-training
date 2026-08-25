import { CardCategory } from "@/data/types"

/**
 * How card categories are written on screen.
 *
 * Presentation only, and deliberately free of data imports so both the server
 * pages and the client drawer can share one copy rather than each keeping its
 * own. A second copy is how two screens start disagreeing about a label.
 */
export const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}
