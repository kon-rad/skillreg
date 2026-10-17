// Safety rules S1-S3 and S6 from the spec. Pure functions, no I/O.
import { resolve, sep } from "node:path"

export const LIMITS = {
  skillPayload: 96 * 1024,
  ratingPayload: 32 * 1024,
  files: 200,
  fileBytes: 64 * 1024,
  pathBytes: 255,
  depth: 8,
  descriptionChars: 1024,
  noteChars: 2000,
  excerptChars: 200,
} as const

export class SafetyError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = "SafetyError"
  }
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** S2: the agentskills.io name rule. */
export function checkSkillName(name: string): void {
  if (typeof name !== "string" || name.length < 1 || name.length > 64 || !NAME_RE.test(name)) {
    throw new SafetyError("name", `invalid skill name ${JSON.stringify(name)}: use 1-64 lowercase letters, digits and single hyphens`)
  }
}

/** S1, lexical part: a safe relative POSIX path. */
export function checkRelPath(p: string): void {
  const bad = (why: string) => new SafetyError("path", `unsafe path ${JSON.stringify(p)}: ${why}`)
  if (typeof p !== "string" || p.length === 0) throw bad("empty")
  if (Buffer.byteLength(p, "utf8") > LIMITS.pathBytes) throw bad("too long")
  if (/[\u0000-\u001f\u007f]/.test(p)) throw bad("control character")
  if (p.includes("\\")) throw bad("backslash")
  if (p.includes(":")) throw bad("colon")
  if (p.startsWith("/")) throw bad("absolute")
  const segs = p.split("/")
  if (segs.length > LIMITS.depth) throw bad("too deep")
  for (const s of segs) {
    if (s === "") throw bad("empty segment")
    if (s === "." || s === "..") throw bad("dot segment")
  }
}

/** S1, resolved part: the target must stay inside root. */
export function resolveInside(root: string, p: string): string {
  checkRelPath(p)
  const base = resolve(root)
  const target = resolve(base, p)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new SafetyError("path", `path ${JSON.stringify(p)} escapes ${base}`)
  }
  return target
}

const decoder = new TextDecoder("utf-8", { fatal: true })

/** Text only: valid UTF-8, no NUL bytes. */
export function checkText(bytes: Uint8Array, path: string): string {
  if (bytes.includes(0)) throw new SafetyError("binary", `${path} is binary (contains NUL bytes); only text files are allowed`)
  try {
    return decoder.decode(bytes)
  } catch {
    throw new SafetyError("binary", `${path} is not valid UTF-8 text`)
  }
}

const SECRET_NAMES: [RegExp, string][] = [
  [/^\.env(\..*)?$/, "environment file"],
  [/\.pem$/, "PEM key or certificate"],
  [/\.key$/, "key file"],
  [/^id_(rsa|ed25519|ecdsa|dsa)/, "SSH key"],
  [/^credentials/i, "credentials file"],
  [/^auth\.json$/, "auth token file"],
  [/^\.npmrc$/, "npm config with tokens"],
  [/^\.netrc$/, "netrc credentials"],
]

const SECRET_CONTENT: [RegExp, string][] = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key block"],
  [/sk-ant-[A-Za-z0-9_-]{10,}/, "Anthropic API key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API secret key"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained token"],
  [/\bxox[baprs]-[A-Za-z0-9-]{6,}/, "Slack token"],
]

const HEX64 = /0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g

/** S6: reasons this file looks like it contains a secret. Empty means clean. */
export function leakCheck(path: string, text: string): string[] {
  const reasons: string[] = []
  const base = path.split("/").pop() ?? path
  for (const [re, what] of SECRET_NAMES) if (re.test(base)) reasons.push(`${path}: file name looks like a ${what}`)
  for (const [re, what] of SECRET_CONTENT) if (re.test(text)) reasons.push(`${path}: contains what looks like a ${what}`)
  for (const m of text.matchAll(HEX64)) {
    const before = text.slice(Math.max(0, m.index! - 20), m.index!).toLowerCase()
    if (!/(sha|hash|digest)/.test(before)) {
      reasons.push(`${path}: contains a 32-byte hex value that could be a private key`)
      break
    }
  }
  return reasons
}
