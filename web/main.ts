// skillreg web page: reads Arkiv directly from the browser. No backend.
// Every string from a record is inserted with textContent; record text is untrusted.
import type { Hex } from "viem"
import defaultTrust from "../trust.default.json"
import { getSkillFull, listSkills, publicClient, ratingsFor, type Net } from "../src/arkiv.js"
import type { ParsedSkill } from "../src/records.js"
import { rank, tokenize } from "../src/search.js"
import { evaluate, isTrustedPublisher, type TrustFile } from "../src/verdict.js"

const $ = (id: string) => document.getElementById(id)!
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: { text?: string; cls?: string } = {}, ...kids: Node[]) => {
  const n = document.createElement(tag)
  if (props.text !== undefined) n.textContent = props.text
  if (props.cls) n.className = props.cls
  for (const k of kids) n.append(k)
  return n
}
const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

const params = new URLSearchParams(location.search)
const chain = params.get("chain") === "local" ? "local" : "tiramisu"
const rpcParam = params.get("rpc")
const net: Net = {
  chain,
  rpc: rpcParam ? new URL(rpcParam, location.href).toString() : chain === "local" ? `${location.origin}/rpc` : "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
}
const pc = publicClient(net)

const ADDR = /^0x[0-9a-fA-F]{40}$/
function readList(key: string, fallback: string[]): Hex[] {
  try {
    const v = localStorage.getItem(key)
    if (v) return JSON.parse(v).filter((a: string) => ADDR.test(a)).map((a: string) => a.toLowerCase())
  } catch { /* storage may be unavailable */ }
  return fallback.map((a) => a.toLowerCase() as Hex)
}
const trust: TrustFile = {
  raters: readList("skillreg.raters", (defaultTrust as TrustFile).raters),
  publishers: readList("skillreg.publishers", (defaultTrust as TrustFile).publishers),
}

let all: ParsedSkill[] = []
let head = 0n

function badge(v: string) { return el("span", { text: v, cls: `badge ${v}` }) }
function days(s: ParsedSkill) { return Math.max(0, Math.round((Number(s.expiresAt - head) * 2) / 86400)) }

async function showResults(q: string) {
  const terms = tokenize([q])
  const top = rank(all, terms, 30, trust.publishers)
  const box = $("results")
  box.replaceChildren()
  $("detail").hidden = true
  $("status").textContent = !all.length
    ? "No skills on this network yet. Publish the first one with: npx -y github:kon-rad/skillreg publish <folder>"
    : terms.length ? `${top.length} of ${all.length} skills match "${terms.join(" ")}"` : `${all.length} skills, newest first`
  for (const s of top) {
    const v = el("span", { text: "...", cls: "badge" })
    const card = el("article", { cls: "card" },
      el("div", { cls: "row" },
        el("span", { text: s.name, cls: "name" }),
        el("span", { text: `@${short(s.creator)}`, cls: "addr" }),
        el("span", { text: `v${s.version}`, cls: "muted" }),
        v,
        ...(isTrustedPublisher(trust, s.creator) ? [el("span", { text: "trusted publisher", cls: "trusted" })] : []),
        el("span", { text: `expires in ${days(s)} d`, cls: "muted" })),
      el("p", { text: s.summary, cls: "summary" }))
    card.tabIndex = 0
    card.addEventListener("click", () => showDetail(s.key))
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") showDetail(s.key) })
    box.append(card)
    ratingsFor(pc, s.sha, trust.raters).then((r) => { const ev = evaluate(s, r, trust); v.replaceWith(badge(ev.verdict)) }).catch(() => (v.textContent = "?"))
  }
}

