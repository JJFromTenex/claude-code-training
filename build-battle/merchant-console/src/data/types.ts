/** Every currency the console settles in. Client input is checked against this list, never the type. */
export const CURRENCIES = ["USD", "EUR", "GBP"] as const
export type Currency = (typeof CURRENCIES)[number]

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

export interface Merchant {
  id: string
  name: string
  country: string
  /** IANA timezone. Display converts to this; storage never does. */
  timezone: string
  currency: Currency
  riskTier: "low" | "standard" | "elevated"
}

export interface Payment {
  id: string
  merchantId: string
  /** Integer minor units. Never a float. */
  amount: number
  currency: Currency
  status: PaymentStatus
  method: "card" | "wallet" | "bank_transfer"
  cardBrand: "visa" | "mastercard" | "amex" | null
  last4: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  description: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: Currency
  reason: "requested_by_customer" | "duplicate" | "fraudulent"
  createdAt: string
}

export interface Dispute {
  id: string
  paymentId: string
  merchantId: string
  amount: number
  currency: Currency
  reasonCode: string
  status: DisputeStatus
  openedAt: string
  /** Evidence deadline, UTC. */
  evidenceDueAt: string
}

export interface Payout {
  id: string
  merchantId: string
  periodStart: string
  periodEnd: string
  gross: number
  fees: number
  net: number
  currency: Currency
  status: PayoutStatus
  paymentIds: string[]
}

export interface PaymentFilters {
  status?: PaymentStatus | "all"
  merchantId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "amount"
  direction?: "asc" | "desc"
}

/**
 * Virtual cards (NWP-201).
 *
 * Status is a state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. The full card number is never stored; the record
 * carries the last four and an opaque reference to the generated number.
 */

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

/** Merchant category a card can be locked to at issue. Null means no lock. */
export const CARD_CATEGORIES = [
  "subscriptions",
  "advertising",
  "contractor_tools",
] as const
export type CardCategory = (typeof CARD_CATEGORIES)[number]

/** Largest spend limit the console will issue, in minor units. 5,000,000 is $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

/** One status change. `from` is null for the issue itself. */
export interface CardEvent {
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Last four digits of the generated number. The number itself is never stored. */
  last4: string
  /** Opaque reference to the generated number. Cannot be turned back into it. */
  numberRef: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /**
   * Integer minor units. Nothing in the console records card spend yet, so
   * this is 0 from issue and stays 0 until a later ticket links spend to cards.
   */
  spent: number
  currency: Currency
  status: CardStatus
  categoryLock: CardCategory | null
  /** Client-generated key so a retried issue does not mint a second card. */
  idempotencyKey: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Status history, oldest first. The first entry is the issue. */
  history: CardEvent[]
}
