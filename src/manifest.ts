// Read a skill folder into a canonical file list and hash it (spec 4.3).
import { createHash } from "node:crypto"
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { checkRelPath, checkText, LIMITS, SafetyError } from "./safety.js"

export type SkillFile = { path: string; mode: 420 | 493; text: string }

const SKIP = new Set([".git", ".DS_Store"])

export function sortFiles<T extends { path: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
}

export function readSkillDir(dir: string): SkillFile[] {
  const out: SkillFile[] = []
  const walk = (abs: string, rel: string) => {
    for (const name of readdirSync(abs)) {
      if (SKIP.has(name)) continue
      const a = join(abs, name)
      const r = rel ? `${rel}/${name}` : name
      const st = lstatSync(a)
      if (st.isSymbolicLink()) throw new SafetyError("symlink", `${r} is a symlink; skills may not contain links`)
      if (st.isDirectory()) { walk(a, r); continue }
      if (!st.isFile()) throw new SafetyError("path", `${r} is not a regular file`)
      checkRelPath(r)
      if (out.length >= LIMITS.files) throw new SafetyError("size", `more than ${LIMITS.files} files`)
      if (st.size > LIMITS.fileBytes) throw new SafetyError("size", `${r} is ${st.size} bytes; the limit is ${LIMITS.fileBytes}`)
      const text = checkText(readFileSync(a), r)
      out.push({ path: r, mode: st.mode & 0o111 ? 493 : 420, text })
    }
  }
  walk(dir, "")
  if (!out.some((f) => f.path === "SKILL.md")) throw new SafetyError("frontmatter", "no SKILL.md at the top of the folder")
  return sortFiles(out)
}

const sha256hex = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex")

export function manifestHash(files: SkillFile[]): `0x${string}` {
  const lines = sortFiles(files).map((f) => `${f.path}\u0000${f.mode}\u0000${sha256hex(Buffer.from(f.text, "utf8"))}\n`)
  return `0x${sha256hex(Buffer.from(lines.join(""), "utf8"))}`
}
