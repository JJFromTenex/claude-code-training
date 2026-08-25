import { generate } from "./generate"
import { merchants } from "./merchants"
import { Card, CardEvent, Dispute, Payment, Payout, Refund } from "./types"

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
  cardEvents: CardEvent[]
  /**
   * Idempotency keys seen on POST /api/cards, mapped to the card they created.
   * A double-clicked issue form replays the first card instead of issuing a
   * second one.
   */
  issueKeys: Record<string, string>
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts, cards, cardEvents } = generate()
  return {
    merchants,
    payments,
    refunds,
    disputes,
    payouts,
    cards,
    cardEvents,
    issueKeys: {},
  }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