async function showDetail(key: Hex) {
  const d = $("detail")
  d.hidden = false
  d.replaceChildren(el("p", { text: "Fetching and verifying the record...", cls: "muted" }))
  d.scrollIntoView({ behavior: "smooth", block: "start" })
  try {
    const s = await getSkillFull(pc, key) // checks size, paths, modes, name and the manifest hash
    const ratings = await ratingsFor(pc, s.sha, trust.raters)
    const ev = evaluate(s, ratings, trust)
    const id = `${s.name}@${s.creator}`
    const files = el("table", {}, el("tr", {}, el("th", { text: "file" }), el("th", { text: "mode" }), el("th", { text: "bytes" })))
    for (const f of s.files!) files.append(el("tr", {}, el("td", { text: f.path }), el("td", { text: f.mode === 493 ? "0755" : "0644" }), el("td", { text: String(new TextEncoder().encode(f.text).length) })))
    const rt = el("table", {}, el("tr", {}, el("th", { text: "rater" }), el("th", { text: "verdict" }), el("th", { text: "findings" })))
    for (const r of ev.counted) {
      const fl = el("div")
      for (const f of (r.findings ?? []).filter((x) => x.severity !== "info").slice(0, 8)) fl.append(el("div", { text: `${f.severity} ${f.rule} ${f.file}:${f.line}  ${f.excerpt}`, cls: `finding-${f.severity}` }))
      rt.append(el("tr", {}, el("td", { text: `${r.kind} ${short(r.creator)}`, cls: "addr" }), el("td", {}, badge(r.verdict === "clean" ? "PASS" : r.verdict === "warn" ? "WARN" : "BLOCK")), el("td", {}, fl)))
    }
    d.replaceChildren(
      el("div", { cls: "row" }, el("h2", { text: s.name }), badge(ev.verdict)),
      el("p", { text: s.description }),
      el("p", { cls: "addr", text: `publisher ${s.creator}${isTrustedPublisher(trust, s.creator) ? " (in your trust list)" : " (not in your trust list)"}` }),
      el("p", { cls: "muted", text: `v${s.version} · ${s.license} · ${s.fileCount} files · ${s.size} bytes · expires in ${days(s)} days · anyone can extend it` }),
      el("p", { cls: "addr", text: `record ${s.key}` }),
      el("p", { cls: "addr", text: `sha ${s.sha} (verified in your browser)` }),
      el("h3", { text: "Verdict" }),
      el("ul", {}, ...ev.reasons.map((r) => el("li", { text: r }))),
      ...(ev.counted.length ? [rt] : []),
      el("h3", { text: "Install" }),
      ev.verdict === "BLOCK"
        ? el("p", { text: "Blocked by a rater you trust. The skillreg CLI refuses to install it.", cls: "finding-critical" })
        : el("pre", { text: `npx github:kon-rad/skillreg install ${id}${ev.verdict === "WARN" ? "   # WARN: read the reasons above first" : ""}` }),
      el("h3", { text: "Files" }),
      files,
      el("h3", { text: "SKILL.md" }),
      el("pre", { text: s.files!.find((f) => f.path === "SKILL.md")!.text }),
    )
  } catch (e) {
    d.replaceChildren(el("p", { text: `Could not load or verify this record: ${(e as Error).message}`, cls: "finding-critical" }))
  }
}

async function boot() {
  ;($("raters") as HTMLTextAreaElement).value = trust.raters.join("\n")
  ;($("publishers") as HTMLTextAreaElement).value = trust.publishers.join("\n")
  $("net").textContent = `Network: ${chain} · RPC ${net.rpc}`
  $("save").addEventListener("click", () => {
    const parse = (id: string) => ($(id) as HTMLTextAreaElement).value.split(/\s+/).filter((a) => ADDR.test(a))
    try {
      localStorage.setItem("skillreg.raters", JSON.stringify(parse("raters")))
      localStorage.setItem("skillreg.publishers", JSON.stringify(parse("publishers")))
    } catch { /* storage may be unavailable */ }
    location.reload()
  })
  const q = $("q") as HTMLInputElement
  q.value = params.get("q") ?? ""
  $("search").addEventListener("submit", (e) => {
    e.preventDefault()
    const u = new URL(location.href); u.searchParams.set("q", q.value); history.replaceState(null, "", u)
    showResults(q.value)
  })
  try {
    ;[all, head] = await Promise.all([listSkills(pc), pc.getBlockNumber()])
    await showResults(q.value)
    const k = params.get("skill")
    if (k && /^0x[0-9a-fA-F]{64}$/.test(k)) showDetail(k as Hex)
  } catch (e) {
    $("status").textContent = `Could not reach Arkiv at ${net.rpc}: ${(e as Error).message}`
  }
}
boot()
