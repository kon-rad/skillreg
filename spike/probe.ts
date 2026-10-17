// Throwaway: probe Arkiv SDK behaviour against the local dev node.
import { createPublicClient, createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { http, defineChain } from "viem"
import { localhost } from "@arkiv-network/sdk/chains"
import { privateKeyToAccount } from "viem/accounts"
import { str, u64, bytes32, key } from "@arkiv-network/sdk/attr"
import { eq, gt, startsWith, or, and } from "@arkiv-network/sdk/query"


const chain = defineChain({ ...localhost, rpcUrls: { default: { http: ["http://127.0.0.1:18545"] } } })
const A = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
const B = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
const pub = createPublicClient({ chain, transport: http() })
const wa = createWalletClient({ chain, transport: http(), account: A })
const wb = createWalletClient({ chain, transport: http(), account: B })
const log = (k: string, v: unknown) => console.log(k.padEnd(28), typeof v === "object" ? JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x) : v)
const sha = ("0x" + "ab".repeat(32)) as `0x${string}`

const r1 = await wa.createEntity({
  payload: jsonToPayload({ hello: "world" }), contentType: "application/json",
  attributes: { t: str("skill"), schema: u64(1), name: str("pdf-tools"), sha: bytes32(sha), kw1: str("pdf") },
  expires: ExpirationTime.fromDays(90), flags: { readonly: true, permissionlessExtension: true },
})
log("create", r1)
const block = await pub.getBlockNumber()
const e = await pub.getEntity(r1.entityKey)
log("getEntity attrs", e.attributes); log("creator/owner", [e.creator, e.owner]); log("createdAt/expiresAt", [e.createdAt, e.expiresAt]); log("flags", e.creationFlags)

// field selection without payload
const q1 = await pub.select({ key: true, attributes: true, creator: true }).where(eq("t", str("skill")), startsWith("name", "pdf")).fetch()
log("select no payload", q1.entities.map(x => ({ k: x.key, has_payload: (x as any).payload !== undefined })))
// system attribute range
try { const q2 = await pub.select({ key: true }).where(eq("t", str("skill")), gt("$createdAt", u64(block - 5n))).fetch(); log("$createdAt range", q2.entities.length) } catch (err) { log("$createdAt range ERR", String(err).slice(0, 200)) }
try { const q3 = await pub.select({ key: true }).where(eq("t", str("skill")), gt("$expiresAt", u64(block))).fetch(); log("$expiresAt range", q3.entities.length) } catch (err) { log("$expiresAt range ERR", String(err).slice(0, 200)) }
// key attr + bytes32 eq + OR
const q4 = await pub.select({ key: true }).where(eq("sha", bytes32(sha))).fetch(); log("bytes32 eq", q4.entities.length)
const ors = Array.from({ length: 40 }, (_, i) => eq("kw1", str("w" + i))); ors.push(eq("kw1", str("pdf")))
try { const q5 = await pub.select({ key: true }).where(or(ors)).fetch(); log("41-way OR", q5.entities.length) } catch (err) { log("41-way OR ERR", String(err).slice(0, 200)) }
// createdBy
const q6 = await pub.select({ key: true }).where(eq("t", str("skill"))).createdBy(A.address).fetch(); log("createdBy", q6.entities.length)
// readonly patch should fail
try { await wa.patchEntity({ entityKey: r1.entityKey, set: { kw1: str("x") } }); log("patch readonly", "ALLOWED?!") } catch (err) { log("patch readonly", "rejected: " + String(err).slice(0, 80)) }
// non-owner extend on permissionless
try { const x = await wb.extendEntity({ entityKey: r1.entityKey, expires: ExpirationTime.fromDays(120) }); log("non-owner extend", x) } catch (err) { log("non-owner extend ERR", String(err).slice(0, 200)) }
// non-owner extend on NOT permissionless
const r2 = await wa.createEntity({ payload: jsonToPayload({}), contentType: "application/json", attributes: { t: str("rating"), skill: key(r1.entityKey) }, expires: ExpirationTime.fromDays(1), flags: { readonly: true } })
try { await wb.extendEntity({ entityKey: r2.entityKey, expires: ExpirationTime.fromDays(5) }); log("extend non-permissionless", "ALLOWED?!") } catch (err) { log("extend non-permissionless", "rejected: " + String(err).slice(0, 80)) }
// key attr query
const q7 = await pub.select({ key: true }).where(eq("skill", key(r1.entityKey))).fetch(); log("key eq", q7.entities.length)
// big payload: 100 KiB
const big = new TextEncoder().encode(JSON.stringify({ text: "x".repeat(100 * 1024 - 20) }))
try { const r3 = await wa.createEntity({ payload: big, contentType: "application/json", attributes: { t: str("big") }, expires: ExpirationTime.fromDays(1) }); const rc = await pub.getTransactionReceipt({ hash: r3.txHash }); log("100KiB payload gas", rc.gasUsed) } catch (err) { log("100KiB payload ERR", String(err).slice(0, 300)) }
// batch of 25 creates
try { const rb = await wa.executeBatch({ creates: Array.from({ length: 25 }, (_, i) => ({ payload: jsonToPayload({ i }), contentType: "application/json", attributes: { t: str("rating"), n: u64(i) }, expires: ExpirationTime.fromDays(1) })) }); log("batch 25", rb.createdEntities.length) } catch (err) { log("batch 25 ERR", String(err).slice(0, 200)) }
// delete readonly by owner
try { await wa.deleteEntity({ entityKey: r2.entityKey }); log("delete readonly by owner", "allowed") } catch (err) { log("delete readonly", "rejected") }
