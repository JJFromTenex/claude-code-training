/**
 * Client-safe card display helpers.
 *
 * Deliberately separate from `./cards`, which holds the number generator:
 * importing that module from a `"use client"` component would ship the
 * generator into the browser bundle, and `.claude/rules/cards.md` requires
 * generation to stay on the server.
 */

/** The only card-number rendering in the app. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}
