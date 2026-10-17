// Read a skill folder into a canonical file list and hash it (spec 4.3).
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { sortFiles, type SkillFile } from "./hash.js"
import { checkRelPath, checkText, LIMITS, SafetyError } from "./safety.js"

export { manifestHash, sortFiles, type SkillFile } from "./hash.js"

const SKIP = new Set([".git", ".DS_Store"])

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
