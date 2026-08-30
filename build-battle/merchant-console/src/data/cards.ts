import { randomBytes } from "crypto"
import { canTransition, generateCardNumber, maskCard } from "@/lib/cards"
import { store } from "./store"
import {
  Card,
  CardCategory,
  CardStatus,
  CardStatusChange,
  Currency,
} from "./types"

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

/** Newest first, matching how the payments list is presented. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export function cardByIdRecord(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function cardByRequestId(requestId: string): Card | null {
  return store.cards.find((card) => card.requestId === requestId) ?? null
}

export interface IssueCardInput {
  merchantId: string
  nickname: string
  spendLimit: number
  currency: Currency
  category: CardCategory
  requestId: string
}

/**
 * Mints a card via generateCardNumber(). Only last4 and an opaque numberRef
 * are ever stored — the full number is handed back once, to the route that
 * called this, and never stored or returned again.
 */
export function issueCard(input: IssueCardInput): {
  card: Card
  fullNumber: string
} {
  const fullNumber = generateCardNumber()
  const last4 = fullNumber.slice(-4)
  const numberRef = `cardref_${randomBytes(12).toString("hex")}`
  const createdAt = new Date().toISOString()

  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4,
    numberRef,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    category: input.category,
    status: "active",
    createdAt,
    requestId: input.requestId,
    statusHistory: [{ from: null, to: "active", at: createdAt }],
  }

  store.cards.push(card)
  return { card, fullNumber }
}

export type ChangeCardStatusResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; message: string }

/** Guards the transition on the server; the route translates a failure to a 404/409. */
export function changeCardStatus(
  id: string,
  to: CardStatus,
): ChangeCardStatusResult {
  const card = cardByIdRecord(id)
  if (!card) return { ok: false, reason: "not_found" }

  const from = card.status
  if (!canTransition(from, to)) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Card cannot move from ${from} to ${to}`,
    }
  }

  const change: CardStatusChange = { from, to, at: new Date().toISOString() }
  card.status = to
  card.statusHistory.push(change)
  return { ok: true, card }
}

export interface CardPayload {
  id: string
  merchantId: string
  nickname: string
  last4: string
  masked: string
  spendLimit: number
  spent: number
  currency: Currency
  category: CardCategory
  status: CardStatus
  createdAt: string
  statusHistory: CardStatusChange[]
}

/** Never includes a full number field — numberRef is opaque, not secret, but nothing here re-derives a PAN. */
export function toCardPayload(card: Card): CardPayload {
  return {
    id: card.id,
    merchantId: card.merchantId,
    nickname: card.nickname,
    last4: card.last4,
    masked: maskCard(card.last4),
    spendLimit: card.spendLimit,
    spent: card.spent,
    currency: card.currency,
    category: card.category,
    status: card.status,
    createdAt: card.createdAt,
    statusHistory: card.statusHistory,
  }
}
