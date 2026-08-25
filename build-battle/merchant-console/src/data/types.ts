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

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export type CardStatus = "active" | "frozen" | "cancelled"

/** Categories a card can be locked to. Allowlisted on the server. */
export type MerchantCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "office"

export interface Card {
  id: string
  /** What ops calls it. Shown everywhere the card is listed. */
  nickname: string
  merchantId: string
  /**
   * Integer minor units. Never a float.
   * The full number is never stored — only these last four and `reference`.
   */
  spendLimit: number
  /** Integer minor units, same currency as the limit. */
  spend: number
  currency: Currency
  status: CardStatus
  /** Last four of the generated number. The full PAN is never persisted. */
  last4: string
  /** Opaque handle for the generated number. Not the number itself. */
  reference: string
  /** Optional category lock, chosen at issue time. */
  category: MerchantCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
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
