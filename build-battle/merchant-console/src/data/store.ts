import { generate } from "./generate"
import { merchants } from "./merchants"
import { Card, Dispute, Payment, Payout, Refund } from "./types"

/**
 * In-memory store.
 *
 * Data is generated once at boot and lives for the life of the process.
 * Writes survive the session and vanish on restart. That is deliberate:
 * persistence is NWP-203 and is out of scope for workshop exercises.
 *
 * Held on globalThis so the Next.js dev server's module reloading does not
 * hand every request a fresh copy.
 */

interface Store {
  merchants: typeof merchants
  payments: Payment[]
  refunds: Refund[]
  disputes: Dispute[]
  payouts: Payout[]
  cards: Card[]
  /** Key → the card it made, plus what it asked for, so a retry is safe. */
  cardIdempotency: Record<string, { cardId: string; fingerprint: string }>
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts, cards } = generate()
  return {
    merchants,
    payments,
    refunds,
    disputes,
    payouts,
    cards,
    cardIdempotency: {},
  }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

/**
 * Pinned unconditionally: cards are the first feature that *writes*, so two
 * module instances would mean issued cards never appearing and two cards
 * minted with the same id. Not dev-only any more.
 */
globalThis.__northwindStore = store
