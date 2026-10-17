// The verdict rule (spec section 5). Pure, so the web page uses the same code as the CLI.
import type { Hex } from "viem"
import type { ParsedRating, ParsedSkill } from "./records.js"

export type TrustFile = { publishers: Hex[]; raters: Hex[] }
export type Evaluation = { verdict: "PASS" | "WARN" | "BLOCK"; reasons: string[]; counted: ParsedRating[] }

export function isTrustedPublisher(trust: TrustFile, addr: string): boolean {
  return trust.publishers.includes(addr.toLowerCase() as Hex)
}

export function evaluate(skill: Pick<ParsedSkill, "key" | "sha" | "creator">, ratings: ParsedRating[], trust: TrustFile): Evaluation {
  const raters = new Set(trust.raters.map((a) => a.toLowerCase()))
  const creator = skill.creator.toLowerCase()
  const counted = ratings.filter(
    (r) =>
      raters.has(r.creator.toLowerCase()) &&
      r.creator.toLowerCase() !== creator &&
      r.skill.toLowerCase() === skill.key.toLowerCase() &&
      r.sha.toLowerCase() === skill.sha.toLowerCase(),
  )
  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
  const describe = (r: ParsedRating) => {
    const f = r.findings?.slice(0, 3).map((x) => `${x.rule} (${x.file}:${x.line})`).join(", ")
    return `${r.verdict} by ${r.kind} rater ${short(r.creator)}${f ? `: ${f}` : r.findingCount ? `: ${r.findingCount} findings` : ""}`
  }
  const mal = counted.filter((r) => r.verdict === "malicious")
  if (mal.length) return { verdict: "BLOCK", reasons: mal.map(describe), counted }
  const warn = counted.filter((r) => r.verdict === "warn")
  if (warn.length) return { verdict: "WARN", reasons: warn.map(describe), counted }
  const clean = counted.filter((r) => r.verdict === "clean")
  if (clean.length) return { verdict: "PASS", reasons: clean.map(describe), counted }
  return { verdict: "WARN", reasons: ["no ratings from raters you trust"], counted }
}
