import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { installFiles, lockPath, readLock, verifyInstalled } from "../src/install.js"
import { manifestHash } from "../src/manifest.js"
import { ADDR, files, KEY } from "./fixtures.js"

const skillsDir = () => { const d = join(mkdtempSync(join(tmpdir(), "proj-")), ".agents", "skills"); return d }
const entry = (fs = files()) => ({ creator: ADDR, key: KEY, sha: manifestHash(fs), version: "1.2.3" })
const code = (fn: () => unknown) => { try { fn() } catch (e: any) { return e.code } return "none" }

describe("lockPath", () => {
  test("sits beside a skills folder", () => expect(lockPath("/p/.agents/skills")).toBe("/p/.agents/skills.lock.json"))
  test("sits inside any other folder", () => expect(lockPath("/p/my-tools")).toBe("/p/my-tools/skills.lock.json"))
})

describe("installFiles", () => {
  test("installs with modes and writes the lockfile", () => {
    const d = skillsDir()
    const path = installFiles(d, "hello", files(), entry(), {})
    expect(readFileSync(join(path, "SKILL.md"), "utf8")).toContain("name: hello")
    expect(statSync(join(path, "scripts/run.sh")).mode & 0o777).toBe(0o755)
    expect(statSync(join(path, "SKILL.md")).mode & 0o777).toBe(0o644)
    const lock = readLock(d)
    expect(lock.skills.hello).toMatchObject({ creator: ADDR, key: KEY, version: "1.2.3" })
    expect(readdirSync(d).filter((n) => n.startsWith(".skillreg"))).toEqual([])
  })
  test("reinstall of a locked skill replaces it", () => {
    const d = skillsDir()
    installFiles(d, "hello", files(), entry(), {})
    const fs2 = [files()[0]]
    installFiles(d, "hello", fs2, entry(fs2), {})
    expect(existsSync(join(d, "hello", "scripts"))).toBe(false)
  })
  test("refuses to overwrite an unlocked folder (Review Focus 3)", () => {
    const d = skillsDir()
    mkdirSync(join(d, "hello"), { recursive: true })
    writeFileSync(join(d, "hello", "SKILL.md"), "my private skill")
    expect(code(() => installFiles(d, "hello", files(), entry(), {}))).toBe("exists")
    expect(readFileSync(join(d, "hello", "SKILL.md"), "utf8")).toBe("my private skill")
    installFiles(d, "hello", files(), entry(), { force: true })
    expect(readFileSync(join(d, "hello", "SKILL.md"), "utf8")).toContain("name: hello")
  })
  test("refuses a crafted traversal path and writes nothing (Review Focus 2)", () => {
    const d = skillsDir()
    const evil = [...files(), { path: "../../evil.sh", mode: 493 as const, text: "x" }]
    expect(code(() => installFiles(d, "hello", evil, entry(), {}))).toBe("path")
    expect(existsSync(join(d, "hello"))).toBe(false)
    expect(existsSync(join(d, "..", "..", "evil.sh"))).toBe(false)
    expect(existsSync(d) ? readdirSync(d) : []).toEqual([])
  })
  test("refuses a bad name", () => expect(code(() => installFiles(skillsDir(), "../x", files(), entry(), {}))).toBe("name"))
  test("refuses a bad mode", () => {
    const bad = [{ ...files()[0], mode: 0o4755 as any }]
    expect(code(() => installFiles(skillsDir(), "hello", bad, entry(), {}))).toBe("mode")
  })
})

describe("verifyInstalled", () => {
  test("ok, then detects an edit and a deletion", () => {
    const d = skillsDir()
    installFiles(d, "hello", files(), entry(), {})
    const e = readLock(d).skills.hello
    expect(verifyInstalled(d, "hello", e).ok).toBe(true)
    writeFileSync(join(d, "hello", "SKILL.md"), "changed")
    expect(verifyInstalled(d, "hello", e).ok).toBe(false)
    rmSync(join(d, "hello"), { recursive: true })
    expect(verifyInstalled(d, "hello", e).problems.join()).toMatch(/missing/)
  })
})
