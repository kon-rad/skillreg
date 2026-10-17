// Canonical manifest hash (spec 4.3). Pure and synchronous, so it runs in Node and in the browser.
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js"

export type SkillFile = { path: string; mode: 420 | 493; text: string }

export const utf8Len = (s: string) => utf8ToBytes(s).length
export const sha256hex = (s: string | Uint8Array) => bytesToHex(sha256(typeof s === "string" ? utf8ToBytes(s) : s))

const cmpBytes = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

export function sortFiles<T extends { path: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => cmpBytes(utf8ToBytes(a.path), utf8ToBytes(b.path)))
}

export function manifestHash(files: SkillFile[]): `0x${string}` {
  const lines = sortFiles(files).map((f) => `${f.path}\u0000${f.mode}\u0000${sha256hex(f.text)}\n`)
  return `0x${sha256hex(lines.join(""))}`
}
