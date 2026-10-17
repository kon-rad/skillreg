// Thin wrapper over the Arkiv SDK: clients, reads with retry, and the writes skillreg makes.
import { createPublicClient, createWalletClient, ExpirationTime, NoEntityFoundError } from "@arkiv-network/sdk"
import { addr, bytes32, str, u64 } from "@arkiv-network/sdk/attr"
import { localhost, tiramisu } from "@arkiv-network/sdk/chains"
import { eq, or } from "@arkiv-network/sdk/query"
import { defineChain, http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { buildRatingRecord, parseRating, parseSkillAttributes, parseSkillFull, SCHEMA, type ParsedRating, type ParsedSkill } from "./records.js"
import { SafetyError } from "./safety.js"

export const SKILL_DAYS = 90
export const RATING_DAYS = 180
export const BATCH = 25
export const LOCAL_RPC = "http://127.0.0.1:18545"

export type Net = { chain: "tiramisu" | "local"; rpc: string }

export function netFromEnv(opts: { rpc?: string; chain?: string } = {}): Net {
  const chain = (opts.chain ?? process.env.SKILLREG_CHAIN ?? "tiramisu") as Net["chain"]
  if (chain !== "tiramisu" && chain !== "local") throw new SafetyError("usage", `unknown chain ${chain}; use tiramisu or local`)
  const rpc = opts.rpc ?? process.env.SKILLREG_RPC ?? (chain === "local" ? LOCAL_RPC : tiramisu.rpcUrls.default.http[0])
  return { chain, rpc }
}

function chainFor(net: Net) {
  const base = net.chain === "local" ? localhost : tiramisu
  return defineChain({ ...base, rpcUrls: { default: { http: [net.rpc] } } })
}

export function publicClient(net: Net) {
  return createPublicClient({ chain: chainFor(net), transport: http(net.rpc) })
}
export type Pub = ReturnType<typeof publicClient>

export function walletClient(net: Net) {
  const k = process.env.SKILLREG_PRIVATE_KEY
  if (!k || !/^0x[0-9a-fA-F]{64}$/.test(k)) {
    throw new SafetyError("nokey", "set SKILLREG_PRIVATE_KEY to a 0x-prefixed 32-byte private key to write to Arkiv")
  }
  return createWalletClient({ chain: chainFor(net), transport: http(net.rpc), account: privateKeyToAccount(k as Hex) })
}
export type Wallet = ReturnType<typeof walletClient>

export class NetworkError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = "NetworkError"
  }
}

/** Retry a read up to `tries` times with backoff. Never use for writes. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof SafetyError || e instanceof NoEntityFoundError) throw e
      last = e
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** i))
    }
  }
  throw new NetworkError(`Arkiv RPC request failed: ${(last as Error)?.message?.split("\n")[0] ?? last}`, last)
}

const ATTRS = { key: true, creator: true, createdAt: true, expiresAt: true, attributes: true } as const

async function collect<T>(builder: AsyncIterable<any>, parse: (e: any) => T): Promise<T[]> {
  const out: T[] = []
  for await (const e of builder) {
    try {
      out.push(parse(e))
    } catch {
      // Invalid or foreign records are skipped: every reader refuses them.
    }
  }
  return out
}

export function listSkills(pc: Pub): Promise<ParsedSkill[]> {
  return withRetry(() =>
    collect(pc.select(ATTRS).where(eq("t", str("skill")), eq("schema", u64(SCHEMA))).limit(200), parseSkillAttributes),
  )
}

export async function findSkill(pc: Pub, name: string, creator: Hex): Promise<ParsedSkill | undefined> {
  const all = await withRetry(() =>
    collect(pc.select(ATTRS).where(eq("t", str("skill")), eq("name", str(name))).createdBy(creator).limit(200), parseSkillAttributes),
  )
  return all.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0]
}

export async function findByName(pc: Pub, name: string): Promise<ParsedSkill[]> {
  return withRetry(() => collect(pc.select(ATTRS).where(eq("t", str("skill")), eq("name", str(name))).limit(200), parseSkillAttributes))
}

export async function getSkillFull(pc: Pub, key: Hex): Promise<ParsedSkill> {
  const e = await withRetry(() => pc.getEntity(key))
  return parseSkillFull(e as any)
}

export async function ratingsFor(pc: Pub, sha: Hex, raters: Hex[]): Promise<ParsedRating[]> {
  if (raters.length === 0) return []
  const who = raters.length === 1 ? eq("$creator", addr(raters[0])) : or(raters.map((r) => eq("$creator", addr(r))))
  return withRetry(() =>
    collect(pc.select("*").where(eq("t", str("rating")), eq("sha", bytes32(sha)), who).limit(200), (e) => parseRating(e, true)),
  )
}

export function ratingsBy(pc: Pub, rater: Hex): Promise<ParsedRating[]> {
  return withRetry(() => collect(pc.select(ATTRS).where(eq("t", str("rating"))).createdBy(rater).limit(200), (e) => parseRating(e, false)))
}

export async function hasDuplicate(pc: Pub, sha: Hex, creator: Hex): Promise<Hex | undefined> {
  const found = await withRetry(() =>
    collect(pc.select({ key: true }).where(eq("t", str("skill")), eq("sha", bytes32(sha))).createdBy(creator).limit(1), (e) => e.key as Hex),
  )
  return found[0]
}

// ---------- writes ----------

export async function createSkill(wc: Wallet, rec: { payload: Uint8Array; attributes: Record<string, any> }) {
  return wc.createEntity({
    payload: rec.payload,
    contentType: "application/json",
    attributes: rec.attributes,
    expires: ExpirationTime.fromDays(SKILL_DAYS),
    flags: { readonly: true, permissionlessExtension: true },
  })
}

export async function extend(wc: Wallet, key: Hex, days: number) {
  return wc.extendEntity({ entityKey: key, expires: ExpirationTime.fromDays(days) })
}

export type RatingInput = Parameters<typeof buildRatingRecord>[0]

export async function createRatings(wc: Wallet, ratings: RatingInput[]): Promise<{ txHash: Hex; keys: Hex[] }[]> {
  const out: { txHash: Hex; keys: Hex[] }[] = []
  for (let i = 0; i < ratings.length; i += BATCH) {
    const creates = ratings.slice(i, i + BATCH).map((r) => {
      const rec = buildRatingRecord(r)
      return {
        payload: rec.payload,
        contentType: "application/json" as const,
        attributes: rec.attributes,
        expires: ExpirationTime.fromDays(RATING_DAYS),
        flags: { readonly: true, permissionlessExtension: rec.permissionless },
      }
    })
    const res = await wc.executeBatch({ creates })
    out.push({ txHash: res.txHash as Hex, keys: res.createdEntities as Hex[] })
  }
  return out
}
