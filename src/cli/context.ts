// Shared CLI plumbing: options, output, errors and exit codes (spec section 7).
import { EntityMutationError, NoEntityFoundError } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { findByName, findSkill, getSkillFull, NetworkError, netFromEnv, publicClient, type Net, type Pub } from "../arkiv.js"
import type { ParsedSkill } from "../records.js"
import { SafetyError } from "../safety.js"
import { latestPerName } from "../search.js"
import { isTrustedPublisher, loadTrust, type TrustFile } from "../trust.js"

export const EXIT = { ok: 0, usage: 1, blocked: 2, confirm: 3, invalid: 4, network: 5 } as const

export class CliError extends Error {
  constructor(public exit: number, message: string, public data: Record<string, unknown> = {}) {
    super(message)
  }
}

export type Ctx = { net: Net; pc: Pub; trust: TrustFile; json: boolean }

export function makeCtx(o: { rpc?: string; chain?: string; json?: boolean; trust?: string }): Ctx {
  const net = netFromEnv(o)
  return { net, pc: publicClient(net), trust: loadTrust(o.trust), json: !!o.json }
}

const replacer = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v)

export function emit(ctx: { json: boolean }, human: string | string[], data: Record<string, unknown>): void {
  if (ctx.json) process.stdout.write(JSON.stringify(data, replacer, 2) + "\n")
  else process.stdout.write((Array.isArray(human) ? human.join("\n") : human) + "\n")
}

export function toCliError(e: unknown): CliError {
  if (e instanceof CliError) return e
  if (e instanceof SafetyError) {
    const exit = e.code === "usage" || e.code === "nokey" ? EXIT.usage : e.code === "exists" ? EXIT.confirm : EXIT.invalid
    return new CliError(exit, e.message, { code: e.code })
  }
  if (e instanceof NoEntityFoundError) return new CliError(EXIT.invalid, "record not found: it may have expired or never existed", { code: "notfound" })
  if (e instanceof NetworkError) return new CliError(EXIT.network, e.message, { code: "network" })
  if (e instanceof EntityMutationError) return new CliError(EXIT.network, `Arkiv rejected the transaction: ${e.message.split("\n")[0]}`, { code: "chain" })
  const msg = (e as Error)?.message ?? String(e)
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|HTTP request failed|insufficient funds/i.test(msg)) {
    return new CliError(EXIT.network, msg.split("\n")[0], { code: "network" })
  }
  return new CliError(EXIT.invalid, msg.split("\n")[0], { code: "error" })
}

export const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
export const isKey = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s)
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

/** Resolve name@address, a record key, or a bare name (trusted publishers only) to a full skill. */
export async function resolveSkill(ctx: Ctx, ref: string): Promise<ParsedSkill> {
  if (isKey(ref)) return getSkillFull(ctx.pc, ref.toLowerCase() as Hex)
  const at = ref.lastIndexOf("@")
  if (at > 0) {
    const name = ref.slice(0, at)
    const creator = ref.slice(at + 1)
    if (!ADDR_RE.test(creator)) throw new CliError(EXIT.usage, `${creator} is not an address; use name@0x...`)
    const s = await findSkill(ctx.pc, name, creator.toLowerCase() as Hex)
    if (!s) throw new CliError(EXIT.invalid, `no skill ${name} published by ${creator}`, { code: "notfound" })
    return getSkillFull(ctx.pc, s.key)
  }
  const all = latestPerName(await findByName(ctx.pc, ref))
  const trusted = all.filter((s) => isTrustedPublisher(ctx.trust, s.creator))
  if (trusted.length === 1) return getSkillFull(ctx.pc, trusted[0].key)
  if (all.length === 0) throw new CliError(EXIT.invalid, `no skill named ${ref}`, { code: "notfound" })
  const candidates = all.map((s) => `${s.name}@${s.creator}${isTrustedPublisher(ctx.trust, s.creator) ? " (trusted publisher)" : ""}`)
  throw new CliError(
    EXIT.confirm,
    [`${all.length} skills are named ${ref}; choose one by publisher:`, ...candidates.map((c) => `  ${c}`)].join("\n"),
    { code: "ambiguous", candidates },
  )
}

export async function daysLeft(ctx: Ctx, expiresAt: bigint): Promise<number> {
  const block = await ctx.pc.getBlockNumber()
  return Math.max(0, Math.round((Number(expiresAt - block) * 2) / 86400))
}
