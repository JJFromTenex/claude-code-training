import { NextResponse } from "next/server"

/**
 * One error shape for every route handler: a status code that means what it
 * says, a message safe to show a user, and per-field reasons when a form was
 * refused. Handlers reject early and return rather than nesting.
 */
export function jsonError(
  status: number,
  message: string,
  errors?: Record<string, string>,
) {
  return NextResponse.json(errors ? { message, errors } : { message }, {
    status,
  })
}
