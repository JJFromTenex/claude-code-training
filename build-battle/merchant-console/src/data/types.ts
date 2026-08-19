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

export type CardStatus = "active" | "frozen" | "cancelled"

export type CardCategory =
  | "subscriptions"
  | "advertising"
  | "contractors"
  | "travel"
  | "general"

/**
 * A virtual card as the store holds it. The full number is never here:
 * it is returned once from the issue response and then exists only as
 * `last4` and a reference. See .claude/rules/cards.md.
 */
export interface Card {
  id: string
  merchantId: string
  nickname: string
  /** Spend limit in integer minor units. Never a float. */
  limit: number
  /** Spend so far in integer minor units. */
  spent: number
  currency: Currency
  status: CardStatus
  category: CardCategory
  last4: string
  /** Opaque reference to the generated number; not the number itself. */
  numberRef: string
  /** ISO 8601, always UTC. */
  createdAt: string
}

export interface IssueCardInput {
  merchantId: string
  nickname: string
  limit: number
  currency: Currency
  category: CardCategory
}

