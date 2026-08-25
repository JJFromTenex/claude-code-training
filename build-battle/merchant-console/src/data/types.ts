export type Currency = "USD" | "EUR" | "GBP"

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
 * Cards (NWP-201).
 *
 * A card record never carries the generated number. It carries the last four
 * and an opaque reference; the number itself is returned exactly once, by the
 * issue call, and is not stored anywhere.
 */

export type CardStatus = "active" | "frozen" | "cancelled"

/**
 * What a card is allowed to be spent on. Recorded at issue and displayed.
 * Enforcement belongs to the issuer, which this console does not talk to.
 */
export type MerchantCategory =
  | "advertising"
  | "software"
  | "travel"
  | "office_supplies"
  | "contractors"
  | "any"

export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  currency: Currency
  status: CardStatus
  categoryLock: MerchantCategory
  /** The last four of the generated number. The only digits ever persisted. */
  last4: string
  /** Opaque handle for the generated number. Reveals nothing about it. */
  reference: string
  /** ISO 8601, always UTC. */
  createdAt: string
}

/** An amount authorised against a card. Spend is the sum of these, never a guess. */
export interface CardAuthorization {
  id: string
  cardId: string
  /** Integer minor units, in the card's currency. */
  amount: number
  currency: Currency
  description: string
  /** ISO 8601, always UTC. */
  createdAt: string
}

export type CardEventType = "issued" | "frozen" | "unfrozen" | "cancelled"

/** The audit trail: what happened to a card, and when, in UTC. */
export interface CardEvent {
  id: string
  cardId: string
  type: CardEventType
  /** ISO 8601, always UTC. */
  at: string
  detail: string
}

export interface CardFilters {
  status?: CardStatus | "all"
  merchantId?: string
  search?: string
}
