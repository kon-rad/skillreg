// Static scanner, rules v1 (spec section 8). Deterministic: same files and same version give the same findings.
import { createHash } from "node:crypto"
import type { SkillFile } from "./manifest.js"
import type { Finding, Verdict } from "./records.js"
import { LIMITS } from "./safety.js"

type Rule = { id: string; severity: Finding["severity"]; re: RegExp; unless?: RegExp }

const IPV4 = String.raw`\b(?!127\.|0\.0\.0\.0)(?:\d{1,3}\.){3}\d{1,3}\b`

const CRED = String.raw`(~|\$HOME|\$\{HOME\})\/\.ssh\b|\bid_(rsa|ed25519|ecdsa)\b|\.aws\/credentials|security\s+find-(generic|internet)-password|\bcat\s+[^|;\n]*\.env\b`
const CONFIG = String.raw`(\.claude\/settings|settings\.local\.json|\.claude\.json|\.hermes\/config|\bmcp\.json\b|\.cursor\/|\.codex\/config)`
/** Commands that send data somewhere. */
export const SEND_RE = /\b(curl|wget)\b[^\n]*(\s-d\b|--data|\s-F\b|--form|\s-T\b|--upload-file|-X\s*POST|--post-(data|file))|\b(nc|ncat|netcat)\s+\S+\s+\d+|fetch\([^)]*method:\s*["']POST/i

export const RULES: Rule[] = [
  { id: "download-exec", severity: "warn", re: /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(sh|bash|zsh)\b(?!\s+-c)|\b(curl|wget)\b[^|\n]*\|\s*(python3?|node)\s*(-\s*)?$/ },
  { id: "download-exec", severity: "warn", re: /\biex\b[\s\S]*\b(iwr|irm|invoke-webrequest)\b|invoke-expression/i },
  { id: "exfil-raw-ip", severity: "critical", re: new RegExp(String.raw`\b(curl|wget|nc|ncat)\b[^\n]*?` + IPV4) },
  { id: "agent-config-write", severity: "critical", re: new RegExp(String.raw`(>>?\s*|\btee\s+(-a\s+)?|\bcp\s+\S+\s+|\bmv\s+\S+\s+|sed\s+-i\S*\s+[^\n]*)["']?\S*` + CONFIG) },
  { id: "conceal-from-user", severity: "critical", re: /\b(do not|don't|never)\s+(tell|mention|show|reveal)\s+(this|it|that)(\s+step)?\s+to\s+the\s+user|\bwithout\s+(telling|informing|asking)\s+the\s+user|\bhide\s+(this|it)\s+from\s+the\s+user/i },
  { id: "prompt-injection", severity: "warn", re: /\b(ignore|disregard)\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { id: "credential-read", severity: "warn", re: new RegExp(CRED) },
  { id: "raw-ip-url", severity: "warn", re: new RegExp(String.raw`https?:\/\/` + IPV4) },
  { id: "safety-flag", severity: "warn", re: /--dangerously-skip-permissions|--no-sandbox|--yolo\b/ },
  { id: "encoded-blob", severity: "warn", re: /[A-Za-z0-9+/]{200,}={0,2}/ },
  { id: "encoded-blob", severity: "warn", re: /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/ },
  { id: "secret-pattern", severity: "warn", re: /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-ant-[A-Za-z0-9_-]{10,}|\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { id: "broad-tools", severity: "warn", re: /allowed-tools:.*(Bash\(\*\)|\bBash\b(?!\())/ },
  { id: "outbound-url", severity: "info", re: /https?:\/\/[a-z0-9.-]+/i },
]

export const RULES_HASH = `0x${createHash("sha256")
  .update(JSON.stringify([RULES.map((r) => [r.id, r.severity, r.re.source, r.re.flags]), SEND_RE.source, "credential-exfil:v1", "rules:v1.1"]))
  .digest("hex")}` as `0x${string}`

const MAX_FINDINGS = 100

export function scan(files: SkillFile[]): { verdict: Verdict; findings: Finding[] } {
  const findings: Finding[] = []
  for (const f of files) {
    const lines = f.text.split("\n")
    lines.forEach((line, i) => {
      const hit = new Set<string>()
      for (const rule of RULES) {
        if (hit.has(rule.id) || !rule.re.test(line)) continue
        hit.add(rule.id)
        findings.push({ file: f.path, line: i + 1, rule: rule.id, severity: rule.severity, excerpt: line.trim().slice(0, LIMITS.excerptChars) })
      }
    })
  }
  // credential-exfil: a file that both reads a credential location and sends data is critical.
  for (const f of files) {
    const reads = findings.filter((x) => x.file === f.path && x.rule === "credential-read")
    if (reads.length && f.text.split("\n").some((l) => SEND_RE.test(l))) {
      findings.push({ ...reads[0], rule: "credential-exfil", severity: "critical" })
    }
  }
  const verdict: Verdict = findings.some((x) => x.severity === "critical")
    ? "malicious"
    : findings.some((x) => x.severity === "warn")
      ? "warn"
      : "clean"
  const order = { critical: 0, warn: 1, info: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  return { verdict, findings: findings.slice(0, MAX_FINDINGS) }
}
