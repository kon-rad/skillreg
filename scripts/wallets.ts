// Demo wallets. Keys live in ~/.skillreg/wallets/<role>.env (mode 600), never in this repo.
//   npx tsx scripts/wallets.ts gen                      create missing wallets, print addresses
//   npx tsx scripts/wallets.ts list                     print addresses and Tiramisu balances
//   npx tsx scripts/wallets.ts fund [amountGLM]         send GLM from registry-ops to the other roles
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const ROLES = ["registry-ops", "demo-author", "static-scanner", "sponsor"] as const
const DIR = join(homedir(), ".skillreg", "wallets")
const file = (r: string) => join(DIR, `${r}.env`)
const keyOf = (r: string) => /SKILLREG_PRIVATE_KEY=(0x[0-9a-f]{64})/.exec(readFileSync(file(r), "utf8"))![1] as Hex
const pub = createPublicClient({ chain: tiramisu, transport: http() })

const cmd = process.argv[2] ?? "list"
if (cmd === "gen") {
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  for (const r of ROLES) {
    if (existsSync(file(r))) continue
    writeFileSync(file(r), `SKILLREG_PRIVATE_KEY=${generatePrivateKey()}\n`, { mode: 0o600 })
    chmodSync(file(r), 0o600)
  }
}
if (cmd === "fund") {
  const amount = parseEther(process.argv[3] ?? "0.5")
  const wc = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(keyOf("registry-ops")) })
  for (const r of ROLES.slice(1)) {
    const to = privateKeyToAccount(keyOf(r)).address
    const hash = await wc.sendTransaction({ to, value: amount })
    await pub.waitForTransactionReceipt({ hash })
    console.log(`sent ${formatEther(amount)} GLM to ${r} ${to}: ${hash}`)
  }
}
for (const r of ROLES) {
  if (!existsSync(file(r))) continue
  const a = privateKeyToAccount(keyOf(r)).address
  let bal = "?"
  try { bal = formatEther(await pub.getBalance({ address: a })) } catch { /* offline */ }
  console.log(`${r.padEnd(15)} ${a}  ${bal} GLM`)
}
