import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

/**
 * Tests are plain Node — no jsdom. Everything under test here is money math,
 * date bucketing, and serialization, none of which needs a DOM. Keeping the
 * environment out of the way is what makes `npm test` fast enough to run
 * before every push.
 *
 * `.mts`, not `.ts`: on Node below 22.12 a CommonJS `require` of this file
 * cannot load Vite's ESM build, and `npm test` dies at startup before it
 * collects anything. The extension forces the ESM loader.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
