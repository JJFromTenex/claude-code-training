import { randomInt, randomUUID } from "node:crypto"
import { CARD_NUMBER_LENGTH, luhnCheckDigit, TEST_BIN } from "./cards"

/**
 * Card number generation, server-only by construction: the node:crypto import
 * means a client bundle that reaches for this fails to build rather than
 * quietly shipping a browser-generated card number. Numbers are issued on the
 * 4242 test BIN with a valid Luhn digit, so nothing here can resemble a real
 * PAN. The full number is returned once by the create handler and never
 * stored; only the last four and an opaque reference survive.
 */

/** A 16-digit number on the test BIN. Crypto random, never the seed PRNG. */
export function generateCardNumber(bin = TEST_BIN): string {
  const bodyLength = CARD_NUMBER_LENGTH - bin.length - 1
  let payload = bin
  for (let i = 0; i < bodyLength; i++) payload += randomInt(0, 10)
  return `${payload}${luhnCheckDigit(payload)}`
}

/** Opaque stand-in for the network reference. Not derived from the number. */
export function cardReference(): string {
  return `cref_${randomUUID()}`
}
