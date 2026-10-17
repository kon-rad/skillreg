import { describe, expect, test } from "vitest"
import { parseFrontmatter, summarize } from "../src/frontmatter.js"
import { skillMd } from "./fixtures.js"

describe("parseFrontmatter", () => {
  test("reads fields", () => {
    const fm = parseFrontmatter(skillMd())
    expect(fm).toEqual({ name: "hello", description: "Says hello. Use when the user wants a greeting.", license: "MIT", version: "1.2.3", keywords: ["greeting", "hello", "demo"] })
  })
  test("requires the block", () => expect(() => parseFrontmatter("# no frontmatter")).toThrow(/frontmatter/))
  test("requires name and description", () => {
    expect(() => parseFrontmatter("---\nname: x\n---\n")).toThrow(/description/)
    expect(() => parseFrontmatter("---\ndescription: d\n---\n")).toThrow(/name/)
  })
  test("rejects description over 1024 chars", () => expect(() => parseFrontmatter(`---\nname: x\ndescription: ${"a".repeat(1025)}\n---\n`)).toThrow(/description/))
  test("version falls back to 0.0.0 and accepts top-level version", () => {
    expect(parseFrontmatter("---\nname: x\ndescription: d\n---\n").version).toBe("0.0.0")
    expect(parseFrontmatter("---\nname: x\ndescription: d\nversion: 2.0.1\n---\n").version).toBe("2.0.1")
    expect(parseFrontmatter("---\nname: x\ndescription: d\nmetadata:\n  version: latest\n---\n").version).toBe("0.0.0")
  })
  test("keywords: drop invalid, max 5, array form", () => {
    const fm = parseFrontmatter("---\nname: x\ndescription: d\nmetadata:\n  keywords: [a, b, 'bad word', c, d, e, f]\n---\n")
    expect(fm.keywords).toEqual(["a", "b", "c", "d", "e"])
  })
  test("handles CRLF", () => expect(parseFrontmatter("---\r\nname: x\r\ndescription: d\r\n---\r\nbody").name).toBe("x"))
})

describe("summarize", () => {
  test("short text unchanged, whitespace collapsed", () => expect(summarize("a\n b\tc")).toBe("a b c"))
  test("fits in bytes without splitting characters", () => {
    const s = summarize("é".repeat(100))
    expect(Buffer.byteLength(s)).toBeLessThanOrEqual(120)
    expect(s.endsWith("...")).toBe(true)
    expect(s).not.toContain("�")
  })
})
