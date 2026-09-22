import { CardStatus } from "@/data/types"
import { describe, expect, it } from "vitest"
import { canTransition } from "./cardStatus"

const STATUSES: CardStatus[] = ["active", "frozen", "cancelled"]

describe("canTransition", () => {
  it("allows active to frozen and back", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows active or frozen to cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("never lets anything leave cancelled", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a no-op transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("covers every combination explicitly", () => {
    const legal = new Set([
      "active>frozen",
      "active>cancelled",
      "frozen>active",
      "frozen>cancelled",
    ])
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to)).toBe(legal.has(`${from}>${to}`))
      }
    }
  })
})
