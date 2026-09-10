import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

/**
 * Tests are plain Node — no jsdom. Everything under test here is money math,
 * date bucketing, and serialization, none of which needs a DOM. Keeping the
 * environment out of the way is what makes `npm test` fast enough to run
 * before every push.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
