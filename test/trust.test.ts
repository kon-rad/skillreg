import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import type { ParsedRating } from "../src/records.js"
import { evaluate, loadTrust } from "../src/trust.js"
import { ADDR, ADDR2, KEY } from "./fixtures.js"

const SHA = ("0x" + "bb".repeat(32)) as `0x${string}`
const PUB = "0x3333333333333333333333333333333333333333" as const
const skill = { key: KEY, sha: SHA, creator: PUB }
const trust = { publishers: [PUB], raters: [ADDR] }
const r = (verdict: ParsedRating["verdict"], over: Partial<ParsedRating> = {}): ParsedRating =>
  ({ key: ("0x" + "cc".repeat(32)) as any, creator: ADDR, skill: KEY, sha: SHA, verdict, kind: "static", raterVer: "0.1.0", findingCount: 0, ...over })

describe("evaluate", () => {
  test("no ratings → WARN", () => expect(evaluate(skill, [], trust).verdict).toBe("WARN"))
  test("trusted clean → PASS", () => expect(evaluate(skill, [r("clean")], trust).verdict).toBe("PASS"))
  test("clean + warn → WARN", () => expect(evaluate(skill, [r("clean"), r("warn")], trust).verdict).toBe("WARN"))
  test("any trusted malicious → BLOCK", () => expect(evaluate(skill, [r("clean"), r("malicious")], trust).verdict).toBe("BLOCK"))
  test("untrusted malicious ignored", () => expect(evaluate(skill, [r("clean"), r("malicious", { creator: ADDR2 })], trust).verdict).toBe("PASS"))
  test("untrusted clean does not PASS (Review Focus 4)", () => expect(evaluate(skill, [r("clean", { creator: ADDR2 })], trust).verdict).toBe("WARN"))
  test("self-rating ignored even if the publisher is a trusted rater (S5)", () => {
    const t = { publishers: [PUB], raters: [ADDR, PUB] }
    expect(evaluate(skill, [r("clean", { creator: PUB })], t).verdict).toBe("WARN")
  })
  test("rating for another key ignored", () => expect(evaluate(skill, [r("malicious", { skill: ("0x" + "dd".repeat(32)) as any })], trust).verdict).toBe("WARN"))
  test("rating for another sha ignored", () => expect(evaluate(skill, [r("malicious", { sha: ("0x" + "ee".repeat(32)) as any })], trust).verdict).toBe("WARN"))
  test("mixed-case addresses match", () => {
    const t = { publishers: [], raters: ["0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD" as any] }
    expect(evaluate(skill, [r("clean", { creator: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as any })], t).verdict).toBe("PASS")
  })
  test("BLOCK reasons quote findings", () => {
    const e = evaluate(skill, [r("malicious", { findings: [{ file: "a.sh", line: 2, rule: "exfil-raw-ip", severity: "critical", excerpt: "curl" }] })], trust)
    expect(e.reasons.join(" ")).toContain("exfil-raw-ip")
  })
})

describe("loadTrust", () => {
  test("explicit file wins and lowercases", () => {
    const d = mkdtempSync(join(tmpdir(), "skillreg-"))
    const f = join(d, "t.json")
    writeFileSync(f, JSON.stringify({ publishers: ["0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD"], raters: [] }))
    expect(loadTrust(f).publishers).toEqual(["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"])
  })
  test("invalid address refused", () => {
    const d = mkdtempSync(join(tmpdir(), "skillreg-"))
    const f = join(d, "t.json")
    writeFileSync(f, JSON.stringify({ publishers: ["nope"], raters: [] }))
    expect(() => loadTrust(f)).toThrow(/address/)
  })
  test("falls back to the packaged default", () => {
    const old = process.env.SKILLREG_TRUST, oldHome = process.env.HOME
    delete process.env.SKILLREG_TRUST
    process.env.HOME = mkdtempSync(join(tmpdir(), "home-"))
    try { expect(loadTrust()).toHaveProperty("raters") } finally { process.env.HOME = oldHome; if (old) process.env.SKILLREG_TRUST = old }
  })
})
