import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { manifestHash, readSkillDir } from "../src/manifest.js"
import { SafetyError } from "../src/safety.js"

const tmp = () => mkdtempSync(join(tmpdir(), "skillreg-"))
const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const code = (fn: () => unknown) => { try { fn() } catch (e) { return (e as SafetyError).code } return "none" }

describe("readSkillDir", () => {
  test("reads, sorts, detects exec bit", () => {
    const d = tmp()
    writeFileSync(join(d, "SKILL.md"), "x")
    mkdirSync(join(d, "scripts"))
    writeFileSync(join(d, "scripts", "run.sh"), "echo hi")
    chmodSync(join(d, "scripts", "run.sh"), 0o755)
    writeFileSync(join(d, "a.txt"), "a")
    const files = readSkillDir(d)
    expect(files.map((f) => f.path)).toEqual(["SKILL.md", "a.txt", "scripts/run.sh"])
    expect(files.find((f) => f.path === "scripts/run.sh")!.mode).toBe(493)
    expect(files.find((f) => f.path === "a.txt")!.mode).toBe(420)
  })
  test("refuses a symlink (Review Focus 1)", () => {
    const d = tmp()
    writeFileSync(join(d, "SKILL.md"), "x")
    symlinkSync("/etc/hosts", join(d, "hosts"))
    expect(code(() => readSkillDir(d))).toBe("symlink")
  })
  test("refuses binary", () => {
    const d = tmp()
    writeFileSync(join(d, "SKILL.md"), "x")
    writeFileSync(join(d, "b.bin"), Buffer.from([0, 1, 2]))
    expect(code(() => readSkillDir(d))).toBe("binary")
  })
  test("refuses too many files", () => {
    const d = tmp()
    for (let i = 0; i < 201; i++) writeFileSync(join(d, `f${i}.md`), "x")
    expect(code(() => readSkillDir(d))).toBe("size")
  })
  test("refuses a big file", () => {
    const d = tmp()
    writeFileSync(join(d, "SKILL.md"), "x".repeat(65 * 1024))
    expect(code(() => readSkillDir(d))).toBe("size")
  })
  test("requires SKILL.md", () => {
    const d = tmp()
    writeFileSync(join(d, "a.md"), "x")
    expect(code(() => readSkillDir(d))).toBe("frontmatter")
  })
  test("skips .git and .DS_Store", () => {
    const d = tmp()
    writeFileSync(join(d, "SKILL.md"), "x")
    mkdirSync(join(d, ".git"))
    writeFileSync(join(d, ".git", "HEAD"), "ref")
    writeFileSync(join(d, ".DS_Store"), Buffer.from([0, 0]))
    expect(readSkillDir(d).map((f) => f.path)).toEqual(["SKILL.md"])
  })
})

describe("manifestHash", () => {
  test("matches the spec vector", () => {
    const files = [{ path: "SKILL.md", mode: 420 as const, text: "x" }, { path: "a.txt", mode: 420 as const, text: "a" }]
    const expected = "0x" + sha(`SKILL.md\u0000420\u0000${sha("x")}\na.txt\u0000420\u0000${sha("a")}\n`)
    expect(manifestHash(files)).toBe(expected)
  })
  test("is order independent of input order", () => {
    const a = { path: "a.txt", mode: 420 as const, text: "a" }, b = { path: "b.txt", mode: 493 as const, text: "b" }
    expect(manifestHash([a, b])).toBe(manifestHash([b, a]))
  })
})
