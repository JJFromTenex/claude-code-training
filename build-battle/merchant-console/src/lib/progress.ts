/**
 * Spend-vs-limit progress math, pulled out of `ProgressBar` so the
 * amber-at-80% threshold is unit-tested directly instead of only visually.
 */

export function spendRatio(value: number, max: number): number {
  return max > 0 ? Math.min(1, value / max) : 0
}

const AMBER_THRESHOLD = 0.8

export function progressTone(ratio: number): "amber" | "blue" {
  return ratio >= AMBER_THRESHOLD ? "amber" : "blue"
}
