// The local trust policy (spec section 5): whose ratings count, and the verdict rule.
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Hex } from "viem"
import type { ParsedRating, ParsedSkill } from "./records.js"

export type TrustFile = { publishers: Hex[]; raters: Hex[] }
export type Evaluation = { verdict: "PASS" | "WARN" | "BLOCK"; reasons: string[]; counted: ParsedRating[] }

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/
export const DEFAULT_TRUST_PATH = fileURLToPath(new URL("../trust.default.json", import.meta.url))

export function trustPath(opt?: string): string {
  if (opt) return opt
  if (process.env.SKILLREG_TRUST) return process.env.SKILLREG_TRUST
  const home = join(homedir(), ".skillreg", "trust.json")
  return existsSync(home) ? home : DEFAULT_TRUST_PATH
}

export function loadTrust(opt?: string): TrustFile {
  const path = trustPath(opt)
  const data = JSON.parse(readFileSync(path, "utf8"))
  const list = (k: "publishers" | "raters"): Hex[] => {
    const v = data?.[k] ?? []
    if (!Array.isArray(v)) throw new Error(`${path}: ${k} must be a list`)
    return v.map((a: unknown) => {
      if (typeof a !== "string" || !ADDR_RE.test(a)) throw new Error(`${path}: ${JSON.stringify(a)} is not an address`)
      return a.toLowerCase() as Hex
    })
  }
  return { publishers: list("publishers"), raters: list("raters") }
}

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
