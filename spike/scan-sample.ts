// Throwaway: print sample critical findings per rule.
import { execSync } from "node:child_process"
import { dirname } from "node:path"
import { readSkillDir } from "../src/manifest.js"
import { scan } from "../src/scanner.js"
const seen: Record<string, number> = {}
for (const p of execSync(`find -L ${process.argv.slice(2).join(" ")} -name SKILL.md -maxdepth 4 2>/dev/null || true`).toString().split("\n").filter(Boolean)) {
  try { for (const f of scan(readSkillDir(dirname(p))).findings) { if (f.severity !== "critical") continue; seen[f.rule] = (seen[f.rule] ?? 0) + 1; if (seen[f.rule] <= 4) console.log(f.rule, "|", dirname(p).split("/").slice(-2).join("/"), "|", f.excerpt.slice(0, 110)) } } catch {}
}
