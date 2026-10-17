// Throwaway: scanner false-positive survey over locally installed skills.
import { readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { execSync } from "node:child_process"
import { readSkillDir } from "../src/manifest.js"
import { scan } from "../src/scanner.js"
const roots = process.argv.slice(2)
const dirs = new Set<string>()
for (const r of roots) for (const p of execSync(`find -L ${r} -name SKILL.md -maxdepth 4 2>/dev/null || true`).toString().split("\n").filter(Boolean)) dirs.add(dirname(p))
const tally: Record<string, number> = {}; const rules: Record<string, number> = {}
for (const d of dirs) {
  try { const r = scan(readSkillDir(d)); tally[r.verdict] = (tally[r.verdict] ?? 0) + 1
    for (const f of r.findings) if (f.severity !== "info") rules[`${f.severity}:${f.rule}`] = (rules[`${f.severity}:${f.rule}`] ?? 0) + 1
    if (d.includes(".secondbrain/skills")) console.log(d.split("/").pop(), r.verdict, r.findings.filter(f => f.severity !== "info").map(f => `${f.rule}:${f.file}:${f.line}: ${f.excerpt.slice(0, 80)}`))
  } catch (e: any) { tally["unreadable:" + e.code] = (tally["unreadable:" + e.code] ?? 0) + 1 }
}
console.log(tally); console.log(rules)
