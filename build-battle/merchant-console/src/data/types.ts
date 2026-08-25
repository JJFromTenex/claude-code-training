export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export type CardStatus = "active" | "frozen" | "cancelled"

export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "office"
  | "other"

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

/** One entry in a card's history. Append-only; nothing rewrites the past. */
export interface CardEvent {
  status: CardStatus
  /** ISO 8601, always UTC. */
  at: string
  note: string
}

/**
 * A virtual card.
 *
 * There is deliberately no field that can hold a full card number. The number
 * exists in exactly one place — the creation response — and is never written
 * here. `reference` is an opaque handle to the generated number, not the
 * number itself.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units. Never a float. */
  spend: number
  currency: Currency
  status: CardStatus
  /** The last four of the generated number. Everything else is masked. */
  last4: string
  /** Opaque handle for the generated number. Not the number. */
  reference: string
  category: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Every status this card has been in, oldest first. */
  history: CardEvent[]
}

export interface CardFilters {
  status?: CardStatus | "all"
  merchantId?: string
  search?: string
  page?: number
  pageSize?: number
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
