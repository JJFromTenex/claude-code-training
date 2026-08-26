import { describe, expect, it } from "vitest"
import { GET as getCard, PATCH } from "./[id]/route"
import { GET, POST } from "./route"

/**
 * The route handlers, exercised directly.
 *
 * The unit tests beside `src/lib/cards.ts` prove the rules in isolation; these
 * prove the route applies them — that validation is server enforcement rather
 * than a client convenience, that the state machine is guarded where it
 * matters, and above all that the generated number leaves in the creation
 * response and in nothing else.
 */

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
})

const issue = (body: unknown, key?: string) =>
  POST(new Request("http://localhost/api/cards",
    json(body, key ? { "idempotency-key": key } : {})) as never)

const patch = (id: string, status: unknown) =>
  PATCH(new Request(`http://localhost/api/cards/${id}`, json({ status })) as never,
    { params: Promise.resolve({ id }) })

const good = {
  nickname: "Route test", merchantId: "mch_01",
  spendLimit: 250000, currency: "USD", category: "software",
}

describe("POST /api/cards", () => {
  it("reveals the number once, stores only last4, and leaks it nowhere after", async () => {
    const response = await issue(good)
    expect(response.status).toBe(201)
    const { card, number } = await response.json()

    expect(number).toMatch(/^4242\d{12}$/)
    expect(card).not.toHaveProperty("number")
    expect(card.last4).toBe(number.slice(-4))
    expect(card.spendLimit).toBe(250000)
    expect(card.spent).toBe(0)

    const list = await (await GET()).json()
    const detail = await (
      await getCard(null as never, { params: Promise.resolve({ id: card.id }) })
    ).json()
    expect(JSON.stringify(list)).not.toContain(number)
    expect(JSON.stringify(detail)).not.toContain(number)
  })

  it.each([
    { merchantId: "mch_nope" }, { spendLimit: 0 }, { spendLimit: 5_000_001 },
    { spendLimit: 12.5 }, { currency: "JPY" }, { currency: "EUR" }, { nickname: "  " },
  ])("refuses %o at the route, not only in the form", async (patchBody) => {
    const response = await issue({ ...good, ...patchBody })
    expect(response.status).toBe(400)
    expect(await response.json()).toHaveProperty("message")
  })

  it("issues one card for a repeated idempotency key, revealing once", async () => {
    const key = "test-key-001"
    const a = await (await issue({ ...good, nickname: "Idempotent" }, key)).json()
    const second = await issue({ ...good, nickname: "Idempotent" }, key)
    const b = await second.json()

    expect(second.status).toBe(200)
    expect(b.card.id).toBe(a.card.id)
    expect(b.alreadyIssued).toBe(true)
    expect(b).not.toHaveProperty("number")
  })
})

describe("PATCH /api/cards/[id]", () => {
  it("enforces the state machine and records every transition", async () => {
    const { card } = await (await issue({ ...good, nickname: "Machine" })).json()

    expect((await patch(card.id, "frozen")).status).toBe(200)
    expect((await patch(card.id, "active")).status).toBe(200)
    expect((await patch(card.id, "active")).status).toBe(409)
    expect((await patch(card.id, "nonsense")).status).toBe(400)

    const cancelled = await (await patch(card.id, "cancelled")).json()
    expect(cancelled.card.events.map((e: { to: string }) => e.to))
      .toEqual(["active", "frozen", "active", "cancelled"])

    // Cancelled is terminal: nothing comes back from it.
    expect((await patch(card.id, "active")).status).toBe(409)
    expect((await patch(card.id, "frozen")).status).toBe(409)
    expect((await patch("crd_missing", "frozen")).status).toBe(404)
  })
})
