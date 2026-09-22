export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type PaymentMethod = "card" | "wallet" | "bank_transfer"

export type CardBrand = "visa" | "mastercard" | "amex"

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
  method: PaymentMethod
  cardBrand: CardBrand | null
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
  method?: PaymentMethod | "all"
  /** Only meaningful when method is "card"; dropped otherwise. */
  cardBrand?: CardBrand | "all"
  /** Gates the amount range: without it, min/max are dropped. */
  currency?: Currency
  /** Integer minor units, converted from client input at the boundary. */
  minAmount?: number
  maxAmount?: number
  page?: number
  pageSize?: number
  sort?: PaymentSort
  direction?: "asc" | "desc"
}

export type PaymentSort = "createdAt" | "amount" | "merchant" | "status"

export interface CurrencyTotal {
  currency: Currency
  /** Integer minor units. */
  amount: number
}

export interface PaymentSummary {
  count: number
  /** One entry per currency present. Amounts are never summed across currencies. */
  totals: CurrencyTotal[]
}
