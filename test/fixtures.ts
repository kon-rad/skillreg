import type { SkillFile } from "../src/manifest.js"
export const skillMd = (name = "hello", extra = "") =>
  `---\nname: ${name}\ndescription: Says hello. Use when the user wants a greeting.\nlicense: MIT\nmetadata:\n  version: "1.2.3"\n  keywords: "greeting, Hello ,demo"\n${extra}---\n\n# Hello\n\nSay hello.\n`
export const files = (name = "hello"): SkillFile[] => [
  { path: "SKILL.md", mode: 420, text: skillMd(name) },
  { path: "scripts/run.sh", mode: 493, text: "echo hello\n" },
]
export const ADDR = "0x1111111111111111111111111111111111111111" as const
export const ADDR2 = "0x2222222222222222222222222222222222222222" as const
export const KEY = ("0x" + "aa".repeat(32)) as `0x${string}`
