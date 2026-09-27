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

export type CardStatus = "active" | "frozen" | "cancelled"

export type MerchantCategory =
  | "advertising"
  | "software"
  | "contractors"
  | "travel"
  | "any"

export type CardEventKind = "issued" | "frozen" | "unfrozen" | "cancelled"

export interface CardEvent {
  kind: CardEventKind
  /** ISO 8601, always UTC. Display converts to the merchant's timezone. */
  at: string
}

export interface Card {
  id: string
  nickname: string
  merchantId: string
  /**
   * The last four of the generated number. The full number is returned once,
   * in the issue response, and is never stored or re-read.
   */
  last4: string
  /** Non-secret handle for the generated number, safe to show and log. */
  reference: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units, in the same currency as the limit. */
  spend: number
  currency: Currency
  status: CardStatus
  /** Restricts what the card may be used for. `any` is no lock. */
  category: MerchantCategory
  /** ISO 8601, always UTC. */
  createdAt: string
  /**
   * Everything that has happened to this card, oldest first. Ops needs to be
   * able to answer "what happened to this card last Tuesday" without a Slack
   * thread — the same job the payment timeline does.
   */
  history: CardEvent[]
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
