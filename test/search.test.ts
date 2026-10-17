import { describe, expect, test } from "vitest"
import type { ParsedSkill } from "../src/records.js"
import { rank, score, tokenize } from "../src/search.js"
import { ADDR, ADDR2, KEY } from "./fixtures.js"

const s = (over: Partial<ParsedSkill>): ParsedSkill => ({
  key: KEY, creator: ADDR, createdAt: 1n, expiresAt: 100n, name: "x", version: "1.0.0", sha: KEY, summary: "", keywords: [], license: "MIT", size: 1, fileCount: 1, ...over,
})

describe("tokenize", () => {
  test("lowercases and strips quotes (Review Focus 5)", () => expect(tokenize(["\"PDF's\"", "Forms"])).toEqual(["pdf", "s", "forms"]))
  test("dedupes, keeps hyphens", () => expect(tokenize(["fact-check fact-check", "  "])).toEqual(["fact-check"]))
})

describe("score", () => {
  test("weights", () => {
    expect(score(s({ name: "pdf" }), ["pdf"])).toBe(100)
    expect(score(s({ name: "pdf-tools" }), ["pdf"])).toBe(60)
    expect(score(s({ name: "my-pdf" }), ["pdf"])).toBe(40)
    expect(score(s({ name: "x", keywords: ["pdf"] }), ["pdf"])).toBe(50)
    expect(score(s({ name: "x", summary: "Fill PDF forms" }), ["pdf", "forms"])).toBe(20)
    expect(score(s({ name: "x" }), ["pdf"])).toBe(0)
  })
})

describe("rank", () => {
  test("keeps the latest version per name@creator, then sorts", () => {
    const old = s({ name: "pdf", createdAt: 1n, version: "1.0.0" })
    const neu = s({ name: "pdf", createdAt: 5n, version: "2.0.0" })
    const other = s({ name: "pdf", creator: ADDR2, createdAt: 3n })
    const tools = s({ name: "pdf-tools", createdAt: 9n })
    const r = rank([old, neu, other, tools], ["pdf"], 10)
    expect(r.map((x) => `${x.name}@${x.creator}:${x.version}`)).toEqual([`pdf@${ADDR}:2.0.0`, `pdf@${ADDR2}:1.0.0`, `pdf-tools@${ADDR}:1.0.0`])
  })
  test("limit and no terms → newest first", () => {
    const r = rank([s({ name: "a", createdAt: 1n }), s({ name: "b", createdAt: 2n })], [], 1)
    expect(r.map((x) => x.name)).toEqual(["b"])
  })
})
