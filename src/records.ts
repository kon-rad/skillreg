// Build and parse skillreg's two Arkiv record types (spec section 4).
import { bytes32, key, str, u64 } from "@arkiv-network/sdk/attr"
import type { Hex } from "viem"
import { normalizeKeywords, parseFrontmatter, summarize, truncBytes, type Frontmatter } from "./frontmatter.js"
import { manifestHash, sortFiles, type SkillFile } from "./manifest.js"
import { checkRelPath, checkSkillName, LIMITS, SafetyError } from "./safety.js"

export const SCHEMA = 1
export type Verdict = "clean" | "warn" | "malicious"
export const VERDICTS: Verdict[] = ["clean", "warn", "malicious"]
export type Finding = { file: string; line: number; rule: string; severity: "critical" | "warn"; excerpt: string }

export type EntityLike = {
  key?: Hex
  creator?: Hex
  createdAt?: bigint
  expiresAt?: bigint
  attributes?: Readonly<Record<string, { type: string; value: unknown }>>
  payload?: Uint8Array
}

export type ParsedSkill = {
  key: Hex
  creator: Hex
  createdAt: bigint
  expiresAt: bigint
  name: string
  version: string
  sha: Hex
  summary: string
  keywords: string[]
  license: string
  size: number
  fileCount: number
  description?: string
  files?: SkillFile[]
}

export type ParsedRating = {
  key: Hex
  creator: Hex
  skill: Hex
  sha: Hex
  verdict: Verdict
  kind: string
  raterVer: string
  findingCount: number
  findings?: Finding[]
  note?: string
  rulesHash?: string | null
}

const enc = new TextEncoder()
const dec = new TextDecoder("utf-8", { fatal: true })
const bad = (code: string, msg: string) => new SafetyError(code, msg)

// ---------- skill ----------

export function buildSkillRecord(i: { files: SkillFile[]; fm: Frontmatter; keywords?: string[] }) {
  checkSkillName(i.fm.name)
  const files = sortFiles(i.files)
  const seen = new Set<string>()
  for (const f of files) {
    checkRelPath(f.path)
    if (seen.has(f.path)) throw bad("path", `duplicate path ${f.path}`)
    seen.add(f.path)
  }
  const sha = manifestHash(files)
  const size = files.reduce((n, f) => n + Buffer.byteLength(f.text), 0)
  const payload = enc.encode(JSON.stringify({ description: i.fm.description, files }))
  if (payload.length > LIMITS.skillPayload) {
    throw bad("size", `skill is ${payload.length} bytes as a record; the limit is ${LIMITS.skillPayload}`)
  }
  const kws = i.keywords ? normalizeKeywords(i.keywords) : i.fm.keywords
  const attributes: Record<string, any> = {
    t: str("skill"),
    schema: u64(SCHEMA),
    name: str(i.fm.name),
    version: str(i.fm.version),
    sha: bytes32(sha),
    summary: str(summarize(i.fm.description)),
    license: str(truncBytes(i.fm.license ?? "unspecified", 64) || "unspecified"),
    size: u64(size),
    files: u64(files.length),
  }
  kws.forEach((k, n) => (attributes[`kw${n + 1}`] = str(k)))
  return { payload, attributes, sha }
}

const val = (e: EntityLike, name: string, type: string): any => {
  const a = e.attributes?.[name]
  if (!a || a.type !== type) throw bad("record", `attribute ${name} missing or not ${type}`)
  return a.value
}
const optStr = (e: EntityLike, name: string): string | undefined => {
  const a = e.attributes?.[name]
  return a && a.type === "str" ? String(a.value) : undefined
}
const lowerHex = (v: unknown, n: string): Hex => {
  if (typeof v !== "string" || !/^0x[0-9a-fA-F]+$/.test(v)) throw bad("record", `${n} is not hex`)
  return v.toLowerCase() as Hex
}

export function parseSkillAttributes(e: EntityLike): ParsedSkill {
  if (val(e, "t", "str") !== "skill") throw bad("record", "not a skill record")
  if (BigInt(val(e, "schema", "u64")) !== BigInt(SCHEMA)) throw bad("record", "unsupported schema")
  if (!e.key || !e.creator) throw bad("record", "record has no key or creator")
  const name = String(val(e, "name", "str"))
  checkSkillName(name)
  const keywords: string[] = []
  for (let n = 1; n <= 5; n++) {
    const k = optStr(e, `kw${n}`)
    if (k && /^[a-z0-9-]{1,32}$/.test(k)) keywords.push(k)
  }
  return {
    key: lowerHex(e.key, "key"),
    creator: lowerHex(e.creator, "creator"),
    createdAt: e.createdAt ?? 0n,
    expiresAt: e.expiresAt ?? 0n,
    name,
    version: String(val(e, "version", "str")),
    sha: lowerHex(val(e, "sha", "bytes32"), "sha"),
    summary: String(val(e, "summary", "str")),
    keywords,
    license: optStr(e, "license") ?? "unspecified",
    size: Number(val(e, "size", "u64")),
    fileCount: Number(val(e, "files", "u64")),
  }
}

