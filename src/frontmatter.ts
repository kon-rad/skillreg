// Parse SKILL.md frontmatter (agentskills.io) into the fields skillreg records.
import { parse } from "yaml"
import { utf8Len } from "./hash.js"
import { LIMITS, SafetyError } from "./safety.js"

export type Frontmatter = { name: string; description: string; license?: string; version: string; keywords: string[] }

const KW_RE = /^[a-z0-9-]{1,32}$/
const SEMVER = /^\d+\.\d+\.\d+$/

export function normalizeKeywords(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : typeof input === "string" ? input.split(",") : []
  const out: string[] = []
  for (const k of raw.map((s) => s.trim().toLowerCase())) if (KW_RE.test(k) && !out.includes(k)) out.push(k)
  return out.slice(0, 5)
}

export function parseFrontmatter(skillMd: string): Frontmatter {
  const text = skillMd.replace(/\r\n/g, "\n")
  const m = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text)
  if (!m) throw new SafetyError("frontmatter", "SKILL.md must start with a --- frontmatter block")
  let data: any
  try {
    data = parse(m[1])
  } catch (e) {
    throw new SafetyError("frontmatter", `frontmatter is not valid YAML: ${(e as Error).message.split("\n")[0]}`)
  }
  if (!data || typeof data !== "object") throw new SafetyError("frontmatter", "frontmatter is empty")
  if (typeof data.name !== "string" || !data.name) throw new SafetyError("frontmatter", "frontmatter needs a name")
  if (typeof data.description !== "string" || !data.description.trim() || data.description.length > LIMITS.descriptionChars) {
    throw new SafetyError("frontmatter", `frontmatter needs a description of 1-${LIMITS.descriptionChars} characters`)
  }
  const meta = data.metadata && typeof data.metadata === "object" ? data.metadata : {}
  const v = String(meta.version ?? data.version ?? "")
  return {
    name: data.name,
    description: data.description.trim(),
    ...(typeof data.license === "string" ? { license: data.license } : {}),
    version: SEMVER.test(v) ? v : "0.0.0",
    keywords: normalizeKeywords(meta.keywords ?? data.keywords),
  }
}

/** Printable, whitespace-collapsed text that fits in maxBytes of UTF-8. */
export function summarize(desc: string, maxBytes = 120): string {
  const clean = desc.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (utf8Len(clean) <= maxBytes) return clean
  let out = ""
  for (const ch of clean) {
    if (utf8Len(out + ch) > maxBytes - 3) break
    out += ch
  }
  return out.trimEnd() + "..."
}

/** Truncate to maxBytes of UTF-8 on a character boundary. */
export function truncBytes(s: string, maxBytes: number): string {
  const clean = s.replace(/[\u0000-\u001f\u007f]/g, " ")
  if (utf8Len(clean) <= maxBytes) return clean
  let out = ""
  for (const ch of clean) {
    if (utf8Len(out + ch) > maxBytes) break
    out += ch
  }
  return out
}
