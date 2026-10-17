// The local trust policy (spec section 5): whose ratings count, and the verdict rule.
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Hex } from "viem"
import type { TrustFile } from "./verdict.js"

export { evaluate, isTrustedPublisher, type Evaluation, type TrustFile } from "./verdict.js"


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