export function parseSkillFull(e: EntityLike): ParsedSkill {
  const s = parseSkillAttributes(e)
  const raw = e.payload
  if (!raw) throw bad("record", "record has no payload")
  if (raw.length > LIMITS.skillPayload) throw bad("size", `payload is ${raw.length} bytes; the limit is ${LIMITS.skillPayload}`)
  let p: any
  try {
    p = JSON.parse(dec.decode(raw))
  } catch {
    throw bad("record", "payload is not valid JSON text")
  }
  if (!p || typeof p !== "object" || !Array.isArray(p.files) || typeof p.description !== "string") {
    throw bad("record", "payload is missing files or description")
  }
  if (p.files.length > LIMITS.files) throw bad("size", `more than ${LIMITS.files} files`)
  const files: SkillFile[] = []
  const seen = new Set<string>()
  for (const f of p.files) {
    if (!f || typeof f.path !== "string" || typeof f.text !== "string") throw bad("record", "malformed file entry")
    checkRelPath(f.path)
    if (seen.has(f.path)) throw bad("path", `duplicate path ${f.path}`)
    seen.add(f.path)
    if (f.mode !== 420 && f.mode !== 493) throw bad("mode", `${f.path} has mode ${f.mode}; only 0644 and 0755 are allowed`)
    if (f.text.includes("\u0000")) throw bad("binary", `${f.path} contains NUL`)
    if (Buffer.byteLength(f.text) > LIMITS.fileBytes) throw bad("size", `${f.path} is too large`)
    files.push({ path: f.path, mode: f.mode, text: f.text })
  }
  if (manifestHash(files) !== s.sha) throw bad("hash", "files do not match the record's sha: the record is corrupt or tampered")
  const md = files.find((f) => f.path === "SKILL.md")
  if (!md) throw bad("record", "no SKILL.md in the record")
  if (parseFrontmatter(md.text).name !== s.name) throw bad("name", "record name does not match the SKILL.md name")
  return { ...s, description: p.description, files: sortFiles(files) }
}

// ---------- rating ----------

export function buildRatingRecord(r: {
  skillKey: Hex
  sha: Hex
  verdict: Verdict
  kind: "static" | "human"
  raterVer: string
  findings: Finding[]
  rulesHash: Hex | null
  note?: string
}) {
  if (!VERDICTS.includes(r.verdict)) throw bad("record", `unknown verdict ${r.verdict}`)
  const capped = r.findings.map((f) => ({ ...f, excerpt: f.excerpt.slice(0, LIMITS.excerptChars) }))
  const note = r.note ? r.note.slice(0, LIMITS.noteChars) : undefined
  let kept = capped
  let payload = enc.encode(JSON.stringify({ rules_hash: r.rulesHash, findings: kept, ...(note ? { note } : {}) }))
  while (payload.length > LIMITS.ratingPayload && kept.length > 0) {
    kept = kept.slice(0, Math.floor(kept.length * 0.8))
    payload = enc.encode(JSON.stringify({ rules_hash: r.rulesHash, findings: kept, truncated: capped.length - kept.length, ...(note ? { note } : {}) }))
  }
  const attributes = {
    t: str("rating"),
    schema: u64(SCHEMA),
    skill: key(r.skillKey),
    sha: bytes32(r.sha),
    verdict: str(r.verdict),
    kind: str(r.kind),
    rater_ver: str(truncBytes(r.raterVer, 64)),
    findings: u64(r.findings.length),
  }
  return { payload, attributes, permissionless: r.verdict === "malicious" }
}

export function parseRating(e: EntityLike, withPayload: boolean): ParsedRating {
  if (val(e, "t", "str") !== "rating") throw bad("record", "not a rating record")
  if (BigInt(val(e, "schema", "u64")) !== BigInt(SCHEMA)) throw bad("record", "unsupported schema")
  if (!e.key || !e.creator) throw bad("record", "record has no key or creator")
  const verdict = String(val(e, "verdict", "str")) as Verdict
  if (!VERDICTS.includes(verdict)) throw bad("record", `unknown verdict ${verdict}`)
  const out: ParsedRating = {
    key: lowerHex(e.key, "key"),
    creator: lowerHex(e.creator, "creator"),
    skill: lowerHex(val(e, "skill", "key"), "skill"),
    sha: lowerHex(val(e, "sha", "bytes32"), "sha"),
    verdict,
    kind: String(val(e, "kind", "str")),
    raterVer: String(val(e, "rater_ver", "str")),
    findingCount: Number(val(e, "findings", "u64")),
  }
  if (withPayload && e.payload) {
    if (e.payload.length > LIMITS.ratingPayload) throw bad("size", "rating payload too large")
    const p = JSON.parse(dec.decode(e.payload))
    out.findings = Array.isArray(p.findings)
      ? p.findings.filter((f: any) => f && typeof f.file === "string" && typeof f.rule === "string").map((f: any) => ({
          file: String(f.file).slice(0, 255),
          line: Number(f.line) || 0,
          rule: String(f.rule).slice(0, 64),
          severity: f.severity === "critical" ? "critical" : "warn",
          excerpt: String(f.excerpt ?? "").slice(0, LIMITS.excerptChars),
        }))
      : []
    if (typeof p.note === "string") out.note = p.note.slice(0, LIMITS.noteChars)
    out.rulesHash = typeof p.rules_hash === "string" ? p.rules_hash : null
  }
  return out
}
