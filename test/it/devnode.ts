// PUBLIC test keys: the standard Hardhat/reth dev mnemonic accounts, prefunded only on a local --dev node.
// They are known to everyone and must never hold real funds.
import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const DEV = [
  { key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", addr: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" },
  { key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", addr: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
  { key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", addr: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" },
  { key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", addr: "0x90f79bf6eb2c4f870365e785982e1f101e93b906" },
] as const
export const RPC = process.env.SKILLREG_IT_RPC ?? "http://127.0.0.1:18545"

export async function nodeUp(): Promise<boolean> {
  try {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) })
    return (await r.json()).result === "0x539"
  } catch {
    return false
  }
}

const CLI = join(process.cwd(), "src/cli/main.ts")

export function cli(args: string[], o: { key?: string; trust?: string; cwd?: string } = {}) {
  const r = spawnSync("npx", ["tsx", CLI, "--chain", "local", "--rpc", RPC, "--json", ...(o.trust ? ["--trust", o.trust] : []), ...args], {
    cwd: o.cwd ?? process.cwd(),
    env: { ...process.env, SKILLREG_PRIVATE_KEY: o.key ?? "", SKILLREG_TRUST: "" },
    encoding: "utf8",
  })
  let json: any = undefined
  try { json = JSON.parse(r.stdout) } catch { /* not JSON */ }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json }
}

/** Copy a fixture under a unique name (and unique bytes) so runs never collide on a persistent node. */
export function uniqueSkill(fixture: string, newName?: string): { dir: string; name: string } {
  const tag = Math.random().toString(36).slice(2, 8)
  const src = join(process.cwd(), "fixtures", fixture)
  const fm = readFileSync(join(src, "SKILL.md"), "utf8")
  const oldName = /\nname: (\S+)/.exec(fm)![1]
  const name = newName ?? `${oldName}-${tag}`
  const dir = join(mkdtempSync(join(tmpdir(), "skillreg-it-")), name)
  cpSync(src, dir, { recursive: true })
  writeFileSync(join(dir, "SKILL.md"), fm.replace(`name: ${oldName}`, `name: ${name}`) + `\n<!-- run ${tag} -->\n`)
  return { dir, name }
}

export function trustFile(publishers: string[], raters: string[]): string {
  const f = join(mkdtempSync(join(tmpdir(), "skillreg-trust-")), "trust.json")
  writeFileSync(f, JSON.stringify({ publishers, raters }))
  return f
}

export const project = () => mkdtempSync(join(tmpdir(), "skillreg-proj-"))
export { execFileSync }
