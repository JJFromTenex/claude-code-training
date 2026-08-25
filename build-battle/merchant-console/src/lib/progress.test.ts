import { describe, expect, it } from "vitest"
import { progressTone, spendRatio } from "./progress"

describe("spendRatio", () => {
  it("divides value by max", () => {
    expect(spendRatio(50, 100)).toBe(0.5)
  })

  it("caps at 1 once value exceeds max", () => {
    expect(spendRatio(150, 100)).toBe(1)
  })

  it("is 0 when max is 0, never divides by zero", () => {
    expect(spendRatio(0, 0)).toBe(0)
  })
})

describe("progressTone", () => {
  it("stays blue below the 80% threshold", () => {
    expect(progressTone(0.79)).toBe("blue")
  })

  it("turns amber exactly at 80%", () => {
    expect(progressTone(0.8)).toBe("amber")
  })

  it("stays amber above 80%, up to the ratio cap of 1", () => {
    expect(progressTone(1)).toBe("amber")
  })
})
