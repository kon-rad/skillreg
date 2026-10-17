import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
test("web page never uses innerHTML or insertAdjacentHTML (record text is untrusted)", () => {
  const src = readFileSync("web/main.ts", "utf8")
  expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/)
})
