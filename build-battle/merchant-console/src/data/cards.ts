import {
  MAX_SPEND_LIMIT_MINOR_UNITS,
  MIN_SPEND_LIMIT_MINOR_UNITS,
  canTransition,
  generateCardNumber,
  generateCardReference,
  isCardStatus,
  last4Of,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById, merchants } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

/**
 * Card records and the one gate everything from the client passes through.
 *
 * Route handlers call `validateIssueCardInput` rather than reading a body
 * themselves, the way `src/app/api/payments/route.ts` delegates to
 * `parseFilters`. Cards need no filtering for NWP-201, so these are
 * single-record accessors in the shape of `paymentById`, not a second
 * implementation of the payment query builder.
 */

/** Allowlist. Anything outside it is rejected before it reaches the store. */
export const ALLOWED_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Allowlist. Same rule. */
export const ALLOWED_CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "office_supplies",
]

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software & subscriptions",
  contractors: "Contractors",
  travel: "Travel",
  office_supplies: "Office supplies",
}

const NICKNAME_MAX_LENGTH = 60

/** Every issued card, newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** Merchants a card may be issued against, for the form's select. */
export function issuableMerchants() {
  return merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    currency: merchant.currency,
  }))
}

export interface IssueCardValues {
  nickname: string
  merchantId: string
  /** Integer minor units, already range-checked. */
  spendLimit: number
  currency: Currency
  categoryLock: MerchantCategory | null
}

export type ValidationResult =
  | { ok: true; values: IssueCardValues }
  | { ok: false; message: string; fieldErrors: Record<string, string> }

/**
 * The allowlist gate for issuing a card. The client is not trusted: this runs
 * on the server and is the only thing that decides what reaches the store.
 *
 * `spendLimit` arrives as major units the way a person types them — `"250"`,
 * `"250.00"`, `1250.75` — and is converted to minor units here, once, by the
 * existing `parseAmountToMinorUnits`. Every check collects its own message so
 * the form can mark the field that is actually wrong.
 */
export function validateIssueCardInput(input: unknown): ValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      message: "Expected a JSON object describing the card to issue.",
      fieldErrors: {},
    }
  }

  const body = input as Record<string, unknown>

  // Nickname
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    fieldErrors.nickname = "Give the card a nickname so ops can recognise it."
  } else if (nickname.length > NICKNAME_MAX_LENGTH) {
    fieldErrors.nickname = `Keep the nickname under ${NICKNAME_MAX_LENGTH} characters.`
  }

  // Merchant — must be one that exists, not merely a non-empty string.
  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId.trim() : ""
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchantId) {
    fieldErrors.merchantId = "Choose the merchant this card belongs to."
  } else if (!merchant) {
    fieldErrors.merchantId = "That merchant does not exist."
  }

  // Currency — allowlist, before it reaches the store.
  const currency = typeof body.currency === "string" ? body.currency : ""
  if (!currency) {
    fieldErrors.currency = "Choose a currency."
  } else if (!ALLOWED_CURRENCIES.includes(currency as Currency)) {
    fieldErrors.currency = `Currency must be one of ${ALLOWED_CURRENCIES.join(", ")}.`
  }

  // Spend limit — major units in, integer minor units out, parsed once.
  const rawLimit = body.spendLimit
  let spendLimit: number | null = null
  if (typeof rawLimit === "string" || typeof rawLimit === "number") {
    spendLimit = parseAmountToMinorUnits(String(rawLimit))
  }

  if (spendLimit === null) {
    fieldErrors.spendLimit = "Enter a spend limit as an amount, like 250.00."
  } else if (spendLimit < MIN_SPEND_LIMIT_MINOR_UNITS) {
    fieldErrors.spendLimit = "The spend limit must be greater than zero."
  } else if (spendLimit > MAX_SPEND_LIMIT_MINOR_UNITS) {
    fieldErrors.spendLimit = `The spend limit cannot exceed ${MAX_SPEND_LIMIT_MINOR_UNITS} minor units.`
  }

  // Category lock — optional, but allowlisted when present.
  const rawCategory = body.categoryLock
  let categoryLock: MerchantCategory | null = null
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    if (
      typeof rawCategory === "string" &&
      ALLOWED_CATEGORIES.includes(rawCategory as MerchantCategory)
    ) {
      categoryLock = rawCategory as MerchantCategory
    } else {
      fieldErrors.categoryLock = `Category must be one of ${ALLOWED_CATEGORIES.join(", ")}.`
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "That card could not be issued. Check the highlighted fields.",
      fieldErrors,
    }
  }

  return {
    ok: true,
    values: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
      categoryLock,
    },
  }
}

/**
 * Card ids are unique without a database sequence to lean on, so they carry a
 * random suffix rather than a count that two requests could read at once.
 */
function nextCardId(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
  return `card_${hex.join("")}`
}

/**
 * Issue a card.
 *
 * The full number exists only in this function's return value. What goes into
 * the store is the last four and a reference, so there is nothing to re-read
 * later even by mistake.
 */
export function createCard(values: IssueCardValues): {
  card: Card
  fullNumber: string
} {
  const fullNumber = generateCardNumber()

  const card: Card = {
    id: nextCardId(),
    nickname: values.nickname,
    merchantId: values.merchantId,
    last4: last4Of(fullNumber),
    reference: generateCardReference(),
    spendLimit: values.spendLimit,
    spend: 0,
    currency: values.currency,
    status: "active",
    categoryLock: values.categoryLock,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)

  return { card, fullNumber }
}

export type StatusChangeResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "unknown_status" | "illegal"; message: string }

/**
 * Move a card through the status machine.
 *
 * The transition is guarded here, on the server, so a hand-made request
 * cannot walk a cancelled card back to active.
 */
export function setCardStatus(id: string, to: unknown): StatusChangeResult {
  const card = cardById(id)
  if (!card) {
    return { ok: false, reason: "not_found", message: "No card with that id." }
  }

  if (!isCardStatus(to)) {
    return {
      ok: false,
      reason: "unknown_status",
      message: "Status must be active, frozen, or cancelled.",
    }
  }

  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      reason: "illegal",
      message:
        card.status === "cancelled"
          ? "This card is cancelled, and a cancelled card cannot change status."
          : `A card cannot go from ${card.status} to ${to}.`,
    }
  }

  card.status = to as CardStatus
  return { ok: true, card }
}
