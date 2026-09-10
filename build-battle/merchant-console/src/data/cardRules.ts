import { merchantById } from "./merchants"
import { CardStatus, Currency, MerchantCategory } from "./types"

/**
 * Card rules that hold on both sides of the wire. Pure: no store, no crypto,
 * so client components can import the allowlists and the state machine. The
 * server is still the one that enforces them.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  "software",
  "advertising",
  "travel",
  "office_supplies",
  "professional_services",
]

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  software: "Software & SaaS",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
}

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/** Integer minor units: 50,000.00 in the card's currency. */
export const MAX_SPEND_LIMIT = 5_000_000

export const NICKNAME_MAX_LENGTH = 40

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory
}

export type IssueCardField = keyof IssueCardInput

export type ValidationResult =
  | { ok: true; value: IssueCardInput }
  | { ok: false; errors: Partial<Record<IssueCardField, string>> }

/**
 * Checks an issue request against the allowlists. The limit must already be
 * integer minor units: a string like "250.00" is rejected, never parsed.
 */
export function validateIssueCard(body: unknown): ValidationResult {
  const input = (typeof body === "object" && body !== null ? body : {}) as
    Record<string, unknown>
  const errors: Partial<Record<IssueCardField, string>> = {}

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) errors.nickname = "Give the card a nickname."
  else if (nickname.length > NICKNAME_MAX_LENGTH)
    errors.nickname = `Keep the nickname to ${NICKNAME_MAX_LENGTH} characters.`

  const merchant =
    typeof input.merchantId === "string" && input.merchantId
      ? merchantById(input.merchantId)
      : undefined
  if (!input.merchantId) errors.merchantId = "Choose a merchant."
  else if (!merchant) errors.merchantId = "That merchant does not exist."

  const { spendLimit } = input
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit))
    errors.spendLimit = "Spend limit must be a whole number of minor units."
  else if (spendLimit <= 0)
    errors.spendLimit = "Spend limit must be greater than zero."
  else if (spendLimit > MAX_SPEND_LIMIT)
    errors.spendLimit = "Spend limit cannot be more than 50,000.00."

  const currency = input.currency as Currency
  if (!CARD_CURRENCIES.includes(currency))
    errors.currency = "Currency must be USD, EUR, or GBP."
  else if (merchant && merchant.currency !== currency)
    errors.currency = `${merchant.name} settles in ${merchant.currency}. Issue the card in ${merchant.currency}.`

  const category = input.category as MerchantCategory
  if (!MERCHANT_CATEGORIES.includes(category))
    errors.category = "Choose a merchant category."

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      nickname,
      merchantId: merchant!.id,
      spendLimit: spendLimit as number,
      currency,
      category,
    },
  }
}

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

/** The only way a card number is shown after creation. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Amber once spend passes 80% of the limit. Compared in integer minor units,
 * so there is no float to round the wrong way at the boundary.
 */
export function spendTone(
  spent: number,
  limit: number,
): "normal" | "warning" {
  return spent * 100 > limit * 80 ? "warning" : "normal"
}
