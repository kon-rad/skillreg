// Landing page: the cyberspace hero, the trust-graph figure, and a live block height.
import "./site.css"
import { createCyberspace } from "./cyberspace"
import { SCENARIOS, createTrustGraph } from "./trustgraph"

const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"

function webglOk() {
  try { return !!document.createElement("canvas").getContext("webgl2") } catch { return false }
}

if (webglOk()) {
  createCyberspace(document.getElementById("cyberspace") as HTMLCanvasElement, document.getElementById("cs-overlay"))
  const tg = createTrustGraph(document.getElementById("trustgraph") as HTMLCanvasElement, document.getElementById("tg-overlay")!)
  const box = document.getElementById("tg-controls")!
  const note = document.getElementById("tg-note")!
  const buttons = SCENARIOS.map((s, i) => {
    const b = document.createElement("button")
    b.type = "button"; b.textContent = s.label
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(i === 0))
    b.addEventListener("click", () => {
      buttons.forEach((x) => x.setAttribute("aria-checked", String(x === b)))
      tg.set(s.trust); note.textContent = s.note
    })
    box.append(b)
    return b
  })
  note.textContent = SCENARIOS[0].note
} else {
  document.body.classList.add("no-webgl")
  document.getElementById("trust-figure")?.remove()
}

// Live block height straight from the Arkiv RPC: the page talks to the chain, nothing else.
async function block() {
  const el = document.getElementById("block")!
  try {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) })
    const { result } = await r.json()
    el.textContent = `#${parseInt(result, 16).toLocaleString("en-US")}`
  } catch { el.textContent = "offline" }
}
block()
setInterval(block, 12000)
