import { describe, expect, test } from "vitest"
import { resolveInside } from "../src/fsafety.js"
import { checkRelPath, checkSkillName, checkText, leakCheck, SafetyError } from "../src/safety.js"

const throwsCode = (fn: () => unknown, code: string) => {
  try { fn() } catch (e) { expect(e).toBeInstanceOf(SafetyError); expect((e as SafetyError).code).toBe(code); return }
  throw new Error("expected SafetyError " + code)
}

describe("checkRelPath (S1)", () => {
  test.each(["SKILL.md", "scripts/run.sh", "a/b/c/d/e/f/g/h.md"])("accepts %s", (p) => checkRelPath(p))
  test.each(["../x", "a/../../x", "a/..", "/etc/passwd", "\\x", "a\\b", "C:x", "a//b", "a/", "", "a\0b", ".", "a/./b",
    "a/b/c/d/e/f/g/h/i.md", "x".repeat(256)])("rejects %j", (p) => throwsCode(() => checkRelPath(p), "path"))
})

describe("resolveInside (S1)", () => {
  test("resolves inside", () => expect(resolveInside("/t", "a/b")).toBe("/t/a/b"))
  test("rejects escape", () => throwsCode(() => resolveInside("/t", "../t2/x"), "path"))
})

describe("checkSkillName (S2)", () => {
  test.each(["pdf", "pdf-tools-2", "a".repeat(64)])("accepts %s", (n) => checkSkillName(n))
  test.each(["PDF", "-pdf", "pdf-", "pdf--x", "pdf_x", "a".repeat(65), "", "pdf x"])("rejects %j", (n) =>
    throwsCode(() => checkSkillName(n), "name"))
})

describe("checkText", () => {
  test("returns text", () => expect(checkText(new TextEncoder().encode("héllo"), "a")).toBe("héllo"))
  test("rejects NUL", () => throwsCode(() => checkText(new Uint8Array([104, 0, 105]), "a"), "binary"))
  test("rejects invalid UTF-8", () => throwsCode(() => checkText(new Uint8Array([0xff, 0xfe]), "a"), "binary"))
})

describe("leakCheck (S6)", () => {
  test.each([".env", ".env.local", "conf/id_rsa", "x.pem", "a/server.key", "credentials.json", "auth.json", ".npmrc", "id_ed25519.pub"])(
    "flags file name %s", (p) => expect(leakCheck(p, "hello").length).toBeGreaterThan(0))
  test.each([
    "key = AKIAABCDEFGHIJKLMNOP",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "token sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
    "OPENAI=sk-abcdefghijklmnopqrstuvwx",
    "ghp_" + "a".repeat(36),
    "github_pat_" + "a".repeat(40),
    "xoxb-123456-abcdef",
    "PRIVATE_KEY=0x" + "ab".repeat(32),
  ])("flags content %s", (t) => expect(leakCheck("SKILL.md", t).length).toBeGreaterThan(0))
  test.each(["sha256: 0x" + "ab".repeat(32), "the digest is 0x" + "cd".repeat(32), "plain text about skills"])(
    "does not flag %s", (t) => expect(leakCheck("SKILL.md", t)).toEqual([]))
})
