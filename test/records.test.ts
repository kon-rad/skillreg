import { describe, expect, test } from "vitest"
import { buildRatingRecord, buildSkillRecord, parseRating, parseSkillAttributes, parseSkillFull } from "../src/records.js"
import { parseFrontmatter } from "../src/frontmatter.js"
import { ADDR, files, KEY } from "./fixtures.js"

const asEntity = (r: { payload: Uint8Array; attributes: Record<string, any> }, extra: Record<string, unknown> = {}) =>
  ({ key: KEY, creator: ADDR, createdAt: 10n, expiresAt: 99n, attributes: r.attributes, payload: r.payload, ...extra })

const fs = files()
const fm = parseFrontmatter(fs[0].text)

describe("skill records", () => {
  test("round trip", () => {
    const rec = buildSkillRecord({ files: fs, fm })
    const s = parseSkillFull(asEntity(rec))
    expect(s.name).toBe("hello")
    expect(s.version).toBe("1.2.3")
    expect(s.sha).toBe(rec.sha)
    expect(s.files).toEqual(fs)
    expect(s.keywords).toEqual(["greeting", "hello", "demo"])
    expect(s.description).toBe(fm.description)
    expect(s.creator).toBe(ADDR)
    expect(parseSkillAttributes(asEntity(rec)).summary).toBe(fm.description)
  })
  test("--keywords override frontmatter", () => {
    const rec = buildSkillRecord({ files: fs, fm, keywords: ["pdf", "forms"] })
    expect(parseSkillAttributes(asEntity(rec)).keywords).toEqual(["pdf", "forms"])
  })
  const tamper = (fn: (p: any) => void) => {
    const rec = buildSkillRecord({ files: fs, fm })
    const p = JSON.parse(new TextDecoder().decode(rec.payload)); fn(p)
    return { ...rec, payload: new TextEncoder().encode(JSON.stringify(p)) }
  }
  const code = (f: () => unknown) => { try { f() } catch (e: any) { return e.code } return "none" }
  test("tampered text fails the hash (S7)", () => expect(code(() => parseSkillFull(asEntity(tamper((p) => { p.files[1].text = "rm -rf ~" }))))).toBe("hash"))
  test("traversal path refused (S1)", () => expect(code(() => parseSkillFull(asEntity(tamper((p) => { p.files[1].path = "../x" }))))).toBe("path"))
  test("duplicate path refused", () => expect(code(() => parseSkillFull(asEntity(tamper((p) => { p.files.push({ ...p.files[1] }) }))))).toBe("path"))
  test("bad mode refused (S4)", () => expect(code(() => parseSkillFull(asEntity(tamper((p) => { p.files[1].mode = 0o4755 }))))).toBe("mode"))
  test("oversized payload refused before parsing (S3)", () => {
    const rec = buildSkillRecord({ files: fs, fm })
    const big = new Uint8Array(97 * 1024).fill(123) // "{{{{" would throw a JSON error if parsed
    expect(code(() => parseSkillFull(asEntity({ ...rec, payload: big })))).toBe("size")
  })
  test("attribute name must match SKILL.md name (S2)", () => {
    const rec = buildSkillRecord({ files: fs, fm })
    const attributes = { ...rec.attributes, name: { type: "str", value: "other" } }
    expect(code(() => parseSkillFull(asEntity({ ...rec, attributes })))).toBe("name")
  })
  test("wrong type refused by attribute parser", () => {
    const rec = buildSkillRecord({ files: fs, fm })
    expect(code(() => parseSkillAttributes(asEntity({ ...rec, attributes: { ...rec.attributes, t: { type: "str", value: "rating" } } })))).toBe("record")
  })
  test("build refuses over 96 KiB", () => {
    const many = Array.from({ length: 2 }, (_, i) => ({ path: `big${i}.md`, mode: 420 as const, text: "x".repeat(60 * 1024) }))
    expect(code(() => buildSkillRecord({ files: [fs[0], ...many], fm }))).toBe("size")
  })
  test("build refuses name mismatch with folder files", () => {
    expect(code(() => buildSkillRecord({ files: files("hello"), fm: { ...fm, name: "Bad Name" } }))).toBe("name")
  })
})

describe("rating records", () => {
  const findings = [{ file: "scripts/x.sh", line: 3, rule: "exfil-raw-ip", severity: "critical" as const, excerpt: "y".repeat(500) }]
  test("round trip and caps", () => {
    const r = buildRatingRecord({ skillKey: KEY, sha: KEY, verdict: "malicious", kind: "static", raterVer: "0.1.0", findings, rulesHash: KEY, note: "n".repeat(3000) })
    expect(r.permissionless).toBe(true)
    const p = parseRating({ key: KEY, creator: ADDR, attributes: r.attributes, payload: r.payload }, true)
    expect(p.verdict).toBe("malicious")
    expect(p.skill).toBe(KEY)
    expect(p.findings![0].excerpt.length).toBe(200)
    expect(p.note!.length).toBe(2000)
  })
  test("clean is not permissionless", () => {
    expect(buildRatingRecord({ skillKey: KEY, sha: KEY, verdict: "clean", kind: "human", raterVer: "human", findings: [], rulesHash: null }).permissionless).toBe(false)
  })
  test("unknown verdict refused on parse", () => {
    const r = buildRatingRecord({ skillKey: KEY, sha: KEY, verdict: "clean", kind: "human", raterVer: "human", findings: [], rulesHash: null })
    expect(() => parseRating({ key: KEY, creator: ADDR, attributes: { ...r.attributes, verdict: { type: "str", value: "great" } } }, false)).toThrow()
  })
  test("payload stays under 32 KiB with many findings", () => {
    const lots = Array.from({ length: 500 }, (_, i) => ({ ...findings[0], line: i }))
    const r = buildRatingRecord({ skillKey: KEY, sha: KEY, verdict: "malicious", kind: "static", raterVer: "0.1.0", findings: lots, rulesHash: KEY })
    expect(r.payload.length).toBeLessThanOrEqual(32 * 1024)
  })
})
