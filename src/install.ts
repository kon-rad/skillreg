// Atomic install into a skills folder, plus the lockfile (spec 6 S1/S4/S8 and 7).
import { randomBytes } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import type { Hex } from "viem"
import { manifestHash, readSkillDir, type SkillFile } from "./manifest.js"
import { resolveInside } from "./fsafety.js"
import { checkRelPath, checkSkillName, SafetyError } from "./safety.js"

export type LockEntry = { creator: Hex; key: Hex; sha: Hex; version: string; installed_at: string }
export type Lock = { version: 1; skills: Record<string, LockEntry> }

export function lockPath(dir: string): string {
  const d = dir.replace(/\/+$/, "")
  return basename(d) === "skills" ? join(dirname(d), "skills.lock.json") : join(d, "skills.lock.json")
}

export function readLock(dir: string): Lock {
  const p = lockPath(dir)
  if (!existsSync(p)) return { version: 1, skills: {} }
  const data = JSON.parse(readFileSync(p, "utf8"))
  if (data?.version !== 1 || typeof data.skills !== "object") throw new SafetyError("lock", `${p} is not a skillreg lockfile`)
  return data as Lock
}

function writeLock(dir: string, lock: Lock): void {
  const p = lockPath(dir)
  mkdirSync(dirname(p), { recursive: true })
  const tmp = `${p}.tmp-${randomBytes(4).toString("hex")}`
  writeFileSync(tmp, JSON.stringify(lock, null, 2) + "\n")
  renameSync(tmp, p)
}

export function installFiles(dir: string, name: string, files: SkillFile[], entry: Omit<LockEntry, "installed_at">, opt: { force?: boolean }): string {
  checkSkillName(name)
  // Validate everything before touching the disk.
  const seen = new Set<string>()
  for (const f of files) {
    checkRelPath(f.path)
    if (seen.has(f.path)) throw new SafetyError("path", `duplicate path ${f.path}`)
    seen.add(f.path)
    if (f.mode !== 420 && f.mode !== 493) throw new SafetyError("mode", `${f.path} has mode ${f.mode}; only 0644 and 0755 are allowed`)
  }
  if (manifestHash(files) !== entry.sha) throw new SafetyError("hash", "files do not match the expected sha")
  const target = join(dir, name)
  const lock = readLock(dir)
  if (existsSync(target) && !lock.skills[name] && !opt.force) {
    throw new SafetyError("exists", `${target} exists and was not installed by skillreg; use --force to replace it`)
  }
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.skillreg-tmp-${randomBytes(6).toString("hex")}`)
  const old = join(dir, `.skillreg-old-${randomBytes(6).toString("hex")}`)
  try {
    mkdirSync(tmp)
    for (const f of files) {
      const out = resolveInside(tmp, f.path)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, f.text, { flag: "wx" })
      chmodSync(out, f.mode)
    }
    if (existsSync(target)) renameSync(target, old)
    renameSync(tmp, target)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    rmSync(old, { recursive: true, force: true })
  }
  lock.skills[name] = { ...entry, installed_at: new Date().toISOString() }
  writeLock(dir, lock)
  return target
}

export function verifyInstalled(dir: string, name: string, entry: LockEntry): { ok: boolean; problems: string[] } {
  const target = join(dir, name)
  if (!existsSync(target)) return { ok: false, problems: [`${target} is missing`] }
  try {
    const sha = manifestHash(readSkillDir(target))
    return sha === entry.sha ? { ok: true, problems: [] } : { ok: false, problems: [`files in ${target} changed since install`] }
  } catch (e) {
    return { ok: false, problems: [`${target}: ${(e as Error).message}`] }
  }
}
