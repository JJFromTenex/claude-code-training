import { NextResponse } from "next/server"

/**
 * The one error shape route handlers return: a status code that means what it
 * says, and `{ error: { message } }` with a message safe to show a user.
 * `extra` carries structured detail such as per-field validation messages.
 */
export function apiError(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: { message, ...extra } }, { status })
}
